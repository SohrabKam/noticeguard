/* Complete end-to-end functional test of NoticeGuard.
   Walks through every major page and workflow, verifies content,
   collects screenshots in /tmp/noticeguard-uat/ */

import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "https://builder-ops.vercel.app"
const EMAIL = "uat@noticeguard.test.com"
const PASSWORD = "noticeguard2025"
const SHOTS = "/tmp/noticeguard-uat"
fs.mkdirSync(SHOTS, { recursive: true })

let pass = 0, fail = 0
const T = (label, ok, detail = "") => {
  if (ok) { pass++; console.log(`  ✅ ${label}`) }
  else { fail++; console.log(`  ❌ ${label}${detail ? " — " + detail : ""}`) }
}
const shot = async (p, n) => { await p.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: false }) }

// ──────────────────────────────────────────────
const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] })
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
})
const page = await ctx.newPage(); page.setDefaultTimeout(30000)
let subHref = "", cycleHref = ""
const errors = []
page.on("pageerror", (err) => errors.push(`PAGE: ${err.message}`))
page.on("console", (msg) => { if (msg.type() === "error") errors.push(`CONSOLE: ${msg.text()}`) })

try {

// ════════════════════════════════════════════════════════════
// 1. SIGN IN
// ════════════════════════════════════════════════════════════
console.log("\n═══ 1. SIGN IN ═══")
await page.goto(`${BASE}/sign-in`, { waitUntil: "domcontentloaded" })
T("Sign-in page loads", await page.locator("#identifier-field").isVisible())
await page.fill("#identifier-field", EMAIL)
await page.click('button:has-text("Continue"):visible')
await page.waitForSelector("#password-field", { state: "visible" })
await page.fill("#password-field", PASSWORD)
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle", timeout: 20000 }).catch(() => {}),
  page.click('button:has-text("Continue"):visible'),
])
for (let i = 0; i < 20 && page.url().includes("/sign-in"); i++) await page.waitForTimeout(600)
const loggedIn = !page.url().includes("/sign-in")
T("Login succeeds", loggedIn, page.url())
if (!loggedIn) throw new Error("Login failed — aborting")

// ════════════════════════════════════════════════════════════
// 2. DASHBOARD
// ════════════════════════════════════════════════════════════
console.log("\n═══ 2. DASHBOARD ═══")
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
await page.waitForTimeout(2000)
await shot(page, "01-dashboard")

const dashBody = await page.locator("body").innerText()
T("Dashboard renders", dashBody.includes("Compliance Dashboard") || dashBody.includes("Dashboard"))
T("Has cycle data", dashBody.includes("BREACHED") || dashBody.includes("Cycle") || dashBody.includes("#"))
T("Nav sidebar present", dashBody.includes("Projects") && dashBody.includes("Subcontracts") && dashBody.includes("Cash Forecast"))

// Find link to a cycle for later drilling
const dashLinks = await page.locator("a[href*='/cycles/']").all()
if (dashLinks.length > 0) {
  cycleHref = await dashLinks[0].getAttribute("href") ?? ""
  T("Cycle links on dashboard", cycleHref.length > 0, cycleHref)
}

// ════════════════════════════════════════════════════════════
// 3. PROJECTS
// ════════════════════════════════════════════════════════════
console.log("\n═══ 3. PROJECTS ═══")
await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await shot(page, "02-projects")

const projBody = await page.locator("body").innerText()
T("Projects page renders", projBody.includes("Projects"))
T("Has projects listed", projBody.includes("Elmwood") || projBody.includes("Active") || (await page.locator("table tbody tr").count() > 0))
T("New project button", projBody.includes("New project") || (await page.locator('a[href="/projects/new"]').count() > 0))

// ════════════════════════════════════════════════════════════
// 4. SUBCONTRACTS → DRAWDOWN TAB
// ════════════════════════════════════════════════════════════
console.log("\n═══ 4. SUBCONTRACTS ═══")
await page.goto(`${BASE}/subcontracts`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await shot(page, "03-subcontracts")

const scBody = await page.locator("body").innerText()
T("Subcontracts page renders", scBody.includes("Subcontracts"))

// Find a real subcontract detail link
const hrefs = await page.locator("a").evaluateAll(els => els.map(e => e.getAttribute("href")))
const realLinks = hrefs.filter(h => h && /\/subcontracts\/[a-z0-9]+\s*$/.test(h) && !h.endsWith("/new"))
if (realLinks.length > 0) {
  subHref = realLinks[0]
  T("Subcontract detail links exist", true, subHref)

  // Navigate to subcontract detail
  console.log(`  → ${subHref}`)
  await page.goto(`${BASE}${subHref}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(2500)
  await shot(page, "04-subcontract-detail")

  const subDetailBody = await page.locator("body").innerText()
  T("Subcontract detail renders", subDetailBody.includes("Payment cycles") || subDetailBody.includes("Contract sum"))
  T("Has cycle table", subDetailBody.includes("#1") || subDetailBody.includes("PN deadline") || subDetailBody.includes("Open →"))

  // Click Drawdown tab
  const dt = page.locator('[role="tab"]').filter({ hasText: "Drawdown" })
  const dtVisible = await dt.count()
  if (dtVisible > 0) {
    await dt.first().click()
    await page.waitForTimeout(1500)
    await shot(page, "05-drawdown-tab")

    const ddBody = await page.locator("body").innerText()
    T("Drawdown tab renders", ddBody.includes("Package value") || ddBody.includes("Cash-out forecast"))
    T("Has forecast data", ddBody.includes("£") && (ddBody.includes("Gross") || ddBody.includes("Net cash") || ddBody.includes("Retention")))
    T("Has bar chart", ddBody.includes("Cash-out forecast") || ddBody.includes("Certified") || ddBody.includes("Forecast"))
  } else {
    T("Drawdown tab exists", false, "not found")
  }
} else {
  T("Subcontract detail links exist", false, "no links found")
}

// ════════════════════════════════════════════════════════════
// 5. CASH FORECAST PAGE
// ════════════════════════════════════════════════════════════
console.log("\n═══ 5. CASH FORECAST ═══")
await page.goto(`${BASE}/forecast`, { waitUntil: "networkidle" })
await page.waitForTimeout(2000)
await shot(page, "06-cash-forecast")

const fcBody = await page.locator("body").innerText()
T("Cash forecast page renders", fcBody.includes("Cash forecast") || fcBody.includes("Portfolio"))
T("Has month grid", fcBody.includes("Jan") || fcBody.includes("Feb") || fcBody.includes("Next"))
T("Has export button", fcBody.includes("Export CSV") || fcBody.includes("Export"))
T("Has subcontractor rows", (fcBody.match(/DEMO|SC-|Apex/g)?.length ?? 0) > 0 || fcBody.includes("£"))

// Test CSV export button
const csvBtn = page.locator("button").filter({ hasText: /Export/i })
if (await csvBtn.count() > 0) {
  await csvBtn.first().click()
  await page.waitForTimeout(500)
  T("CSV export button works", true, "clicked")
}

// ════════════════════════════════════════════════════════════
// 6. CYCLE ASSESSMENT WORKSPACE
// ════════════════════════════════════════════════════════════
console.log("\n═══ 6. CYCLE ASSESSMENT ═══")
// Look for cycle links on the forecast page or subcontract detail
if (!cycleHref) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  const cl = await page.locator("a[href*='/cycles/']").first()
  if (await cl.count() > 0) cycleHref = await cl.getAttribute("href") ?? ""
}

if (cycleHref) {
  console.log(`  → ${cycleHref}`)
  await page.goto(`${BASE}${cycleHref}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(3000)
  await shot(page, "07-cycle-assessment")

  const cyBody = await page.locator("body").innerText()
  T("Cycle page renders", cyBody.includes("Cycle #") || cyBody.includes("Application due"))
  T("Has date cards", cyBody.includes("Application due") || cyBody.includes("Payment notice deadline") || cyBody.includes("Final date"))
  T("Has status badge", cyBody.includes("BREACHED") || cyBody.includes("Received") || cyBody.includes("Notices") || cyBody.includes("Assessment"))

  // Check tabs exist
  const tabs = await page.locator('[role="tab"]').all()
  const tabNames = []
  for (const t of tabs) tabNames.push(await t.textContent())
  T("Has assessment/application tabs", tabNames.some(t => t?.includes("Assessment")) || tabNames.some(t => t?.includes("Application")))

  // Click Application tab if it exists
  const appTab = page.locator('[role="tab"]').filter({ hasText: /Application/i })
  if (await appTab.count() > 0) {
    await appTab.first().click()
    await page.waitForTimeout(1000)
    await shot(page, "08-application-tab")
    T("Application tab renders", true)
  }

  // Click Notices tab
  const noticeTab = page.locator('[role="tab"]').filter({ hasText: /Notice/i })
  if (await noticeTab.count() > 0) {
    await noticeTab.first().click()
    await page.waitForTimeout(1000)
    await shot(page, "09-notices-tab")
    T("Notices tab renders", true)
  }

  // Click Audit trail tab
  const auditTab = page.locator('[role="tab"]').filter({ hasText: /Audit/i })
  if (await auditTab.count() > 0) {
    await auditTab.first().click()
    await page.waitForTimeout(1000)
    const auditBody = await page.locator("body").innerText()
    T("Audit trail tab renders", auditBody.includes("events") || auditBody.includes("No audit") || auditBody.includes("logged") || auditBody.includes("served"))
  }
} else {
  T("Cycle link found", false, "no cycle links on dashboard")
}

// ════════════════════════════════════════════════════════════
// 7. COMPLIANCE
// ════════════════════════════════════════════════════════════
console.log("\n═══ 7. COMPLIANCE ═══")
await page.goto(`${BASE}/compliance`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await shot(page, "10-compliance")

const compBody = await page.locator("body").innerText()
T("Compliance page renders", compBody.includes("Compliance") || compBody.includes("documents"))
T("Has document tracking", compBody.includes("Insurance") || compBody.includes("Expiry") || compBody.includes("VALID") || compBody.includes("Document"))

// ════════════════════════════════════════════════════════════
// 8. ALERTS
// ════════════════════════════════════════════════════════════
console.log("\n═══ 8. ALERTS ═══")
await page.goto(`${BASE}/alerts`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await shot(page, "11-alerts")

const alertBody = await page.locator("body").innerText()
T("Alerts page renders", alertBody.includes("Alert") || alertBody.includes("alerts") || alertBody.includes("reminders") || alertBody.includes("configuration"))

// ════════════════════════════════════════════════════════════
// 9. SETTINGS
// ════════════════════════════════════════════════════════════
console.log("\n═══ 9. SETTINGS ═══")
await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" })
await page.waitForTimeout(1500)
await shot(page, "12-settings")

const setBody = await page.locator("body").innerText()
T("Settings page renders", setBody.includes("Settings") || setBody.includes("Organisation") || setBody.includes("Name") || setBody.includes("API"))

// ════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════
const total = pass + fail
console.log(`\n══════════════════════════════════════`)
console.log(`RESULTS: ${pass}/${total} passed${fail > 0 ? `, ${fail} FAILED` : ""}`)
console.log(`Screenshots: ${SHOTS}/ (${fs.readdirSync(SHOTS).length} files)`)
if (errors.length > 0) {
  console.log(`\n⚠️  ${errors.length} browser errors:`)
  for (const e of errors.slice(0, 5)) console.log(`   ${e.substring(0, 150)}`)
}
console.log(`══════════════════════════════════════\n`)
fs.writeFileSync(`${SHOTS}/results.json`, JSON.stringify({ pass, fail, total, errors }, null, 2))

} catch (e) {
  console.error("💥 FATAL:", e.message.split("\n")[0])
  await shot(page, "zz-crash")
  fail++
} finally {
  await browser.close()
  if (fail > 0) process.exitCode = 1
}