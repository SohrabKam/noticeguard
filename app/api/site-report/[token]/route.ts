import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { z } from "zod"

// Public GET — load a site report by token. No Clerk session: the token
// IS the auth (unguessable 192-bit secret shared only with the site manager).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
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
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })

  return NextResponse.json({
    id: report.id,
    status: report.status,
    submittedAt: report.submittedAt,
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
      photos: l.photos,
    })),
  })
}

const UpdateSchema = z.object({
  lineId: z.string(),
  pctComplete: z.number().min(0).max(100).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
})

// Public PATCH — update a line's % or note. Locked after submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const report = await db.siteReport.findUnique({ where: { token } })
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  if (report.status === "SUBMITTED") return NextResponse.json({ error: "Report is locked" }, { status: 409 })

  const body = UpdateSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  const { lineId, pctComplete, note } = body.data

  const updated = await db.siteReportLine.updateMany({
    where: { id: lineId, siteReportId: report.id },
    data: {
      ...(pctComplete !== undefined ? { pctComplete } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  })
  if (updated.count === 0) return NextResponse.json({ error: "Line not found" }, { status: 404 })

  return NextResponse.json({ ok: true })
}
