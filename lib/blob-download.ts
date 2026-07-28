import { get } from "@vercel/blob"
import { NextResponse } from "next/server"

// Streams a private Blob back to an already-authorised, already
// ownership-checked caller. Callers must verify org/tenant ownership of the
// record that references `blobUrl` before calling this — it has no
// awareness of tenancy itself, it just proxies the bytes.
export async function streamPrivateBlob(blobUrl: string): Promise<NextResponse> {
  const result = await get(blobUrl, { access: "private" })
  if (!result || result.statusCode !== 200) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const filename = result.blob.pathname.split("/").pop() ?? "download"

  return new NextResponse(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType || "application/octet-stream",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  })
}
