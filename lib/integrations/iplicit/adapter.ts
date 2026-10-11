import type { AccountingAdapter } from "../adapter-interface"
import type {
  ExternalLegalEntity,
  ExternalProject,
  ExternalSubcontractor,
  ExternalSubcontractOrder,
  ExternalInvoice,
  ExternalPayment,
  SyncCursor,
} from "../types"
import { IplicitClient } from "./client"

// ─── iplicit API response shapes (subset — only fields we use) ──────────────

interface IplicitLegalEntity {
  id: string
  name: string
}

interface IplicitProject {
  id: string
  name: string
  reference?: string
  legalEntityId?: string
  isActive?: boolean
}

interface IplicitContactAccount {
  id: string
  name: string
  companyNumber?: string
  supplier?: unknown // presence indicates supplier
  contact?: { email?: string; emails?: string[] }
}

interface IplicitPurchaseOrder {
  id: string
  docNo?: string
  reference?: string
  description?: string
  projectId?: string
  contactAccountId?: string
  totalAmount?: number
  isActive?: boolean
}

interface IplicitPurchaseInvoice {
  id: string
  docNo?: string
  reference?: string
  description?: string
  purchaseOrderId?: string
  totalAmount?: number
  docDate?: string
  createdDate?: string
}

interface IplicitPayment {
  id: string
  docNo?: string
  reference?: string
  totalAmount?: number
  docDate?: string
  createdDate?: string
  allocations?: Array<{
    id: string
    documentId?: string
    amount?: number
  }>
}

const DEFAULT_FROM = "2020-01-01"

export class IplicitAdapter implements AccountingAdapter {
  private client: IplicitClient

  constructor(credentials: Record<string, unknown>) {
    this.client = new IplicitClient({
      domain: credentials.domain as string,
      username: credentials.username as string,
      userApiKey: credentials.userApiKey as string,
    })
  }

  async testConnection(): Promise<void> {
    // Fetch one legal entity — proves auth + domain work
    await this.client.get<IplicitLegalEntity[]>("/api/LegalEntity")
  }

  async fetchLegalEntities(cursor: SyncCursor): Promise<ExternalLegalEntity[]> {
    const entities = await this.client.get<IplicitLegalEntity[]>("/api/LegalEntity")
    return entities.map((e) => ({
      externalId: e.id,
      name: e.name,
    }))
  }

  async fetchProjects(cursor: SyncCursor): Promise<ExternalProject[]> {
    const lastMod = cursor.entityCursors["project"] ?? cursor.lastModifiedFrom ?? DEFAULT_FROM
    const projects = await this.client.getAll<IplicitProject>(
      "/api/Project",
      { LastModifiedFrom: lastMod }
    )
    return projects.map((p) => ({
      externalId: p.id,
      legalEntityExternalId: p.legalEntityId ?? null,
      name: p.name,
      reference: p.reference ?? null,
      isActive: p.isActive ?? true,
    }))
  }

  async fetchSubcontractors(cursor: SyncCursor): Promise<ExternalSubcontractor[]> {
    const lastMod =
      cursor.entityCursors["subcontractor"] ?? cursor.lastModifiedFrom ?? DEFAULT_FROM
    const accounts = await this.client.getAll<IplicitContactAccount & { contactAccounts?: IplicitContactAccount[] }>(
      "/api/ContactAccount",
      { LastModifiedFrom: lastMod }
    )
    // iplicit may wrap in { contactAccounts: [...] } — handle both shapes
    const flat: IplicitContactAccount[] = Array.isArray(accounts)
      ? accounts
      : ((accounts as unknown as { contactAccounts?: IplicitContactAccount[] }).contactAccounts ?? [])

    return flat
      .filter((a) => !!a.supplier)
      .map((a) => {
        const emails: string[] = []
        if (a.contact?.email) emails.push(a.contact.email)
        if (a.contact?.emails) emails.push(...a.contact.emails)
        return {
          externalId: a.id,
          name: a.name,
          companyNumber: a.companyNumber ?? null,
          contactEmails: emails,
        }
      })
  }

  async fetchOrders(cursor: SyncCursor): Promise<ExternalSubcontractOrder[]> {
    const lastMod = cursor.entityCursors["order"] ?? cursor.lastModifiedFrom ?? DEFAULT_FROM
    const orders = await this.client.getAll<IplicitPurchaseOrder>(
      "/api/PurchaseOrder",
      { LastModifiedFrom: lastMod }
    )
    return orders.map((o) => ({
      externalId: o.id,
      projectExternalId: o.projectId ?? "",
      subcontractorExternalId: o.contactAccountId ?? "",
      reference: o.docNo ?? o.reference ?? `PO-${o.id.slice(0, 8)}`,
      description: o.description ?? null,
      contractSum: o.totalAmount ?? 0,
      isActive: o.isActive ?? true,
    }))
  }

  async fetchInvoices(cursor: SyncCursor): Promise<ExternalInvoice[]> {
    const lastMod = cursor.entityCursors["invoice"] ?? cursor.lastModifiedFrom ?? DEFAULT_FROM
    const invoices = await this.client.getAll<IplicitPurchaseInvoice>(
      "/api/PurchaseInvoice",
      { LastModifiedFrom: lastMod }
    )
    return invoices.map((inv) => ({
      externalId: inv.id,
      orderExternalId: inv.purchaseOrderId ?? "",
      invoiceNumber: inv.docNo ?? inv.reference ?? `INV-${inv.id.slice(0, 8)}`,
      amount: inv.totalAmount ?? 0,
      dateReceived: inv.docDate ?? inv.createdDate ?? new Date().toISOString(),
      notes: inv.description ?? null,
    }))
  }

  async fetchPayments(cursor: SyncCursor): Promise<ExternalPayment[]> {
    const lastMod = cursor.entityCursors["payment"] ?? cursor.lastModifiedFrom ?? DEFAULT_FROM
    const payments = await this.client.getAll<IplicitPayment & { payments?: IplicitPayment[] }>(
      "/api/Payment",
      { LastModifiedFrom: lastMod }
    )
    const flat: IplicitPayment[] = Array.isArray(payments)
      ? payments
      : ((payments as unknown as { payments?: IplicitPayment[] }).payments ?? [])

    const results: ExternalPayment[] = []

    for (const p of flat) {
      // Try to fetch detail with allocations
      try {
        const detail = await this.client.get<IplicitPayment>(`/api/Payment/${p.id}`)
        const allocs = detail.allocations ?? []
        const paymentDate = detail.docDate ?? detail.createdDate ?? new Date().toISOString()

        if (allocs.length === 0) {
          results.push({
            externalId: p.id,
            invoiceExternalId: "",
            amount: detail.totalAmount ?? 0,
            paymentDate,
            reference: detail.reference ?? detail.docNo ?? null,
          })
        } else {
          for (const alloc of allocs) {
            results.push({
              externalId: `${p.id}_${alloc.id}`,
              invoiceExternalId: alloc.documentId ?? "",
              amount: alloc.amount ?? detail.totalAmount ?? 0,
              paymentDate,
              reference: detail.reference ?? detail.docNo ?? null,
            })
          }
        }
      } catch {
        // Skip payments we can't read (permissions, multi-entity, etc.)
      }
    }

    return results
  }
}