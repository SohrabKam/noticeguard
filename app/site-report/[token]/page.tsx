import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { SiteReportClient } from "./client"

// Public page — no login. Auth is the unguessable token in the URL.
// Site manager opens this on their phone, reports % per line, attaches
// timestamped photos, and submits. One-way lock on submit.
export default async function SiteReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const report = await db.siteReport.findUnique({
    where: { token },
    include: {
      lines: { orderBy: { sortOrder: "asc" } },
      paymentCycle: {
        select: {
          cycleNumber: true,
          paymentSchedule: {
            select: {
              subcontractOrder: {
                select: {
                  reference: true,
                  subcontractor: { select: { name: true } },
                  project: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  })
  if (!report) notFound()

  const data = {
    token: report.token,
    status: report.status as string,
    submittedAt: report.submittedAt?.toISOString() ?? null,
    cycleNumber: report.paymentCycle.cycleNumber,
    subcontractRef: report.paymentCycle.paymentSchedule.subcontractOrder.reference,
    subcontractorName: report.paymentCycle.paymentSchedule.subcontractOrder.subcontractor.name,
    projectName: report.paymentCycle.paymentSchedule.subcontractOrder.project.name,
    lines: report.lines.map((l) => ({
      id: l.id,
      sortOrder: l.sortOrder,
      itemRef: l.itemRef,
      description: l.description,
      indentLevel: l.indentLevel,
      contractValue: Number(l.contractValue),
      pctComplete: l.pctComplete !== null ? Number(l.pctComplete) : null,
      note: l.note,
      photos: l.photos as Array<{ url: string; takenAt: string }>,
    })),
  }

  return <SiteReportClient report={data} />
}