import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { sendNoticeEmail } from "@/lib/email/resend"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { escapeHtml } from "@/lib/escape-html"

const ServeSchema = z.object({
  type: z.enum(["payment", "payless"]),
  sumDue: z.number(),
  basis: z.string().optional(),
  serviceMethod: z.enum(["EMAIL", "POST", "HAND"]).optional().default("EMAIL"),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Serving a statutory Payment/Pay-less Notice is a legally binding act —
  // Viewers must not be able to trigger it.
  const authResult = await requireOrgRoute({ minRole: "COMMERCIAL" })
  if (!authResult.ok) return authResult.response
  const { org, userId } = authResult

  const cycle = await db.paymentCycle.findFirst({
    where: {
      id,
      paymentSchedule: { subcontractOrder: { organisationId: org.id } },
    },
    include: {
      paymentSchedule: {
        include: {
          subcontractOrder: {
            include: { subcontractor: true, project: true },
          },
        },
      },
    },
  })
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Statutory notices are a legal record — a paid/closed cycle is done, and
  // a served notice's figures/timestamp must not be silently rewritten.
  if (cycle.status === "PAID" || cycle.status === "CLOSED") {
    return NextResponse.json(
      { error: `Cannot serve a notice on a ${cycle.status.toLowerCase()} cycle.` },
      { status: 409 }
    )
  }

  const body = ServeSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { type, sumDue, basis, serviceMethod } = body.data
  const order = cycle.paymentSchedule.subcontractOrder
  const servedAt = new Date()

  if (type === "payment") {
    const existing = await db.paymentNotice.findUnique({ where: { paymentCycleId: id } })
    if (existing?.status === "SERVED") {
      return NextResponse.json(
        { error: "This Payment Notice has already been served and cannot be modified." },
        { status: 409 }
      )
    }
    if (existing) {
      const { count } = await db.paymentNotice.updateMany({
        where: { paymentCycleId: id, status: { not: "SERVED" } },
        data: { status: "SERVED", sumDue, basis, servedAt, servedByUserId: userId, serviceMethod },
      })
      if (count === 0) {
        return NextResponse.json(
          { error: "This Payment Notice has already been served and cannot be modified." },
          { status: 409 }
        )
      }
    } else {
      await db.paymentNotice.create({
        data: {
          paymentCycleId: id,
          status: "SERVED",
          sumDue,
          basis,
          servedAt,
          servedByUserId: userId,
          serviceMethod,
        },
      })
    }
    await db.paymentCycle.update({ where: { id }, data: { status: "NOTICE_SERVED" } })
    // Lock the assessment so the certified amounts can't be changed post-notice
    await db.assessment.updateMany({ where: { paymentCycleId: id }, data: { isLocked: true } })
  } else {
    const existing = await db.payLessNotice.findUnique({ where: { paymentCycleId: id } })
    if (existing?.status === "SERVED") {
      return NextResponse.json(
        { error: "This Pay Less Notice has already been served and cannot be modified." },
        { status: 409 }
      )
    }
    if (existing) {
      const { count } = await db.payLessNotice.updateMany({
        where: { paymentCycleId: id, status: { not: "SERVED" } },
        data: { status: "SERVED", sumDue, basis, servedAt, servedByUserId: userId, serviceMethod },
      })
      if (count === 0) {
        return NextResponse.json(
          { error: "This Pay Less Notice has already been served and cannot be modified." },
          { status: 409 }
        )
      }
    } else {
      await db.payLessNotice.create({
        data: {
          paymentCycleId: id,
          status: "SERVED",
          sumDue,
          basis,
          servedAt,
          servedByUserId: userId,
          serviceMethod,
        },
      })
    }
    await db.paymentCycle.update({
      where: { id },
      data: { status: "PAY_LESS_SERVED" },
    })
  }

  await db.auditEvent.create({
    data: {
      organisationId: org.id,
      subcontractOrderId: order.id,
      paymentCycleId: id,
      userId,
      eventType: `notice.${type}.served`,
      payload: { sumDue, basis, serviceMethod },
    },
  })

  // Send confirmation to org members (admins/commercial)
  if (process.env.RESEND_API_KEY) {
    const members = await db.orgMember.findMany({
      where: { organisationId: org.id, role: { in: ["ADMIN", "COMMERCIAL"] } },
      select: { email: true },
    })
    const memberEmails = members.map((m) => m.email).filter(Boolean)
    if (memberEmails.length > 0) {
      const noticeLabel = type === "payment" ? "Payment Notice" : "Pay Less Notice"
      const fmtGbp = (n: number) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b">
        <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0">
          <span style="color:#fff;font-size:16px;font-weight:700">NoticeGuard — Notice served</span>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">
          <p style="margin:0 0 12px;font-size:14px">A <strong>${noticeLabel}</strong> has been recorded for ${escapeHtml(order.reference)} — Cycle #${cycle.cycleNumber}.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:5px 0;color:#64748b;width:160px">Subcontractor</td><td style="padding:5px 0;font-weight:600">${escapeHtml(order.subcontractor.name)}</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">Project</td><td style="padding:5px 0">${escapeHtml(order.project.name)}</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">Sum</td><td style="padding:5px 0;font-weight:700">${fmtGbp(sumDue)}</td></tr>
            <tr><td style="padding:5px 0;color:#64748b">Served at</td><td style="padding:5px 0">${servedAt.toLocaleString("en-GB")}</td></tr>
          </table>
          <p style="margin-top:16px;font-size:12px;color:#94a3b8">This is an automated confirmation from NoticeGuard.</p>
        </div>
      </div>`
      try {
        await sendNoticeEmail({
          to: memberEmails,
          from: org.fromEmail ?? "notices@noticeguard.app",
          fromName: "NoticeGuard",
          subject: `✓ ${noticeLabel} recorded — ${order.reference} Cycle #${cycle.cycleNumber}`,
          html,
        })
      } catch { /* non-fatal */ }
    }
  }

  // Send email to subcontractor + any additional configured recipients (only if served by email)
  const recipients = [...new Set([...order.subcontractor.contactEmails, ...order.noticeRecipients])]
  if (serviceMethod === "EMAIL" && recipients.length > 0 && process.env.RESEND_API_KEY) {
    const noticeLabel = type === "payment" ? "Payment Notice" : "Pay Less Notice"
    const html = buildNoticeHtml({
      type,
      noticeLabel,
      subcontractorName: order.subcontractor.name,
      projectName: order.project.name,
      reference: order.reference,
      cycleNumber: cycle.cycleNumber,
      sumDue,
      basis: basis ?? "",
      servedAt,
      finalDateForPayment: new Date(cycle.finalDateForPayment),
      payLessDeadline: new Date(cycle.payLessDeadline),
      orgName: org.name,
      fromName: org.fromName ?? org.name,
      signatory: order.signatory ?? undefined,
    })

    try {
      const emailResult = await sendNoticeEmail({
        to: recipients,
        from: org.fromEmail ?? "notices@noticeguard.app",
        fromName: org.fromName ?? org.name,
        subject: `${noticeLabel} — ${order.reference} Cycle #${cycle.cycleNumber}`,
        html,
      })
      // Store the Resend email ID so delivery webhooks can match back to this notice.
      // resend@6 emails.send() returns { data: { id }, error } — not a bare { id }.
      const emailId = emailResult?.data?.id
      if (emailId) {
        if (type === "payment") {
          await db.paymentNotice.update({ where: { paymentCycleId: id }, data: { deliveryLogId: emailId } })
        } else {
          await db.payLessNotice.update({ where: { paymentCycleId: id }, data: { deliveryLogId: emailId } })
        }
      }
    } catch {
      // Email failure is non-fatal; the notice is still recorded
    }
  }

  return NextResponse.json({ ok: true })
}

function buildNoticeHtml(p: {
  type: string
  noticeLabel: string
  subcontractorName: string
  projectName: string
  reference: string
  cycleNumber: number
  sumDue: number
  basis: string
  servedAt: Date
  finalDateForPayment: Date
  payLessDeadline: Date
  orgName: string
  fromName: string
  signatory?: string
}) {
  const fmtGbp = (n: number) =>
    `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Every tenant-editable value below must be escaped before interpolation —
  // this is a legally-binding notice built by string templating, not a
  // component tree that escapes by default.
  p = {
    ...p,
    subcontractorName: escapeHtml(p.subcontractorName),
    projectName: escapeHtml(p.projectName),
    reference: escapeHtml(p.reference),
    basis: escapeHtml(p.basis),
    orgName: escapeHtml(p.orgName),
    fromName: escapeHtml(p.fromName),
    signatory: p.signatory ? escapeHtml(p.signatory) : p.signatory,
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif">
<div style="max-width:600px;margin:32px auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
  <div style="background:#1e293b;padding:20px 28px">
    <span style="color:#fff;font-size:18px;font-weight:700">${p.orgName}</span>
    <span style="color:#94a3b8;font-size:13px;margin-left:12px">via NoticeGuard</span>
  </div>
  <div style="padding:28px">
    <h1 style="margin:0 0 4px;font-size:20px;color:#1e293b">${p.noticeLabel}</h1>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px">
      ${p.reference} &mdash; Payment Cycle #${p.cycleNumber}
    </p>

    <p style="font-size:14px;color:#1e293b;line-height:1.6">Dear ${p.subcontractorName},</p>
    <p style="font-size:14px;color:#1e293b;line-height:1.6">
      ${p.type === "payment"
        ? `We hereby give you notice under the Housing Grants, Construction and Regeneration Act 1996 of the sum we propose to pay in respect of the above payment cycle.`
        : `We hereby give you notice under the Housing Grants, Construction and Regeneration Act 1996 that we intend to pay less than the notified sum in respect of the above payment cycle.`}
    </p>

    <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px">
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b;width:200px">Project</td>
        <td style="padding:10px 0;font-weight:600;color:#1e293b">${p.projectName}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b">Subcontract reference</td>
        <td style="padding:10px 0;font-weight:600;color:#1e293b">${p.reference}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b">Payment cycle</td>
        <td style="padding:10px 0;color:#1e293b">#${p.cycleNumber}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b">${p.type === "payment" ? "Sum proposed to be paid" : "Sum we intend to pay"}</td>
        <td style="padding:10px 0;font-weight:700;color:#1e293b;font-size:16px">${fmtGbp(p.sumDue)}</td>
      </tr>
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b">Final date for payment</td>
        <td style="padding:10px 0;color:#1e293b">${formatDate(p.finalDateForPayment)}</td>
      </tr>
      ${p.type === "payless" ? `
      <tr style="border-bottom:1px solid #e2e8f0">
        <td style="padding:10px 0;color:#64748b">Pay less notice date</td>
        <td style="padding:10px 0;color:#1e293b">${formatDate(p.payLessDeadline)}</td>
      </tr>` : ""}
    </table>

    ${p.basis ? `
    <div style="background:#f8fafc;border-left:3px solid #6366f1;padding:12px 16px;margin:20px 0;border-radius:0 4px 4px 0">
      <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#64748b">BASIS OF ASSESSMENT</p>
      <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6">${p.basis}</p>
    </div>` : ""}

    <p style="font-size:14px;color:#1e293b;line-height:1.6">
      This notice was served on ${p.servedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      at ${p.servedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
    </p>

    ${p.signatory ? `
    <p style="font-size:14px;color:#1e293b;margin-top:24px">
      Yours faithfully,<br><br>
      <strong>${p.signatory}</strong><br>
      <span style="color:#64748b;font-size:13px">${p.orgName}</span>
    </p>` : ""}

    <p style="font-size:13px;color:#94a3b8;margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0">
      Sent on behalf of ${p.fromName} via NoticeGuard. This document is served for the purposes of the
      Housing Grants, Construction and Regeneration Act 1996. NoticeGuard does not provide legal advice.
    </p>
  </div>
</div>
</body>
</html>`
}
