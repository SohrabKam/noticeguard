import { describe, it, expect, vi, beforeEach } from "vitest"

// Pattern for testing Clerk/Prisma-backed server actions without either
// service: mock the two seam modules — @clerk/nextjs/server (session) and
// @/lib/db (Prisma, which also throws at import time without DATABASE_URL) —
// so the test exercises only the action's own trust decisions.
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  db: {
    organisation: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    organisation: { create: vi.fn() },
    orgMember: { create: vi.fn() },
    alertConfig: { createMany: vi.fn() },
  },
}))

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}))
vi.mock("@/lib/db", () => ({ db: mocks.db }))

import { completeOnboarding } from "./actions"

function formData(values: Record<string, string>): FormData {
  const fd = new FormData()
  for (const [key, value] of Object.entries(values)) fd.set(key, value)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auth.mockResolvedValue({ orgId: "org_real", userId: "user_real", orgRole: "org:admin" })
  mocks.currentUser.mockResolvedValue({
    firstName: "Ada",
    lastName: "Lovelace",
    emailAddresses: [{ emailAddress: "ada@example.com" }],
  })
  mocks.db.organisation.findUnique.mockResolvedValue(null)
  mocks.db.$transaction.mockImplementation((fn: (tx: typeof mocks.tx) => unknown) =>
    fn(mocks.tx)
  )
  mocks.tx.organisation.create.mockResolvedValue({ id: "org-new" })
})

describe("completeOnboarding — authentication (P0-4 regression)", () => {
  it("rejects when there is no session, writing nothing", async () => {
    mocks.auth.mockResolvedValue({ orgId: null, userId: null, orgRole: null })

    await expect(completeOnboarding(formData({ orgName: "Acme Ltd" }))).rejects.toThrow(
      "Unauthorized"
    )
    expect(mocks.db.organisation.findUnique).not.toHaveBeenCalled()
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })

  it("derives identity and tenant from the session, never from client fields", async () => {
    const fd = formData({
      orgName: "Acme Ltd",
      // Forged fields — the pre-fix code trusted these.
      userId: "user_attacker",
      tenantId: "org_attacker",
    })

    await completeOnboarding(fd)

    expect(mocks.db.organisation.findUnique).toHaveBeenCalledWith({
      where: { clerkOrgId: "org_real" },
    })
    expect(mocks.tx.organisation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clerkOrgId: "org_real" }),
      })
    )
    expect(mocks.tx.orgMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkUserId: "user_real",
          organisationId: "org-new",
        }),
      })
    )
  })

  it("rejects a blank organisation name before any write", async () => {
    await expect(completeOnboarding(formData({ orgName: "   " }))).rejects.toThrow(
      "Organisation name is required"
    )
    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })

  it("no-ops on a double-submit when the org already exists", async () => {
    mocks.db.organisation.findUnique.mockResolvedValue({ id: "org-existing" })

    await completeOnboarding(formData({ orgName: "Acme Ltd" }))

    expect(mocks.db.$transaction).not.toHaveBeenCalled()
  })
})

describe("completeOnboarding — role seeding (P0-3 regression)", () => {
  it("does not seed a non-admin org member as ADMIN", async () => {
    mocks.auth.mockResolvedValue({ orgId: "org_real", userId: "user_member", orgRole: "org:member" })

    await completeOnboarding(formData({ orgName: "Acme Ltd" }))

    expect(mocks.tx.orgMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "VIEWER" }) })
    )
  })

  it("seeds the holder of the Clerk org admin role as ADMIN", async () => {
    await completeOnboarding(formData({ orgName: "Acme Ltd" }))

    expect(mocks.tx.orgMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) })
    )
  })

  it("seeds a personal (org-less) tenant's sole user as ADMIN", async () => {
    mocks.auth.mockResolvedValue({ orgId: null, userId: "user_solo", orgRole: null })

    await completeOnboarding(formData({ orgName: "Solo Op" }))

    expect(mocks.db.organisation.findUnique).toHaveBeenCalledWith({
      where: { clerkOrgId: "user_solo" },
    })
    expect(mocks.tx.orgMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: "ADMIN" }) })
    )
  })
})
