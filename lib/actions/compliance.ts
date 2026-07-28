"use server"
import { requireOrgAction } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { toSafeErrorMessage } from "@/lib/prisma-error"
import { computeComplianceStatus } from "@/lib/compliance-status"

const UpsertDocSchema = z.object({
  subcontractorId: z.string().min(1),
  documentType: z.string().min(1, "Document type required"),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  existingId: z.string().optional(),
  fileUrl: z.string().url().optional().or(z.literal("")),
})

export async function upsertComplianceDoc(formData: FormData) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const raw = {
      subcontractorId: formData.get("subcontractorId") as string,
      documentType: formData.get("documentType") as string,
      issueDate: (formData.get("issueDate") as string) || undefined,
      expiryDate: (formData.get("expiryDate") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
      existingId: (formData.get("existingId") as string) || undefined,
      fileUrl: (formData.get("fileUrl") as string) || undefined,
    }

    const data = UpsertDocSchema.parse(raw)

    // Verify the subcontractor belongs to this org
    const sub = await db.subcontractor.findFirst({
      where: { id: data.subcontractorId, organisationId: org.id },
    })
    if (!sub) throw new Error("Subcontractor not found")

    const status = computeComplianceStatus(data.issueDate, data.expiryDate)

    const fileUrl = data.fileUrl || undefined

    if (data.existingId) {
      const { count } = await db.complianceDocument.updateMany({
        where: { id: data.existingId, subcontractorId: data.subcontractorId },
        data: {
          documentType: data.documentType,
          issueDate: data.issueDate ? new Date(data.issueDate) : null,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
          notes: data.notes ?? null,
          status,
          ...(fileUrl ? { fileUrl } : {}),
        },
      })
      if (count === 0) throw new Error("Compliance document not found")
    } else {
      await db.complianceDocument.create({
        data: {
          subcontractorId: data.subcontractorId,
          documentType: data.documentType,
          issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
          notes: data.notes,
          status,
          fileUrl,
        },
      })
    }

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        userId,
        eventType: data.existingId ? "compliance.doc.updated" : "compliance.doc.created",
        payload: { subcontractorId: data.subcontractorId, documentType: data.documentType, status },
      },
    })

    revalidatePath("/compliance")
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}
