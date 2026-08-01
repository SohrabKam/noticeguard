/* Authenticated UAT — full client-onboarding journey against the live site.
   Logs in as a fresh (org-less) test user, runs the /onboarding form, creates
   an organisation, and verifies the dashboard + settings reflect it.

   Credentials come from env so no secrets live in the repo:
     UAT_EMAIL, UAT_PASSWORD, UAT_BASE_URL (optional, defaults to prod)

   Usage:
     UAT_EMAIL=you@example.com UAT_PASSWORD=... node scripts/uat.mjs
*/
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = process.env.UAT_BASE_URL || "https://builder-ops.vercel.app"
const EMAIL = process.env.UAT_EMAIL
const PASSWORD = process.env.UAT_PASSWORD
if (!EMAIL || !PASSWORD) {
  console.error("Set UAT_EMAIL and UAT_PASSWORD (see header).")
  process.exit(2)
}

const SHOTS = process.env.UAT_SHOTS || "/tmp/uat-shots"
fs.mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "✅" : "❌"} ${n}${d ? " — " + d : ""}`) }
const shot = (p, n) => p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true })

const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] })
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
})
const page = await ctx.newPage()
page.setDefaultTimeout(30000)

try {
  // 1. Sign in (Clerk identifier -> password, two-step)
  await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
  await page.fill("#identifier-field", EMAIL)
  await page.click('button:has-text("Continue"):visible')
  await page.waitForSelector("#password-field", { state: "visible" })
  await page.fill("#password-field", PASSWORD)
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {}),
    page.click('button:has-text("Continue"):visible'),
  ])
  for (let i = 0; i < 20 && page.url().includes("/sign-in"); i++) await page.waitForTimeout(600)
  check("Login completes", !page.url().includes("/sign-in"), page.url())

  // 2. Onboarding form (selectors mirror app/onboarding/onboarding-form.tsx)
  await page.waitForSelector('input[name="orgName"]', { state: "visible", timeout: 15000 })
  await shot(page, "30-onboarding-form")
  await page.fill('input[name="orgName"]', "UAT Test Client Ltd")
  await page.fill('input[name="fromName"]', "UAT Commercial Team")
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle", timeout: 25000 }).catch(() => {}),
    page.click('button[type="submit"]:has-text("Create organisation")'),
  ])
  for (let i = 0; i < 25 && !page.url().includes("/dashboard"); i++) await page.waitForTimeout(600)
  await shot(page, "31-after-create")
  const toasts = await page.locator('[data-sonner-toast], .sonner-toast, [role="status"]').allInnerTexts().catch(() => [])
  if (toasts.length) console.log("   TOASTS:", JSON.stringify(toasts))
  check("completeOnboarding -> /dashboard", page.url().includes("/dashboard"), page.url())

  // 3. Dashboard renders a provisioned (empty) workspace
  const dash = await page.locator("body").innerText()
  check("Dashboard renders post-onboarding (no error)", dash.length > 30 && !/something went wrong|error occurred/i.test(dash), dash.slice(0, 100).replace(/\n/g, " "))

  // 4. Settings reflects the new org name
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" }).catch(() => {})
  await shot(page, "32-settings")
  const st = await page.locator("body").innerText()
  check("Settings shows created org name", /UAT Test Client/i.test(st), st.slice(0, 80).replace(/\n/g, " "))

  console.log("\n=== SUMMARY ===")
  console.log(`${results.filter(r => r.ok).length}/${results.length} passed. Shots in ${SHOTS}`)
  if (results.some(r => !r.ok)) process.exitCode = 1
} catch (e) {
  console.error("💥", e.message.split("\n")[0])
  await shot(page, "99-crash")
  process.exitCode = 1
} finally {
  await browser.close()
}
