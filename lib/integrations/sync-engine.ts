import { db } from "@/lib/db"
import { decryptCredentials } from "./crypto"
import type { AccountingAdapter } from "./adapter-interface"
import type { Connection, ConnectionProvider } from "@/lib/generated/prisma/client"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function extId(provider: string, externalId: string): string {
  return `ext_${provider}_${externalId}`
}

const MAX_CONSECUTIVE_FAILURES = 3

interface EntityResult {
  count: number
  upserted: number
  errors: string[]
}

// ─── Auth failure detection ──────────────────────────────────────────────────

function isAuthError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error)
  return /401|403|auth|unauthorised|unauthorized|invalid.*key|token.*expired/i.test(msg)
}

// ─── Per-entity safe fetch — isolates failures ───────────────────────────────

async function safeFetch<T>(
  label: string,
  fn: () => Promise<T[]>
): Promise<{ data: T[]; error?: string }> {
  try {
    const data = await fn()
    return { data }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    return { data: [], error: `[${label}] ${msg}` }
  }
}

// ─── Conflict resolution: name matching ──────────────────────────────────────

async function findByNameMatch(
  provider: ConnectionProvider,
  orgId: string,
  name: string,
  table: "project" | "subcontractor"
): Promise<string | null> {
  const existing = table === "project"
    ? await db.project.findFirst({
        where: { organisationId: orgId, name, id: { not: { startsWith: "ext_" } } },
        select: { id: true },
      })
    : await db.subcontractor.findFirst({
        where: { organisationId: orgId, name, id: { not: { startsWith: "ext_" } } },
        select: { id: true },
      })
  return existing?.id ?? null
}

// ─── Main sync function ──────────────────────────────────────────────────────

export async function syncConnection(connectionId: string): Promise<{
  status: "succeeded" | "failed" | "partial"
  recordsRead: number
  recordsUpserted: number
  errorMessage?: string
  warnings: string[]
}> {
  const warnings: string[] = []
  const errors: string[] = []

  const connection = await db.connection.findUnique({
    where: { id: connectionId },
    include: { syncLogs: { orderBy: { startedAt: "desc" }, take: MAX_CONSECUTIVE_FAILURES + 1 } },
  })

  if (!connection || !connection.isActive) {
    return { status: "failed", recordsRead: 0, recordsUpserted: 0, errorMessage: "Connection not found or inactive", warnings: [] }
  }

  // Check consecutive failures — if last N all failed, skip and alert
  const recentLogs = connection.syncLogs.slice(0, MAX_CONSECUTIVE_FAILURES)
  if (recentLogs.length >= MAX_CONSECUTIVE_FAILURES && recentLogs.every((l) => l.status === "FAILED")) {
    return {
      status: "failed",
      recordsRead: 0,
      recordsUpserted: 0,
      errorMessage: `Sync skipped: ${MAX_CONSECUTIVE_FAILURES} consecutive failures. Check credentials.`,
      warnings,
    }
  }

  const log = await db.syncLog.create({
    data: { connectionId, status: "RUNNING", startedAt: new Date() },
  })

  let adapter: AccountingAdapter
  try {
    adapter = await getAdapter(connection)
    await adapter.testConnection()
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const status = isAuthError(error) ? "FAILED" : "FAILED"

    await db.syncLog.update({
      where: { id: log.id },
      data: { status, completedAt: new Date(), errorMessage: msg, recordsRead: 0, recordsUpserted: 0 },
    })

    return { status: "failed", recordsRead: 0, recordsUpserted: 0, errorMessage: msg, warnings: [] }
  }

  const prevCursor = connection.syncLogs
    .find((l) => l.status === "SUCCEEDED")
    ?.cursorState as Record<string, unknown> | undefined

  const cursor = {
    lastModifiedFrom: (prevCursor?.lastModifiedFrom as string) ?? new Date("2020-01-01").toISOString(),
    entityCursors: (prevCursor?.entityCursors as Record<string, string>) ?? {},
  }

  // ─── Fetch all entities with per-type isolation ────────────────────────────

  const [
    leResult, projResult, subResult, orderResult, invResult, pmtResult,
  ] = await Promise.all([
    safeFetch("legalEntities", () => adapter.fetchLegalEntities(cursor)),
    safeFetch("projects", () => adapter.fetchProjects(cursor)),
    safeFetch("subcontractors", () => adapter.fetchSubcontractors(cursor)),
    safeFetch("orders", () => adapter.fetchOrders(cursor)),
    safeFetch("invoices", () => adapter.fetchInvoices(cursor)),
    safeFetch("payments", () => adapter.fetchPayments(cursor)),
  ])

  // Collect fetch errors
  for (const r of [leResult, projResult, subResult, orderResult, invResult, pmtResult]) {
    if (r.error) errors.push(r.error)
  }

  let upserted = 0

  // ─── Upsert legal entities ─────────────────────────────────────────────────
  for (const le of leResult.data) {
    try {
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
    } catch (e) {
      errors.push(`legalEntity ${le.externalId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Upsert projects (with name-matching for manual duplicates) ────────────
  for (const p of projResult.data) {
    try {
      const leId = p.legalEntityExternalId ? extId(connection.provider, p.legalEntityExternalId) : null

      // Check if a manually-created project with same name already exists
      const matchedId = await findByNameMatch(connection.provider, connection.organisationId, p.name, "project")
      if (matchedId) {
        // Update manual record with sync data (merge: only sync-specific fields)
        await db.project.update({
          where: { id: matchedId },
          data: { reference: p.reference ?? undefined, legalEntityId: leId ?? undefined },
        })
        warnings.push(`project "${p.name}" linked to existing manual record (${matchedId})`)
        upserted++
        continue
      }

      await db.project.upsert({
        where: { id: extId(connection.provider, p.externalId) },
        create: {
          id: extId(connection.provider, p.externalId),
          organisationId: connection.organisationId,
          name: p.name,
          reference: p.reference,
          isActive: p.isActive,
          legalEntityId: leId,
        },
        update: { name: p.name, reference: p.reference, isActive: p.isActive, legalEntityId: leId },
      })
      upserted++
    } catch (e) {
      errors.push(`project ${p.externalId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Upsert subcontractors (with name-matching) ────────────────────────────
  for (const s of subResult.data) {
    try {
      const matchedId = await findByNameMatch(connection.provider, connection.organisationId, s.name, "subcontractor")
      if (matchedId) {
        await db.subcontractor.update({
          where: { id: matchedId },
          data: {
            companyNumber: s.companyNumber ?? undefined,
            contactEmails: s.contactEmails.length > 0 ? s.contactEmails : undefined,
          },
        })
        warnings.push(`subcontractor "${s.name}" linked to existing manual record (${matchedId})`)
        upserted++
        continue
      }

      await db.subcontractor.upsert({
        where: { id: extId(connection.provider, s.externalId) },
        create: {
          id: extId(connection.provider, s.externalId),
          organisationId: connection.organisationId,
          name: s.name,
          companyNumber: s.companyNumber,
          contactEmails: s.contactEmails,
        },
        update: { name: s.name, companyNumber: s.companyNumber, contactEmails: s.contactEmails },
      })
      upserted++
    } catch (e) {
      errors.push(`subcontractor ${s.externalId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Upsert orders (with FK validation) ────────────────────────────────────
  for (const o of orderResult.data) {
    try {
      const projId = extId(connection.provider, o.projectExternalId)
      const subId = extId(connection.provider, o.subcontractorExternalId)

      // Verify FK references exist (or were name-matched)
      const projectExists = await db.project.findUnique({ where: { id: projId }, select: { id: true } })
      const subExists = o.subcontractorExternalId
        ? await db.subcontractor.findUnique({ where: { id: subId }, select: { id: true } })
        : null

      if (!projectExists) {
        warnings.push(`order ${o.reference}: project ${o.projectExternalId} not synced yet — skipping`)
        continue
      }
      if (o.subcontractorExternalId && !subExists) {
        warnings.push(`order ${o.reference}: subcontractor ${o.subcontractorExternalId} not synced yet — skipping`)
        continue
      }

      await db.subcontractOrder.upsert({
        where: { id: extId(connection.provider, o.externalId) },
        create: {
          id: extId(connection.provider, o.externalId),
          organisationId: connection.organisationId,
          projectId: projId,
          subcontractorId: subId || "",
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
    } catch (e) {
      errors.push(`order ${o.reference}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Upsert invoices as applications ───────────────────────────────────────
  for (const inv of invResult.data) {
    try {
      const existingApp = await db.application.findFirst({
        where: { id: extId(connection.provider, inv.externalId) },
      })
      if (existingApp) continue

      const orderId = extId(connection.provider, inv.orderExternalId)
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
            id: extId(connection.provider, inv.externalId),
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
      } else {
        warnings.push(`invoice ${inv.invoiceNumber}: no matching open cycle for order — skipped`)
      }
    } catch (e) {
      errors.push(`invoice ${inv.invoiceNumber}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Mark cycles as paid ───────────────────────────────────────────────────
  for (const pmt of pmtResult.data) {
    try {
      const appId = pmt.invoiceExternalId
        ? extId(connection.provider, pmt.invoiceExternalId)
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
    } catch (e) {
      errors.push(`payment ${pmt.externalId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ─── Determine final status ────────────────────────────────────────────────
  const totalRead =
    leResult.data.length + projResult.data.length + subResult.data.length +
    orderResult.data.length + invResult.data.length + pmtResult.data.length

  let finalStatus: "succeeded" | "partial" | "failed"

  if (errors.length === 0 && warnings.length === 0) {
    finalStatus = "succeeded"
  } else if (totalRead > 0 || upserted > 0) {
    finalStatus = "partial"
  } else {
    finalStatus = "failed"
  }

  const newCursor = {
    lastModifiedFrom: new Date().toISOString(),
    entityCursors: Object.fromEntries(
      ["project", "subcontractor", "order", "invoice", "payment"].map((k) => [
        k,
        new Date().toISOString(),
      ])
    ),
  }

  await db.syncLog.update({
    where: { id: log.id },
    data: {
      status: finalStatus === "succeeded" ? "SUCCEEDED" : finalStatus === "partial" ? "SUCCEEDED" : "FAILED",
      completedAt: new Date(),
      recordsRead: totalRead,
      recordsUpserted: upserted,
      cursorState: newCursor,
      errorMessage: errors.length > 0 ? errors.join("; ") : null,
    },
  })

  // Only advance lastSyncedAt if we got SOME data through
  if (totalRead > 0 || upserted > 0) {
    await db.connection.update({ where: { id: connectionId }, data: { lastSyncedAt: new Date() } })
  }

  return {
    status: finalStatus,
    recordsRead: totalRead,
    recordsUpserted: upserted,
    errorMessage: errors.length > 0 ? errors.slice(0, 5).join("; ") : undefined,
    warnings: warnings.slice(0, 10),
  }
}