#!/usr/bin/env node
/**
 * NoticeGuard Pilot Outreach Generator
 *
 * Reads pilot-targets.csv and generates personalized email drafts.
 * Run: node scripts/generate-outreach.mjs [--send]
 *
 * Without --send: writes all drafts to scripts/outreach-drafts.md
 * With --send: sends each email via Resend (REQUIRES: email column in CSV,
 *              RESEND_API_KEY and RESEND_FROM_EMAIL in .env.local)
 */

import { readFileSync, writeFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvPath = resolve(__dirname, "../docs/pilot-targets.csv")
const outputPath = resolve(__dirname, "outreach-drafts.md")

const SENDER_NAME = "Sohrab"
const SENDER_EMAIL = process.env.RESEND_FROM_EMAIL ?? "sohrab@noticeguard.app"
const LANDING_URL = "https://builder-ops.vercel.app/landing.html"

function parseCSV(text) {
  const lines = text.trim().split("\n")
  const headers = lines[0].split(",")
  return lines.slice(1).map((line, i) => {
    // Handle quoted fields
    const vals = []
    let current = ""
    let inQuotes = false
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; continue }
      if (ch === "," && !inQuotes) { vals.push(current.trim()); current = ""; continue }
      current += ch
    }
    vals.push(current.trim())
    const row = {}
    headers.forEach((h, i) => { row[h.trim()] = vals[i] || "" })
    return row
  })
}

function generateEmail(contact) {
  const name = contact["Contact Name"] || "there"
  const company = contact["Company"] || "your company"
  const firstName = name.split(" ")[0]

  return {
    to: contact["Email"] || "",
    subject: `${company} — subcontract notice tracking`,
    body: `Hi ${firstName},

I'm building a tool that helps commercial teams running JCT/NEC
subcontracts track payment notices and subbie drawdowns — catching
missed deadlines before they trigger a smash-and-grab.

We're looking for 5–6 pilot contractors at £250/month to shape the
product before wider release. No commitment beyond a 15-minute call
to see if it's relevant to ${company}.

${LANDING_URL}

Open to a quick chat this week or next?

${SENDER_NAME}
NoticeGuard`,
    followUp: `Hi ${firstName} — just bumping this. Happy to send a 2-min
walkthrough instead if that's easier.

${LANDING_URL}

${SENDER_NAME}`,
  }
}

function generateMarkdown(contacts) {
  const drafts = contacts.map((c) => {
    const email = generateEmail(c)
    return `## ${c.Company} — ${c["Contact Name"]} (${c.Role})
*No email on file — find via Hunter.io or LinkedIn*

**Subject:** ${email.subject}

${email.body.replace(/\n/g, "\n")}

---
**Follow-up (send after 5 days if no reply):**

**Subject:** Re: ${email.subject}

${email.followUp.replace(/\n/g, "\n")}

---
`
  })

  const hasEmail = contacts.filter(c => c.Email)
  const noEmail = contacts.filter(c => !c.Email)

  return `# NoticeGuard Pilot Outreach — Email Drafts
Generated ${new Date().toISOString().split("T")[0]}
${contacts.length} contacts · ${hasEmail.length} with email · ${noEmail.length} need email lookup

## Priority order — send these first

${drafts.join("\n")}

## Stats
- Total contacts: ${contacts.length}
- Ready to send (have email): ${hasEmail.length}
- Need email lookup: ${noEmail.length}

## How to find missing emails
1. **Hunter.io** (free tier: 25 searches/month) — enter company domain, it finds email patterns
2. **Apollo.io** (free tier) — search by name + company
3. **Google** — search "[Name] [Company] email" or "[Name] LinkedIn"
4. **LinkedIn Sales Navigator** — 1-month free trial, export contacts
5. **Pattern guess**: firstname.lastname@company.com or f.lastname@company.com
`
}

async function sendEmails(contacts) {
  const { Resend } = await import("resend")
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error("❌ RESEND_API_KEY not set in environment")
    process.exit(1)
  }

  const resend = new Resend(apiKey)
  const toSend = contacts.filter(c => c.Email)

  if (toSend.length === 0) {
    console.error("❌ No contacts have email addresses in the CSV. Add an Email column.")
    process.exit(1)
  }

  console.log(`📧 Sending ${toSend.length} emails via Resend...`)
  console.log(`From: ${SENDER_EMAIL}`)
  console.log(`Landing page: ${LANDING_URL}\n`)

  let sent = 0
  let failed = 0

  for (const contact of toSend) {
    const email = generateEmail(contact)
    const display = `${contact["Contact Name"]} <${email.to}> (${contact.Company})`

    try {
      const { error } = await resend.emails.send({
        from: SENDER_EMAIL,
        to: email.to,
        subject: email.subject,
        text: email.body,
      })

      if (error) {
        console.log(`❌ ${display}: ${error.message}`)
        failed++
      } else {
        console.log(`✅ ${display}`)
        sent++
      }
    } catch (err) {
      console.log(`❌ ${display}: ${err.message}`)
      failed++
    }

    // Rate limit: Resend allows ~10/sec, but be gentle for cold email
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone: ${sent} sent, ${failed} failed`)
}

// --- Main ---
const csvText = readFileSync(csvPath, "utf-8")
const contacts = parseCSV(csvText)

// Filter out very large companies (CEOs won't respond to cold email)
const tooBig = ["Kier Group", "Morgan Sindall", "Balfour Beatty Kilpatrick"]
const filtered = contacts.filter(c => !tooBig.includes(c.Company))

if (process.argv.includes("--send")) {
  await sendEmails(filtered)
} else {
  const md = generateMarkdown(filtered)
  writeFileSync(outputPath, md)
  console.log(`✅ ${filtered.length} email drafts written to ${outputPath}`)
  console.log(`   ${filtered.filter(c => c.Email).length} have email addresses`)
  console.log(`   ${filtered.filter(c => !c.Email).length} need email lookup (see bottom of file)`)
  console.log(`\n   Add emails to the CSV column, then run: node scripts/generate-outreach.mjs --send`)
}