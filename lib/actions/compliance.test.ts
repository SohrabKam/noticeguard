import { describe, it, expect, vi, beforeEach } from "vitest"

// Pattern for testing Clerk/Prisma-backed server actions without either
// service: mock the two seam modules — @/lib/auth (session/role) and
// @/lib/db (Prisma, which also throws at import time without DATABASE_URL) —
// so the test exercises only the action's own tenant-scoping decisions.
const mocks = vi.hoisted(() => ({
  db: {
    subcontractor: { findFirst: vi.fn() },
    complianceDocument: { updateMany: vi.fn(), create: vi.fn() },
    auditEvent: { create: vi.fn() },
  },
}))

vi.mock("@/lib/db", () => ({ db: mocks.db }))
vi.mock("@/lib/auth", () => ({
  requireOrgAction: vi.fn(async () => ({
    org: { id: "org-a" },
    userId: "user-1",
    role: "COMMERCIAL",
  })),
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

import { upsertComplianceDoc } from "./compliance"

function formData(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.db.subcontractor.findFirst.mockResolvedValue({ id: "sub-1" })
  mocks.db.complianceDocument.create.mockResolvedValue({ id: "doc-new" })
  mocks.db.complianceDocument.updateMany.mockResolvedValue({ count: 1 })
})

describe("upsertComplianceDoc — cross-tenant isolation (P0-2 regression)", () => {
  it("scopes the subcontractor lookup to the caller's org", async () => {
    await upsertComplianceDoc(
      formData({ subcontractorId: "sub-1", documentType: "Public Liability" })
    )

    expect(mocks.db.subcontractor.findFirst).toHaveBeenCalledWith({
      where: { id: "sub-1", organisationId: "org-a" },
    })
  })

  it("rejects a subcontractor from another org and writes nothing", async () => {
    mocks.db.subcontractor.findFirst.mockResolvedValue(null) // org-scoped lookup misses

    await expect(
      upsertComplianceDoc(
        formData({ subcontractorId: "sub-from-other-org", documentType: "Public Liability" })
      )
    ).rejects.toThrow("Subcontractor not found")

    expect(mocks.db.complianceDocument.create).not.toHaveBeenCalled()
    expect(mocks.db.complianceDocument.updateMany).not.toHaveBeenCalled()
    expect(mocks.db.auditEvent.create).not.toHaveBeenCalled()
  })

  it("updates an existing doc only through the verified subcontractor — never a bare id", async () => {
    await upsertComplianceDoc(
      formData({
        subcontractorId: "sub-1",
        documentType: "Public Liability",
        existingId: "doc-target",
      })
    )

    expect(mocks.db.complianceDocument.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-target", subcontractorId: "sub-1" },
      })
    )
  })

  it("rejects when the document isn't found under the caller's subcontractor", async () => {
    mocks.db.complianceDocument.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      upsertComplianceDoc(
        formData({
          subcontractorId: "sub-1",
          documentType: "Public Liability",
          existingId: "doc-from-other-org",
        })
      )
    ).rejects.toThrow("Compliance document not found")

    expect(mocks.db.auditEvent.create).not.toHaveBeenCalled()
  })

  it("creates a doc under the verified subcontractor and audits it against the caller's org", async () => {
    await upsertComplianceDoc(
      formData({ subcontractorId: "sub-1", documentType: "Public Liability" })
    )

    expect(mocks.db.complianceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subcontractorId: "sub-1" }),
      })
    )
    expect(mocks.db.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org-a",
          eventType: "compliance.doc.created",
        }),
      })
    )
  })
})
