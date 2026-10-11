import { db } from "@/lib/db"
import { decryptCredentials } from "./crypto"
import type { AccountingAdapter } from "./adapter-interface"
import type { Connection } from "@/lib/generated/prisma/client"

async function getAdapter(connection: Connection): Promise<AccountingAdapter> {
  const creds = decryptCredentials(connection.credentials as unknown as string)
  switch (connection.provider) {
    case "IPLICIT": {
      const { IplicitAdapter } = await import("./iplicit/adapter")
      return new IplicitAdapter(creds)
    }
    default:
      throw new Error(`Unknown provider: ${connection.provider}`)
  }
}

function id(provider: string, externalId: string): string {
  return `ext_${provider}_${externalId}`
}

const DEFAULT_FROM = "2020-01-01"

export async function syncConnection(connectionId: string): Promise<{
  status: "succeeded" | "failed"
  recordsRead: number
  recordsUpserted: number
  errorMessage?: string
}> {
  const connection = await db.connection.findUnique({
    where: { id: connectionId },
    include: { syncLogs: { orderBy: { startedAt: "desc" }, take: 1 } },
  })
  if (!connection || !connection.isActive) {
    return { status: "failed", recordsRead: 0, recordsUpserted: 0, errorMessage: "Connection not found or inactive" }
  }

  const log = await db.syncLog.create({
    data: { connectionId, status: "RUNNING", startedAt: new Date() },
  })

  try {
    const adapter = await getAdapter(connection)
    await adapter.testConnection()

    const prevCursor = connection.syncLogs[0]?.cursorState as Record<string, unknown> | undefined
    const cursor = {
      lastModifiedFrom: (prevCursor?.lastModifiedFrom as string) ?? new Date('2020-01-01').toISOString(),
      entityCursors: (prevCursor?.entityCursors as Record<string, string>) ?? {},
    }

    const [legalEntities, projects, subcontractors, orders, invoices, payments] = await Promise.all([
      adapter.fetchLegalEntities(cursor),
      adapter.fetchProjects(cursor),
      adapter.fetchSubcontractors(cursor),
      adapter.fetchOrders(cursor),
      adapter.fetchInvoices(cursor),
      adapter.fetchPayments(cursor),
    ])

    let upserted = 0

    // Upsert legal entities
    for (const le of legalEntities) {
      await db.legalEntity.upsert({
        where: {
          organisationId_externalId_provider: {
            organisationId: connection.organisationId,
            externalId: le.externalId,
            provider: connection.provider,
          },
        },
        create: {
          organisationId: connection.organisationId,
          externalId: le.externalId,
          provider: connection.provider,
          name: le.name,
        },
        update: { name: le.name },
      })
      upserted++
    }

    // Upsert projects
    for (const p of projects) {
      const leId = p.legalEntityExternalId
        ? id(connection.provider, p.legalEntityExternalId)
        : null
      await db.project.upsert({
        where: { id: id(connection.provider, p.externalId) },
        create: {
          id: id(connection.provider, p.externalId),
          organisationId: connection.organisationId,
          name: p.name,
          reference: p.reference,
          isActive: p.isActive,
          legalEntityId: leId,
        },
        update: { name: p.name, reference: p.reference, isActive: p.isActive, legalEntityId: leId },
      })
      upserted++
    }

    // Upsert subcontractors
    for (const s of subcontractors) {
      await db.subcontractor.upsert({
        where: { id: id(connection.provider, s.externalId) },
        create: {
          id: id(connection.provider, s.externalId),
          organisationId: connection.organisationId,
          name: s.name,
          companyNumber: s.companyNumber,
          contactEmails: s.contactEmails,
        },
        update: { name: s.name, companyNumber: s.companyNumber, contactEmails: s.contactEmails },
      })
      upserted++
    }

    // Upsert orders (subcontracts)
    for (const o of orders) {
      await db.subcontractOrder.upsert({
        where: { id: id(connection.provider, o.externalId) },
        create: {
          id: id(connection.provider, o.externalId),
          organisationId: connection.organisationId,
          projectId: id(connection.provider, o.projectExternalId),
          subcontractorId: id(connection.provider, o.subcontractorExternalId),
          reference: o.reference,
          description: o.description,
          contractSum: o.contractSum,
          isActive: o.isActive,
          noticeRecipients: [],
          contractForm: "SCHEME_DEFAULT",
        },
        update: { reference: o.reference, description: o.description, contractSum: o.contractSum, isActive: o.isActive },
      })
      upserted++
    }

    // Upsert invoices as applications
    for (const inv of invoices) {
      const existingApp = await db.application.findFirst({
        where: { id: id(connection.provider, inv.externalId) },
      })
      if (existingApp) continue

      const orderId = id(connection.provider, inv.orderExternalId)
      const invDate = new Date(inv.dateReceived)

      const cycle = await db.paymentCycle.findFirst({
        where: {
          paymentSchedule: { subcontractOrderId: orderId },
          status: "AWAITING_APPLICATION",
          applicationExpectedDate: {
            gte: new Date(invDate.getTime() - 14 * 86_400_000),
            lte: new Date(invDate.getTime() + 14 * 86_400_000),
          },
        },
        orderBy: { cycleNumber: "asc" },
      })

      if (cycle) {
        await db.application.create({
          data: {
            id: id(connection.provider, inv.externalId),
            paymentCycleId: cycle.id,
            amountApplied: inv.amount,
            dateReceived: invDate,
            receivedVia: `${connection.provider.toLowerCase()}_sync`,
            notes: inv.notes ?? `Auto-synced from ${connection.provider} (${inv.invoiceNumber})`,
          },
        })
        await db.paymentCycle.update({
          where: { id: cycle.id },
          data: { status: "APPLICATION_RECEIVED" },
        })
        upserted++
      }
    }

    // Mark cycles as paid
    for (const pmt of payments) {
      const appId = pmt.invoiceExternalId
        ? id(connection.provider, pmt.invoiceExternalId)
        : null
      if (!appId) continue

      const app = await db.application.findUnique({ where: { id: appId } })
      if (!app) continue

      const cycle = await db.paymentCycle.findFirst({
        where: { application: { id: app.id }, status: { not: "PAID" } },
      })
      if (cycle) {
        await db.paymentCycle.update({ where: { id: cycle.id }, data: { status: "PAID" } })
        upserted++
      }
    }

    const newCursor = {
      lastModifiedFrom: new Date().toISOString(),
      entityCursors: Object.fromEntries(
        ["project", "subcontractor", "order", "invoice", "payment"].map((k) => [k, new Date().toISOString()])
      ),
    }

    const totalRead = legalEntities.length + projects.length + subcontractors.length + orders.length + invoices.length + payments.length

    await db.syncLog.update({
      where: { id: log.id },
      data: { status: "SUCCEEDED", completedAt: new Date(), recordsRead: totalRead, recordsUpserted: upserted, cursorState: newCursor },
    })
    await db.connection.update({ where: { id: connectionId }, data: { lastSyncedAt: new Date() } })

    return { status: "succeeded", recordsRead: totalRead, recordsUpserted: upserted }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db.syncLog.update({
      where: { id: log.id },
      data: { status: "FAILED", completedAt: new Date(), errorMessage: message },
    })
    return { status: "failed", recordsRead: 0, recordsUpserted: 0, errorMessage: message }
  }
}