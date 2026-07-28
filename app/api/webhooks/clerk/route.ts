import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { db } from "@/lib/db"
import { mapClerkRole, resolveSyncedRole } from "@/lib/roles"

type ClerkUserEvent = {
  type: string
  data: {
    id: string
    name?: string
    email_addresses?: Array<{ email_address: string; id: string }>
    first_name?: string
    last_name?: string
    organization_id?: string
    user_id?: string
    role?: string
    public_metadata?: { role?: string }
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 })

  const svix = new Webhook(secret)
  const body = await req.text()
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  }

  let event: ClerkUserEvent
  try {
    event = svix.verify(body, headers) as ClerkUserEvent
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const { type, data } = event

  // Handle organisation creation — create a matching Organisation row
  if (type === "organization.created") {
    // Organization events carry `name`, not `first_name`/`last_name` — those
    // are user-event fields.
    await db.organisation.upsert({
      where: { clerkOrgId: data.id },
      update: { name: data.name ?? "Unnamed Organisation" },
      create: {
        clerkOrgId: data.id,
        name: data.name ?? "Unnamed Organisation",
        requiredDocTypes: [],
      },
    })
  }

  // Handle org membership create/update — sync role into OrgMember. See
  // resolveSyncedRole() for why this doesn't just overwrite the role.
  if (type === "organizationMembership.created" || type === "organizationMembership.updated") {
    const clerkUserId = data.user_id ?? ""
    const clerkOrgId = data.organization_id ?? ""
    const clerkMappedRole = mapClerkRole(data.role)
    const name = `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() || clerkUserId
    const email = data.email_addresses?.[0]?.email_address ?? ""

    const org = await db.organisation.findUnique({ where: { clerkOrgId } })
    if (org) {
      const existing = await db.orgMember.findUnique({
        where: { clerkUserId_organisationId: { clerkUserId, organisationId: org.id } },
      })

      if (!existing) {
        await db.orgMember.create({
          data: { clerkUserId, organisationId: org.id, role: clerkMappedRole, name, email },
        })
      } else {
        const role = resolveSyncedRole(existing.role, clerkMappedRole)
        await db.orgMember.update({
          where: { clerkUserId_organisationId: { clerkUserId, organisationId: org.id } },
          data: { role, name, email },
        })
      }
    }
  }

  // Handle org membership deletion
  if (type === "organizationMembership.deleted") {
    const clerkUserId = data.user_id ?? ""
    const clerkOrgId = data.organization_id ?? ""
    const org = await db.organisation.findUnique({ where: { clerkOrgId } })
    if (org) {
      await db.orgMember.deleteMany({
        where: { clerkUserId, organisationId: org.id },
      })
    }
  }

  return NextResponse.json({ received: true })
}
