import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { toCsv } from "@/lib/csv"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await requireOrgRoute()
  if (!authResult.ok) return authResult.response
  const { org } = authResult

  const order = await db.subcontractOrder.findFirst({
    where: { id, organisationId: org.id },
    include: {
      project: { select: { name: true } },
      subcontractor: { select: { name: true } },
      paymentSchedule: {
        include: {
          cycles: {
            orderBy: { cycleNumber: "asc" },
            include: {
              application: { select: { amountApplied: true, dateReceived: true } },
              paymentNotice: { select: { status: true, sumDue: true, servedAt: true } },
              payLessNotice: { select: { status: true, sumDue: true, servedAt: true } },
            },
          },
        },
      },
    },
  })

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const cycles = order.paymentSchedule?.cycles ?? []

  const headers = [
    "Cycle",
    "Status",
    "Application expected",
    "PN deadline",
    "Pay-less deadline",
    "Final date for payment",
    "Amount applied",
    "Application received",
    "Notice type",
    "Sum certified",
    "Notice served at",
  ]

  const rows = cycles.map((c) => {
    const hasPayLess = c.payLessNotice?.status === "SERVED"
    const notice = hasPayLess ? c.payLessNotice : c.paymentNotice?.status === "SERVED" ? c.paymentNotice : null
    const noticeType = hasPayLess ? "Pay-less" : c.paymentNotice?.status === "SERVED" ? "Payment" : ""

    return [
      `#${c.cycleNumber}`,
      c.status.replace(/_/g, " "),
      formatDate(new Date(c.applicationExpectedDate)),
      formatDate(new Date(c.paymentNoticeDeadline)),
      formatDate(new Date(c.payLessDeadline)),
      formatDate(new Date(c.finalDateForPayment)),
      c.application?.amountApplied != null
        ? Number(c.application.amountApplied).toFixed(2)
        : "",
      c.application?.dateReceived
        ? formatDate(new Date(c.application.dateReceived))
        : "",
      noticeType,
      notice?.sumDue != null ? Number(notice.sumDue).toFixed(2) : "",
      notice?.servedAt
        ? new Date(notice.servedAt as unknown as string).toLocaleString("en-GB")
        : "",
    ]
  })

  const csv = toCsv([headers, ...rows])

  const filename = `${order.reference.replace(/[^a-z0-9-]/gi, "_")}_cycles.csv`

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  })
}
