import { NextRequest, NextResponse } from "next/server"
import { Resend } from "resend"
import { z } from "zod"

const waitlistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  workEmail: z.string().email("Valid work email required"),
  company: z.string().min(1, "Company is required"),
  message: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") ?? ""
  const allowedOrigins = [
    "https://noticeguard-landing.vercel.app",
    "https://noticeguard.app",
    "https://www.noticeguard.app",
  ]

  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  if (allowedOrigins.includes(origin) || origin.startsWith("http://localhost")) {
    corsHeaders["Access-Control-Allow-Origin"] = origin
  }

  try {
    const body = waitlistSchema.parse(await request.json())
    const resend = new Resend(process.env.RESEND_API_KEY)
    const notifyEmail = process.env.WAITLIST_NOTIFY_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? "sohrab@noticeguard.app"

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "notices@noticeguard.app",
      to: notifyEmail,
      subject: `Pilot request: ${body.company} — ${body.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;color:#1e293b">
          <h2 style="color:#1e293b;margin-bottom:4px">New pilot request</h2>
          <table style="width:100%;border-collapse:collapse;font-size:15px;margin-top:16px">
            <tr><td style="padding:8px 0;color:#64748b;width:100px">Name</td><td style="padding:8px 0;font-weight:600">${body.name}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="padding:8px 0">${body.workEmail}</td></tr>
            <tr><td style="padding:8px 0;color:#64748b">Company</td><td style="padding:8px 0;font-weight:600">${body.company}</td></tr>
            ${body.message ? `<tr><td style="padding:8px 0;color:#64748b;vertical-align:top">Message</td><td style="padding:8px 0">${body.message}</td></tr>` : ""}
          </table>
          <p style="margin-top:24px;font-size:12px;color:#94a3b8">Submitted ${new Date().toISOString()} from ${origin || "unknown"}</p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true }, { headers: corsHeaders })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: err.issues[0]?.message ?? "Validation failed" },
        { status: 400, headers: corsHeaders }
      )
    }
    console.error("Waitlist submission failed:", err)
    return NextResponse.json(
      { ok: false, error: "Something went wrong — please try again or email us directly." },
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  )
}