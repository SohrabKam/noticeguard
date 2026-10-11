"use server"

import { revalidatePath } from "next/cache"
import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { encryptCredentials } from "@/lib/integrations/crypto"
import type { ConnectionProvider } from "@/lib/generated/prisma/client"

export async function createConnection(formData: FormData) {
  const { org } = await requireOrg()

  const provider = formData.get("provider") as ConnectionProvider
  const label = formData.get("label") as string
  const domain = formData.get("domain") as string
  const username = formData.get("username") as string
  const userApiKey = formData.get("userApiKey") as string

  if (!provider || !label || !domain || !username || !userApiKey) {
    return { error: "All fields are required" }
  }

  const encrypted = encryptCredentials({ domain, username, userApiKey })

  await db.connection.create({
    data: {
      organisationId: org.id,
      provider,
      label,
      credentials: encrypted,
    },
  })

  revalidatePath("/settings/connections")
  return { ok: true }
}

export async function deleteConnection(formData: FormData) {
  const { org } = await requireOrg()
  const id = formData.get("id") as string

  const conn = await db.connection.findUnique({ where: { id } })
  if (!conn || conn.organisationId !== org.id) {
    return { error: "Connection not found" }
  }

  await db.connection.delete({ where: { id } })
  revalidatePath("/settings/connections")
  return { ok: true }
}

export async function testConnection(formData: FormData) {
  const { org } = await requireOrg()

  const provider = formData.get("provider") as ConnectionProvider
  const domain = formData.get("domain") as string
  const username = formData.get("username") as string
  const userApiKey = formData.get("userApiKey") as string

  if (!provider || !domain || !username || !userApiKey) {
    return { error: "All fields are required" }
  }

  try {
    let adapter: import("@/lib/integrations/adapter-interface").AccountingAdapter
    switch (provider) {
      case "IPLICIT": {
        const { IplicitAdapter } = await import("@/lib/integrations/iplicit/adapter")
        adapter = new IplicitAdapter({ domain, username, userApiKey })
        break
      }
      default:
        return { error: `Unknown provider: ${provider}` }
    }
    await adapter.testConnection()
    return { ok: true }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function triggerManualSync(formData: FormData) {
  const { org } = await requireOrg()
  const id = formData.get("id") as string

  const conn = await db.connection.findUnique({ where: { id } })
  if (!conn || conn.organisationId !== org.id) {
    return { error: "Connection not found" }
  }

  const { syncConnection } = await import("@/lib/integrations/sync-engine")
  const result = await syncConnection(id)
  revalidatePath("/settings/connections")
  return result
}
export async function pushSubcontractToProvider(subcontractOrderId: string) {
  const { org } = await requireOrg()

  const order = await db.subcontractOrder.findUnique({
    where: { id: subcontractOrderId, organisationId: org.id },
    include: { project: true, subcontractor: true },
  })
  if (!order) return { error: "Subcontract not found" }

  // Find active iplicit connection
  const connection = await db.connection.findFirst({
    where: { organisationId: org.id, provider: "IPLICIT", isActive: true },
  })
  if (!connection) return { error: "No active iplicit connection found. Set one up in Settings → Integrations." }

  // Extract iplicit external IDs from composite IDs
  const extractExternalId = (compositeId: string): string | null => {
    const match = compositeId.match(/^ext_IPLICIT_(.+)$/)
    return match ? match[1] : null
  }

  const iplicitSubId = extractExternalId(order.subcontractorId)
  const iplicitProjId = extractExternalId(order.projectId)

  if (!iplicitSubId) {
    return { error: "Subcontractor is not linked to iplicit. Sync from iplicit first or link manually." }
  }

  try {
    const { IplicitWriter } = await import("@/lib/integrations/iplicit/writer")
    const writer = new IplicitWriter(connection)

    const result = await writer.createPurchaseOrder({
      docTypeId: "APPO",
      contactAccountId: iplicitSubId,
      projectId: iplicitProjId ?? undefined,
      docNo: order.reference,
      description: order.description ?? undefined,
      docDate: new Date().toISOString(),
      amount: Number(order.contractSum),
    })

    // Store the iplicit PO ID as a note/field on the order
    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: order.id,
        eventType: "integration.pushed",
        payload: {
          provider: "IPLICIT",
          iplicitPoId: result.id,
          iplicitDocNo: result.docNo,
        },
      },
    })

    revalidatePath(`/subcontracts/${order.id}`)
    revalidatePath("/subcontracts")
    return { ok: true, iplicitId: result.id, iplicitDocNo: result.docNo }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { error: msg }
  }
}
