import { handleUpload, type HandleUploadBody } from "@vercel/blob/client"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { requireOrgRoute } from "@/lib/auth"

// Compliance documents, variation attachments, and application attachments
// go through this endpoint — restrict to document-like file types.
const ALLOWED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "doc", "docx", "xls", "xlsx"])
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

// Client-upload flow: the browser gets a short-lived token from this route,
// then uploads the file bytes directly to Blob storage — the file never
// passes through this (or any) serverless function, so it isn't subject to
// Vercel's request body size limit. See lib/upload-client.ts for the client
// side of this handshake.
export async function POST(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireOrgRoute({ minRole: "COMMERCIAL" })
  if (!authResult.ok) return authResult.response

  // The client embeds its own tenant id in the requested pathname
  // (lib/upload-client.ts); require it to match the caller's actual,
  // session-derived tenant rather than trusting whatever prefix the
  // request claims — otherwise a caller could request a token for any
  // path, including one shaped like another tenant's.
  const { orgId, userId } = await auth()
  const tenantId = orgId ?? userId
  const requiredPrefix = `compliance/${tenantId}/`

  const body = (await request.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(requiredPrefix)) {
          throw new Error("Upload path is not valid for this organisation.")
        }
        const ext = pathname.split(".").pop()?.toLowerCase() ?? ""
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          throw new Error("Unsupported file type. Allowed: PDF, PNG, JPG, DOC(X), XLS(X).")
        }
        return {
          allowedContentTypes: ALLOWED_MIME_TYPES,
          maximumSizeInBytes: 20 * 1024 * 1024,
        }
      },
    })
    return NextResponse.json(jsonResponse)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 }
    )
  }
}
