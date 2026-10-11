import { describe, it, expect } from "vitest"
import { encryptCredentials, decryptCredentials } from "./crypto"

describe("credential encryption", () => {
  it("round-trips credentials", () => {
    const creds = { domain: "sandbox.demo", username: "api_user", userApiKey: "secret123" }
    const encrypted = encryptCredentials(creds)
    expect(encrypted).not.toBe(JSON.stringify(creds))
    expect(encrypted).toContain(":") // format: iv:ciphertext:authTag (hex)

    const decrypted = decryptCredentials(encrypted)
    expect(decrypted).toEqual(creds)
  })

  it("produces different ciphertext for same plaintext (random IV)", () => {
    const creds = { domain: "acme", username: "u", userApiKey: "k" }
    const a = encryptCredentials(creds)
    const b = encryptCredentials(creds)
    expect(a).not.toBe(b)
    // both should decrypt to original
    expect(decryptCredentials(a)).toEqual(creds)
    expect(decryptCredentials(b)).toEqual(creds)
  })

  it("throws on tampered ciphertext", () => {
    const creds = { domain: "x", username: "y", userApiKey: "z" }
    const encrypted = encryptCredentials(creds)
    const tampered = encrypted.slice(0, -4) + "ffff"
    expect(() => decryptCredentials(tampered)).toThrow()
  })
})