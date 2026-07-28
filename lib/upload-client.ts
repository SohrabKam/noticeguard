import { upload } from "@vercel/blob/client"

// Kept in sync with the extension allowlist enforced server-side in
// app/api/upload/route.ts's onBeforeGenerateToken.
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"])

// Uploads a compliance document, application attachment, or variation
// attachment directly from the browser to Blob storage — bypassing the
// Vercel serverless function body-size limit that a server-proxied upload
// would hit for large scanned contracts/drawings. app/api/upload/route.ts
// only issues a short-lived token; the file bytes never pass through it.
export async function uploadDocument(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error("Unsupported file type. Allowed: PDF, PNG, JPG, DOC(X), XLS(X).")
  }

  const pathname = `compliance/${crypto.randomUUID()}.${ext}`
  const blob = await upload(pathname, file, {
    access: "private",
    handleUploadUrl: "/api/upload",
  })
  return blob.url
}
