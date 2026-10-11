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