import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// Public POST — submit/lock the report. One-way: cannot unsubmit.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const report = await db.siteReport.findUnique({ where: { token } })
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  if (report.status === "SUBMITTED") return NextResponse.json({ error: "Already submitted" }, { status: 409 })

  await db.siteReport.update({
    where: { id: report.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  })

  return NextResponse.json({ ok: true, submittedAt: new Date().toISOString() })
}