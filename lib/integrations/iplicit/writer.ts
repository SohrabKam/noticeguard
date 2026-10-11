import { IplicitClient } from "./client"
import { decryptCredentials } from "../crypto"
import type { Connection } from "@/lib/generated/prisma/client"

interface CreatePurchaseOrderParams {
  docTypeId: string
  contactAccountId: string
  projectId?: string
  docNo?: string
  description?: string
  docDate: string
  amount: number
  legalEntityId?: string
}

interface PurchaseOrderResponse {
  id: string
  docNo?: string
}

export class IplicitWriter {
  private client: IplicitClient

  constructor(connection: Connection) {
    const creds = decryptCredentials(connection.credentials as unknown as string)
    this.client = new IplicitClient({
      domain: creds.domain as string,
      username: creds.username as string,
      userApiKey: creds.userApiKey as string,
    })
  }

  async createPurchaseOrder(params: CreatePurchaseOrderParams): Promise<PurchaseOrderResponse> {
    const body: Record<string, unknown> = {
      docTypeId: params.docTypeId,
      contactAccountId: params.contactAccountId,
      docDate: params.docDate,
      docNo: params.docNo ?? undefined,
      description: params.description ?? undefined,
      projectId: params.projectId ?? undefined,
      legalEntityId: params.legalEntityId ?? undefined,
      details: [
        {
          description: params.description ?? "Subcontract order",
          netAmount: params.amount,
        },
      ],
    }

    return this.client.post<PurchaseOrderResponse>("/api/PurchaseOrder", body)
  }
}