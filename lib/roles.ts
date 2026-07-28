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
