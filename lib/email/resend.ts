import { Resend } from "resend"
import { formatDate } from "@/lib/dates/uk-bank-holidays"

export const resend = new Resend(process.env.RESEND_API_KEY)

export type DeadlineAlertPayload = {
  to: string[]
  subcontractorName: string
  projectName: string
  cycleNumber: number
  deadlineLabel: string
  deadlineDate: Date
  daysUntil: number
  cycleUrl: string
  orgName: string
}

export async function sendDeadlineAlert(payload: DeadlineAlertPayload) {
  const urgency = payload.daysUntil <= 0 ? "BREACHED" : payload.daysUntil <= 2 ? "URGENT" : "Due soon"
  const subject = `[${urgency}] ${payload.deadlineLabel} — ${payload.subcontractorName} Cycle #${payload.cycleNumber}`

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="color:#fff;font-size:18px;font-weight:700">NoticeGuard</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <div style="background:${payload.daysUntil <= 0 ? "#fee2e2" : payload.daysUntil <= 2 ? "#fef2f2" : "#fef9c3"};border-radius:6px;padding:12px 16px;margin-bottom:20px">
          <strong>${urgency}:</strong> ${payload.deadlineLabel}
          ${payload.daysUntil <= 0 ? `<br><span style="color:#dc2626">Deadline has passed by ${Math.abs(payload.daysUntil)} day(s)</span>` : `<br>Due in <strong>${payload.daysUntil} day(s)</strong>`}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b;width:160px">Subcontractor</td><td style="padding:6px 0;font-weight:600">${payload.subcontractorName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Project</td><td style="padding:6px 0">${payload.projectName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Payment cycle</td><td style="padding:6px 0">#${payload.cycleNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Deadline</td><td style="padding:6px 0;font-weight:600">${formatDate(payload.deadlineDate)}</td></tr>
        </table>
        <div style="margin-top:24px">
          <a href="${payload.cycleUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open cycle workspace →</a>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">
          NoticeGuard tracks deadlines — it does not provide legal advice. Review all notices against your contract terms.
        </p>
      </div>
    </div>
  `

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "notices@noticeguard.app",
    to: payload.to,
    subject,
    html,
  })
}

export type DocExpiryAlertPayload = {
  to: string[]
  subcontractorName: string
  documentType: string
  expiryDate: Date
  daysUntil: number
  orgName: string
}

export async function sendDocExpiryAlert(payload: DocExpiryAlertPayload) {
  const urgency = payload.daysUntil <= 7 ? "URGENT" : payload.daysUntil <= 14 ? "Expiring soon" : "Expiry notice"
  const subject = `[${urgency}] ${payload.documentType} expiring — ${payload.subcontractorName}`

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="color:#fff;font-size:18px;font-weight:700">NoticeGuard</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <div style="background:${payload.daysUntil <= 7 ? "#fef2f2" : "#fef9c3"};border-radius:6px;padding:12px 16px;margin-bottom:20px">
          <strong>${urgency}:</strong> ${payload.documentType} for ${payload.subcontractorName}
          <br>Expires in <strong>${payload.daysUntil} day(s)</strong> on ${formatDate(payload.expiryDate)}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b;width:160px">Subcontractor</td><td style="padding:6px 0;font-weight:600">${payload.subcontractorName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Document</td><td style="padding:6px 0">${payload.documentType}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Expiry date</td><td style="padding:6px 0;font-weight:600">${formatDate(payload.expiryDate)}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Days remaining</td><td style="padding:6px 0">${payload.daysUntil}</td></tr>
        </table>
        <p style="margin-top:20px;font-size:14px;color:#1e293b">
          Please request an updated certificate from ${payload.subcontractorName} and upload it to the compliance documents section.
        </p>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">
          Sent by NoticeGuard on behalf of ${payload.orgName}.
        </p>
      </div>
    </div>
  `

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "notices@noticeguard.app",
    to: payload.to,
    subject,
    html,
  })
}

export type MissedApplicationAlertPayload = {
  to: string[]
  subcontractorName: string
  projectName: string
  cycleNumber: number
  applicationExpectedDate: Date
  paymentNoticeDeadline: Date
  daysOverdue: number
  cycleUrl: string
  orgName: string
}

export async function sendMissedApplicationAlert(payload: MissedApplicationAlertPayload) {
  const subject = `[ACTION] No application received — ${payload.subcontractorName} Cycle #${payload.cycleNumber}`
  const pnDeadline = payload.paymentNoticeDeadline.toLocaleDateString("en-GB", { dateStyle: "long" })

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="color:#fff;font-size:18px;font-weight:700">NoticeGuard</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:12px 16px;margin-bottom:20px">
          <strong>No application received</strong> from ${payload.subcontractorName}
          <br>Expected ${payload.daysOverdue} day(s) ago. You may need to issue a payment notice based on your own assessment.
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:6px 0;color:#64748b;width:180px">Subcontractor</td><td style="padding:6px 0;font-weight:600">${payload.subcontractorName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Project</td><td style="padding:6px 0">${payload.projectName}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Payment cycle</td><td style="padding:6px 0">#${payload.cycleNumber}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">Application due</td><td style="padding:6px 0">${payload.applicationExpectedDate.toLocaleDateString("en-GB", { dateStyle: "long" })}</td></tr>
          <tr><td style="padding:6px 0;color:#64748b">PN deadline</td><td style="padding:6px 0;font-weight:600;color:#dc2626">${pnDeadline}</td></tr>
        </table>
        <p style="margin-top:16px;font-size:14px;color:#1e293b">
          Under the Scheme for Construction Contracts, you are entitled to issue a payment notice based on your own valuation where no application has been received.
        </p>
        <div style="margin-top:20px">
          <a href="${payload.cycleUrl}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open cycle workspace →</a>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">
          NoticeGuard tracks deadlines — it does not provide legal advice. Review all notices against your contract terms.
        </p>
      </div>
    </div>
  `

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "notices@noticeguard.app",
    to: payload.to,
    subject,
    html,
  })
}

export type DailyDigestPayload = {
  to: string[]
  orgName: string
  appUrl: string
  breached: Array<{ subcontractorName: string; projectName: string; cycleNumber: number; label: string; daysOverdue: number; id: string }>
  urgent: Array<{ subcontractorName: string; projectName: string; cycleNumber: number; label: string; daysUntil: number; id: string }>
  dueSoon: Array<{ subcontractorName: string; projectName: string; cycleNumber: number; label: string; daysUntil: number; id: string }>
  totalLive: number
}

export async function sendDailyDigest(payload: DailyDigestPayload) {
  const { breached, urgent, dueSoon, orgName } = payload
  const issuesCount = breached.length + urgent.length + dueSoon.length

  const subject = issuesCount > 0
    ? `[NoticeGuard] ${issuesCount} cycle${issuesCount !== 1 ? "s" : ""} need${issuesCount === 1 ? "s" : ""} attention today`
    : `[NoticeGuard] Daily digest — all ${payload.totalLive} cycle${payload.totalLive !== 1 ? "s" : ""} on track`

  function cycleRow(c: { subcontractorName: string; projectName: string; cycleNumber: number; label: string; id: string }, badge: string, detail: string) {
    return `
      <tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:8px 0;font-weight:600">${c.subcontractorName}</td>
        <td style="padding:8px 0;color:#64748b">${c.projectName}</td>
        <td style="padding:8px 0;color:#64748b">#${c.cycleNumber}</td>
        <td style="padding:8px 0">
          <span style="display:inline-block;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;${badge}">${detail}</span>
        </td>
        <td style="padding:8px 0">
          <a href="${payload.appUrl}/cycles/${c.id}" style="color:#4f46e5;font-size:13px;text-decoration:none">Open →</a>
        </td>
      </tr>`
  }

  const html = `
    <div style="font-family:sans-serif;max-width:680px;margin:0 auto;color:#1e293b">
      <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
        <span style="color:#fff;font-size:18px;font-weight:700">NoticeGuard</span>
        <span style="color:#94a3b8;font-size:13px;margin-left:12px">Daily digest</span>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 20px;font-size:15px">Good morning — here is your compliance summary for today.</p>

        ${breached.length > 0 ? `
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.05em">Breached (${breached.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
          <tbody>${breached.map((c) => cycleRow(c, "background:#fee2e2;color:#dc2626", `${Math.abs((c as { daysOverdue: number }).daysOverdue)}d overdue`)).join("")}</tbody>
        </table>` : ""}

        ${urgent.length > 0 ? `
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.05em">Urgent — ≤2 days (${urgent.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
          <tbody>${urgent.map((c) => cycleRow(c, "background:#fef2f2;color:#ef4444", `${(c as { daysUntil: number }).daysUntil}d`)).join("")}</tbody>
        </table>` : ""}

        ${dueSoon.length > 0 ? `
        <h3 style="margin:0 0 8px;font-size:13px;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:0.05em">Due soon — ≤5 days (${dueSoon.length})</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
          <tbody>${dueSoon.map((c) => cycleRow(c, "background:#fef9c3;color:#d97706", `${(c as { daysUntil: number }).daysUntil}d`)).join("")}</tbody>
        </table>` : ""}

        ${issuesCount === 0 ? `
        <div style="background:#f0fdf4;border-radius:6px;padding:14px 18px;margin-bottom:20px">
          <span style="color:#16a34a;font-weight:600">✓ All ${payload.totalLive} live cycle${payload.totalLive !== 1 ? "s" : ""} are on track.</span>
        </div>` : ""}

        <div style="margin-top:20px">
          <a href="${payload.appUrl}/dashboard" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">Open dashboard →</a>
        </div>
        <p style="margin-top:24px;font-size:12px;color:#94a3b8">
          Sent by NoticeGuard on behalf of ${orgName}. NoticeGuard tracks deadlines — it does not provide legal advice.
        </p>
      </div>
    </div>
  `

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "notices@noticeguard.app",
    to: payload.to,
    subject,
    html,
  })
}

export async function sendNoticeEmail(payload: {
  to: string[]
  from: string
  fromName: string
  subject: string
  html: string
  pdfAttachment?: { filename: string; content: Buffer }
}) {
  return resend.emails.send({
    from: `${payload.fromName} <${payload.from}>`,
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    attachments: payload.pdfAttachment
      ? [{ filename: payload.pdfAttachment.filename, content: payload.pdfAttachment.content }]
      : undefined,
  })
}
