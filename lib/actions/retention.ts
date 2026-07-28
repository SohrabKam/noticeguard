"use server"
import { requireOrgAction } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { toSafeErrorMessage } from "@/lib/prisma-error"

const RetentionReleaseSchema = z.object({
  orderId: z.string().min(1),
  pcReleaseDate: z.string().optional(),
  pcReleaseAmount: z.coerce.number().optional(),
  mcdReleaseDate: z.string().optional(),
  mcdReleaseAmount: z.coerce.number().optional(),
})

export async function updateRetentionDates(formData: FormData) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const raw = {
      orderId: formData.get("orderId") as string,
      pcReleaseDate: (formData.get("pcReleaseDate") as string) || undefined,
      pcReleaseAmount: formData.get("pcReleaseAmount") ? Number(formData.get("pcReleaseAmount")) : undefined,
      mcdReleaseDate: (formData.get("mcdReleaseDate") as string) || undefined,
      mcdReleaseAmount: formData.get("mcdReleaseAmount") ? Number(formData.get("mcdReleaseAmount")) : undefined,
    }

    const data = RetentionReleaseSchema.parse(raw)

    const order = await db.subcontractOrder.findFirst({
      where: { id: data.orderId, organisationId: org.id },
    })
    if (!order) throw new Error("Order not found")

    await db.retentionLedger.update({
      where: { subcontractOrderId: data.orderId },
      data: {
        pcReleaseDate: data.pcReleaseDate ? new Date(data.pcReleaseDate) : undefined,
        pcReleaseAmount: data.pcReleaseAmount,
        mcdReleaseDate: data.mcdReleaseDate ? new Date(data.mcdReleaseDate) : undefined,
        mcdReleaseAmount: data.mcdReleaseAmount,
      },
    })

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: data.orderId,
        userId,
        eventType: "retention.updated",
        payload: {
          pcReleaseDate: data.pcReleaseDate,
          pcReleaseAmount: data.pcReleaseAmount,
          mcdReleaseDate: data.mcdReleaseDate,
          mcdReleaseAmount: data.mcdReleaseAmount,
        },
      },
    })

    revalidatePath(`/subcontracts/${data.orderId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

export async function markRetentionReleased(formData: FormData) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const orderId = formData.get("orderId") as string
    const releaseType = formData.get("releaseType") as "pc" | "mcd"

    const order = await db.subcontractOrder.findFirst({
      where: { id: orderId, organisationId: org.id },
    })
    if (!order) throw new Error("Order not found")

    const now = new Date()

    // Guard against double-release (double-click, retried request): once
    // pcReleasedAt/mcdReleasedAt is set, the ledger has already been
    // decremented for this release and must not be decremented again.
    const result = await db.retentionLedger.updateMany({
      where: {
        subcontractOrderId: orderId,
        ...(releaseType === "pc" ? { pcReleasedAt: null } : { mcdReleasedAt: null }),
      },
      data: {
        ...(releaseType === "pc" ? { pcReleasedAt: now } : { mcdReleasedAt: now }),
      },
    })
    if (result.count === 0) {
      throw new Error(
        `${releaseType === "pc" ? "PC" : "Making good defects"} retention has already been released for this order.`
      )
    }

    const ledger = await db.retentionLedger.findUnique({ where: { subcontractOrderId: orderId } })
    const releaseAmount = ledger
      ? Number((releaseType === "pc" ? ledger.pcReleaseAmount : ledger.mcdReleaseAmount) ?? 0)
      : 0

    if (releaseAmount > 0) {
      await db.retentionLedger.update({
        where: { subcontractOrderId: orderId },
        data: { totalHeld: { decrement: releaseAmount } },
      })
    }

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: orderId,
        userId,
        eventType: `retention.${releaseType}_released`,
        payload: { releasedAt: now },
      },
    })

    revalidatePath(`/subcontracts/${orderId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}
