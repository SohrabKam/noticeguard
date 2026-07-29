import { NextRequest, NextResponse } from "next/server"
import { requireApiKey } from "@/lib/api-auth"
import { db } from "@/lib/db"
import { serializeComplianceDocument } from "@/lib/api-v1/serializers"
import { computeComplianceStatus } from "@/lib/compliance-status"
import { z } from "zod"

// z.string().url() alone accepts any syntactically valid scheme
// (javascript:, data:, ftp:, ...) — this is rendered as a clickable link in
// the compliance UI, so require https: explicitly rather than trusting URL
// syntax validation alone.
const isHttpsUrl = (url: string) => {
  try {
    return new URL(url).protocol === "https:"
  } catch {
    return false
  }
}

const PushComplianceDocSchema = z.object({
  documentType: z.string().min(1),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  fileUrl: z.string().url().refine(isHttpsUrl, { message: "fileUrl must use https://" }).optional(),
})

// Push (create-or-update) a compliance document for the subcontractor behind
// this subcontract. Upserts on (subcontractorId, documentType) so a system
// re-posting the same document type as its status changes updates the
// existing record instead of accumulating duplicates.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireApiKey(req, { minScope: "WRITE" })
  if (!authResult.ok) return authResult.response
  const { org } = authResult

  const { id } = await params

  const body = PushComplianceDocSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  }
  const data = body.data

  const order = await db.subcontractOrder.findFirst({
    where: { id, organisationId: org.id },
    select: { subcontractorId: true },
  })
  if (!order) return NextResponse.json({ error: "Subcontract not found" }, { status: 404 })

  const status = computeComplianceStatus(data.issueDate, data.expiryDate)
  const existing = await db.complianceDocument.findFirst({
    where: { subcontractorId: order.subcontractorId, documentType: data.documentType },
  })

  const doc = existing
    ? await db.complianceDocument.update({
        where: { id: existing.id },
        data: {
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          notes: data.notes ?? null,
          status,
          ...(data.fileUrl ? { fileUrl: data.fileUrl } : {}),
        },
      })
    : await db.complianceDocument.create({
        data: {
          subcontractorId: order.subcontractorId,
          documentType: data.documentType,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          notes: data.notes,
          status,
          fileUrl: data.fileUrl,
        },
      })

  await db.auditEvent.create({
    data: {
      organisationId: org.id,
      subcontractOrderId: id,
      eventType: existing ? "compliance.doc.updated" : "compliance.doc.created",
      payload: { source: "api", subcontractorId: order.subcontractorId, documentType: data.documentType, status },
    },
  })

  return NextResponse.json({ data: serializeComplianceDocument(doc) }, { status: existing ? 200 : 201 })
}
