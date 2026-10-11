import type {
  ExternalLegalEntity,
  ExternalProject,
  ExternalSubcontractor,
  ExternalSubcontractOrder,
  ExternalInvoice,
  ExternalPayment,
  SyncCursor,
} from "./types"

/**
 * Every accounting system adapter implements this interface.
 *
 * Adding a new provider requires:
 * 1. A client (handles auth + HTTP)
 * 2. An adapter class implementing this interface (maps external → NoticeGuard entities)
 * 3. A case in the sync engine's getAdapter() factory
 * 4. A case in the provider dropdown UI
 *
 * No changes to this interface are needed. No changes to the sync engine
 * or UI are needed beyond the factory/dropdown additions.
 */
export interface AccountingAdapter {
  /** Validate credentials — throw on invalid, return silently on success */
  testConnection(): Promise<void>

  /** Fetch legal entities modified since the given cursor */
  fetchLegalEntities(cursor: SyncCursor): Promise<ExternalLegalEntity[]>

  /** Fetch projects modified since the given cursor */
  fetchProjects(cursor: SyncCursor): Promise<ExternalProject[]>

  /** Fetch subcontractors (suppliers) modified since the given cursor */
  fetchSubcontractors(cursor: SyncCursor): Promise<ExternalSubcontractor[]>

  /** Fetch purchase orders modified since the given cursor */
  fetchOrders(cursor: SyncCursor): Promise<ExternalSubcontractOrder[]>

  /** Fetch purchase invoices modified since the given cursor */
  fetchInvoices(cursor: SyncCursor): Promise<ExternalInvoice[]>

  /** Fetch payments (with allocations) modified since the given cursor */
  fetchPayments(cursor: SyncCursor): Promise<ExternalPayment[]>
}