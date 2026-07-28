import type { Role } from "./generated/prisma/client"

// Ordinal ranking for the Role enum — higher can do everything a lower role
// can. Kept as a small pure function so it's testable without mocking Clerk.
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  COMMERCIAL: 1,
  ADMIN: 2,
}

export function roleMeets(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole]
}

// Maps a Clerk org role (e.g. "org:admin", "admin", or a custom role name)
// to our internal Role enum. Unrecognised or missing input defaults to the
// least-privileged VIEWER — callers must never default to ADMIN themselves.
export function mapClerkRole(rawRole: string | null | undefined): Role {
  const upper = (rawRole ?? "").toUpperCase()
  if (upper.includes("ADMIN")) return "ADMIN"
  if (upper.includes("COMMERCIAL")) return "COMMERCIAL"
  return "VIEWER"
}

// Merges a Clerk membership sync into an existing OrgMember's role. Clerk's
// default org roles are only admin/basic_member — no COMMERCIAL equivalent —
// so lib/actions/settings.ts's updateMemberRole() is the only way to grant
// COMMERCIAL. To keep that a single, well-defined authority instead of two
// writers racing each other: Clerk may always promote to ADMIN (it's
// authoritative for "is this person an org admin"), and Clerk removing
// admin drops the member to VIEWER (least privilege) — any other Clerk
// role leaves an existing COMMERCIAL/VIEWER assignment untouched, so a sync
// never silently resets an in-app COMMERCIAL grant back to VIEWER.
export function resolveSyncedRole(existingRole: Role, clerkMappedRole: Role): Role {
  if (clerkMappedRole === "ADMIN") return "ADMIN"
  if (existingRole === "ADMIN") return "VIEWER"
  return existingRole
}
