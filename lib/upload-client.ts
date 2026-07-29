import { upload } from "@vercel/blob/client"

// Kept in sync with the extension allowlist enforced server-side in
// app/api/upload/route.ts's onBeforeGenerateToken.
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"])

// Uploads a compliance document, application attachment, or variation
// attachment directly from the browser to Blob storage — bypassing the
// Vercel serverless function body-size limit that a server-proxied upload
// would hit for large scanned contracts/drawings. app/api/upload/route.ts
// only issues a short-lived token; the file bytes never pass through it.
//
// `tenantId` is the caller's Clerk org id (or user id for a personal
// tenant) — the same value lib/auth.ts resolves server-side as
// `orgId ?? userId`. It's embedded in the pathname so the server can
// verify (in app/api/upload/route.ts's onBeforeGenerateToken) that a
// caller can only ever request a token for their own tenant's prefix,
// rather than trusting an arbitrary client-chosen path.
export async function uploadDocument(file: File, tenantId: string): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported file type. Allowed: PDF, PNG, JPG, DOC(X), XLS(X).")
  }
  if (!tenantId) {
    throw new Error("Not ready to upload yet — please try again in a moment.")
  }

  const pathname = `compliance/${tenantId}/${crypto.randomUUID()}.${ext}`
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
  })
  return blob.url
}
