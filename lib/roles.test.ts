import { describe, it, expect } from "vitest"
import { roleMeets, resolveSyncedRole } from "./roles"

describe("roleMeets", () => {
  it("allows a role to meet its own minimum", () => {
    expect(roleMeets("VIEWER", "VIEWER")).toBe(true)
    expect(roleMeets("COMMERCIAL", "COMMERCIAL")).toBe(true)
    expect(roleMeets("ADMIN", "ADMIN")).toBe(true)
  })

  it("allows higher roles to satisfy a lower minimum", () => {
    expect(roleMeets("ADMIN", "VIEWER")).toBe(true)
    expect(roleMeets("ADMIN", "COMMERCIAL")).toBe(true)
    expect(roleMeets("COMMERCIAL", "VIEWER")).toBe(true)
  })

  it("rejects lower roles against a higher minimum", () => {
    expect(roleMeets("VIEWER", "COMMERCIAL")).toBe(false)
    expect(roleMeets("VIEWER", "ADMIN")).toBe(false)
    expect(roleMeets("COMMERCIAL", "ADMIN")).toBe(false)
  })
})

describe("resolveSyncedRole", () => {
  it("always promotes to ADMIN when Clerk reports admin", () => {
    expect(resolveSyncedRole("VIEWER", "ADMIN")).toBe("ADMIN")
    expect(resolveSyncedRole("COMMERCIAL", "ADMIN")).toBe("ADMIN")
    expect(resolveSyncedRole("ADMIN", "ADMIN")).toBe("ADMIN")
  })

  it("drops an existing ADMIN to VIEWER once Clerk no longer reports admin", () => {
    expect(resolveSyncedRole("ADMIN", "VIEWER")).toBe("VIEWER")
    expect(resolveSyncedRole("ADMIN", "COMMERCIAL")).toBe("VIEWER")
  })

  it("never resets an in-app COMMERCIAL grant back to VIEWER", () => {
    expect(resolveSyncedRole("COMMERCIAL", "VIEWER")).toBe("COMMERCIAL")
    expect(resolveSyncedRole("COMMERCIAL", "COMMERCIAL")).toBe("COMMERCIAL")
  })

  it("leaves an existing VIEWER as VIEWER when Clerk still reports non-admin", () => {
    expect(resolveSyncedRole("VIEWER", "VIEWER")).toBe("VIEWER")
    expect(resolveSyncedRole("VIEWER", "COMMERCIAL")).toBe("VIEWER")
  })
})
