import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { streamPrivateBlob } from "@/lib/blob-download"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; index: string }> }
) {
  const authResult = await requireOrgRoute()
  if (!authResult.ok) return authResult.response
  const { org } = authResult

  const { id, index: indexParam } = await params
  const index = Number(indexParam)
  if (!Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "Invalid attachment index" }, { status: 400 })
  }

  const variation = await db.variation.findFirst({
    where: { id, subcontractOrder: { organisationId: org.id } },
  })
  const url = variation?.attachmentUrls[index]
  if (!url) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return streamPrivateBlob(url)
}
