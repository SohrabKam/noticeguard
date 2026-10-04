import { NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { db } from "@/lib/db"
import { z } from "zod"

const PhotoSchema = z.object({
  lineId: z.string(),
  image: z.string().refine((v) => v.startsWith("data:image/"), "Must be a data URL"),
  takenAt: z.string().refine((v) => !isNaN(Date.parse(v)), "Must be ISO timestamp"),
})

// Public POST — upload a timestamp-burned photo to a report line.
// Accepts a data URL (burned client-side via canvas) + capture timestamp,
// uploads to Vercel Blob, and records the {url, takenAt} record on the line.
// Token-authenticated: no Clerk session needed.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const report = await db.siteReport.findUnique({ where: { token } })
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  if (report.status === "SUBMITTED") return NextResponse.json({ error: "Report is locked" }, { status: 409 })

  const body = PhotoSchema.safeParse(await req.json().catch(() => null))
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })
  const { lineId, image, takenAt } = body.data

  const line = await db.siteReportLine.findFirst({ where: { id: lineId, siteReportId: report.id } })
  if (!line) return NextResponse.json({ error: "Line not found" }, { status: 404 })

  // Convert data URL to Buffer for Blob upload
  const [header, b64] = image.split(",")
  const mime = header.match(/data:(image\/\w+);/)?.at(1) ?? "image/jpeg"
  const buffer = Buffer.from(b64, "base64")
  const ext = mime.split("/")[1] ?? "jpg"
  const key = `site-report/${report.paymentCycleId}/${crypto.randomUUID()}.${ext}`

  const blob = await put(key, buffer, {
    access: "public",
    contentType: mime,
  })

  // Record the photo
  const existingPhotos = (line.photos as Array<{ url: string; takenAt: string }>) ?? []
  const photos = [...existingPhotos, { url: blob.url, takenAt }]
  await db.siteReportLine.update({
    where: { id: lineId },
    data: { photos },
  })

  return NextResponse.json({ ok: true, url: blob.url, takenAt }, { status: 201 })
}