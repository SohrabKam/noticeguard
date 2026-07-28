import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { streamPrivateBlob } from "@/lib/blob-download"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireOrgRoute()
  if (!authResult.ok) return authResult.response
  const { org } = authResult

  const { id } = await params
  const application = await db.application.findFirst({
    where: {
      id,
      paymentCycle: { paymentSchedule: { subcontractOrder: { organisationId: org.id } } },
    },
  })
  if (!application || !application.attachmentUrl) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return streamPrivateBlob(application.attachmentUrl)
}
