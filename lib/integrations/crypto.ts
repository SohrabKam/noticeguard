import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16 // bytes
const AUTH_TAG_LENGTH = 16 // bytes
const KEY_LENGTH = 32 // bytes

function getKey(): Buffer {
  const key = process.env.CREDENTIAL_ENCRYPTION_KEY
  if (!key) throw new Error("CREDENTIAL_ENCRYPTION_KEY is not set")
  const buf = Buffer.from(key, "hex")
  if (buf.length !== KEY_LENGTH) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY must be ${KEY_LENGTH * 2} hex chars (${KEY_LENGTH} bytes)`
    )
  }
  return buf
}

export function encryptCredentials(creds: Record<string, unknown>): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const plaintext = JSON.stringify(creds)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv:encrypted:authTag (all hex)
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${authTag.toString("hex")}`
}

export function decryptCredentials(encrypted: string): Record<string, unknown> {
  const key = getKey()
  const parts = encrypted.split(":")
  if (parts.length !== 3) throw new Error("Invalid credential format")
  const [ivHex, ciphertextHex, authTagHex] = parts
  const iv = Buffer.from(ivHex, "hex")
  const ciphertext = Buffer.from(ciphertextHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(decrypted.toString("utf8"))
}