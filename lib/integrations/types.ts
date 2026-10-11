export interface ExternalLegalEntity {
  externalId: string
  name: string
}

export interface ExternalProject {
  externalId: string
  legalEntityExternalId: string | null
  name: string
  reference: string | null
  isActive: boolean
}

export interface ExternalSubcontractor {
  externalId: string
  name: string
  companyNumber: string | null
  contactEmails: string[]
}

export interface ExternalSubcontractOrder {
  externalId: string
  projectExternalId: string
  subcontractorExternalId: string
  reference: string
  description: string | null
  contractSum: number
  isActive: boolean
}

export interface ExternalInvoice {
  externalId: string
  orderExternalId: string
  invoiceNumber: string
  amount: number
  dateReceived: string // ISO date
  notes: string | null
}

export interface ExternalPayment {
  externalId: string
  invoiceExternalId: string
  amount: number
  paymentDate: string // ISO date
  reference: string | null
}

export interface SyncCursor {
  lastModifiedFrom: string // ISO timestamp
  entityCursors: Record<string, string> // per-entity-type cursors
}

export interface SyncResult {
  legalEntities: { created: number; updated: number }
  projects: { created: number; updated: number }
  subcontractors: { created: number; updated: number }
  orders: { created: number; updated: number }
  invoices: { created: number; updated: number }
  payments: { created: number; updated: number }
}