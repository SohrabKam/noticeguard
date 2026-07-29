import { NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { getRagStatus } from "@/lib/dashboard"
import { differenceInCalendarDays } from "date-fns"
import { toCsv } from "@/lib/csv"

const LIVE_STATUSES = [
  "AWAITING_APPLICATION",
  "APPLICATION_RECEIVED",
  "UNDER_ASSESSMENT",
  "NOTICE_SERVED",
  "PAY_LESS_SERVED",
] as const

export async function GET() {
  const authResult = await requireOrgRoute()
  if (!authResult.ok) return authResult.response
  const { org } = authResult

  const now = new Date()

  const cycles = await db.paymentCycle.findMany({
    where: {
      status: { in: [...LIVE_STATUSES] },
      paymentSchedule: { subcontractOrder: { organisationId: org.id, isActive: true } },
    },
    include: {
      paymentSchedule: {
        include: {
          subcontractOrder: {
            include: {
              project: { select: { name: true } },
              subcontractor: { select: { name: true } },
            },
          },
        },
      },
      application: { select: { amountApplied: true, dateReceived: true, receivedVia: true } },
      paymentNotice: { select: { status: true, sumDue: true, servedAt: true, serviceMethod: true } },
      payLessNotice: { select: { status: true, sumDue: true, servedAt: true, serviceMethod: true } },
    },
    orderBy: { paymentNoticeDeadline: "asc" },
  })

  const headers = [
    "Subcontractor",
    "Project",
    "Reference",
    "Cycle #",
    "Status",
    "RAG",
    "Days to deadline",
    "Application expected",
    "PN deadline",
    "Pay-less deadline",
    "Final date for payment",
    "Amount applied (£)",
    "Application received",
    "Received via",
    "Notice type",
    "Sum certified (£)",
    "Notice served at",
    "Service method",
  ]

  const rows = cycles.map((c) => {
    const order = c.paymentSchedule.subcontractOrder
    const rag = getRagStatus(new Date(c.paymentNoticeDeadline), now)
    const daysUntil = differenceInCalendarDays(new Date(c.paymentNoticeDeadline), now)
    const hasPayLess = c.payLessNotice?.status === "SERVED"
    const notice = hasPayLess ? c.payLessNotice : c.paymentNotice?.status === "SERVED" ? c.paymentNotice : null
    const noticeType = hasPayLess ? "Pay-less" : c.paymentNotice?.status === "SERVED" ? "Payment" : ""

    return [
      order.subcontractor.name,
      order.project.name,
      order.reference,
      `${c.cycleNumber}`,
      c.status.replace(/_/g, " "),
      rag.toUpperCase(),
      daysUntil < 0 ? `+${Math.abs(daysUntil)} overdue` : `${daysUntil}`,
      formatDate(new Date(c.applicationExpectedDate)),
      formatDate(new Date(c.paymentNoticeDeadline)),
      formatDate(new Date(c.payLessDeadline)),
      formatDate(new Date(c.finalDateForPayment)),
      c.application?.amountApplied != null ? Number(c.application.amountApplied).toFixed(2) : "",
      c.application?.dateReceived ? formatDate(new Date(c.application.dateReceived)) : "",
      c.application?.receivedVia ?? "",
      noticeType,
      notice?.sumDue != null ? Number(notice.sumDue).toFixed(2) : "",
      notice?.servedAt ? new Date(notice.servedAt as unknown as string).toLocaleString("en-GB") : "",
      notice?.serviceMethod ?? "",
    ]
  })

  const csv = toCsv([headers, ...rows])

  const dateStr = now.toISOString().split("T")[0]
  const filename = `${org.name.replace(/[^a-z0-9-]/gi, "_")}_compliance_${dateStr}.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
