"use server"
import { auth, currentUser } from "@clerk/nextjs/server"
import { db } from "@/lib/db"
import { mapClerkRole } from "@/lib/roles"

export async function completeOnboarding(formData: FormData) {
  // Identity and tenant come exclusively from the verified server session —
  // never from client-supplied form fields — so a caller cannot forge the
  // org/user this creates records under.
  const { orgId, userId, orgRole } = await auth()
  if (!userId) throw new Error("Unauthorized")

  const user = await currentUser()
  if (!user) throw new Error("Unauthorized")

  const tenantId = orgId ?? userId
  const orgName = (formData.get("orgName") as string | null)?.trim()
  const fromName = (formData.get("fromName") as string | null)?.trim() || undefined
  const fromEmail = (formData.get("fromEmail") as string | null)?.trim() || undefined
  const memberName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.emailAddresses[0]?.emailAddress || userId
  const memberEmail = user.emailAddresses[0]?.emailAddress ?? ""

  if (!orgName) throw new Error("Organisation name is required")

  // Guard against race-condition double-submits
  const existing = await db.organisation.findUnique({ where: { clerkOrgId: tenantId } })
  if (existing) return

  // A personal (org-less) tenant is solely owned by its one user, so ADMIN
  // is correct there. For a real Clerk organisation, only whoever actually
  // holds its admin role gets seeded as ADMIN — otherwise the first member
  // to reach this page (not necessarily the org's admin) could self-promote.
  const role = orgId ? mapClerkRole(orgRole) : "ADMIN"

  await db.$transaction(async (tx) => {
    const org = await tx.organisation.create({
      data: {
        clerkOrgId: tenantId,
        name: orgName,
        fromName: fromName ?? orgName,
        fromEmail,
        requiredDocTypes: ["Employers Liability", "Public Liability", "H&S Policy", "CIS Confirmation"],
      },
    })

    await tx.orgMember.create({
      data: {
        clerkUserId: userId,
        organisationId: org.id,
        role,
        name: memberName,
        email: memberEmail,
      },
    })

    await tx.alertConfig.createMany({
      data: [
        { organisationId: org.id, alertType: "DEADLINE_APPROACHING", offsetDays: 5 },
        { organisationId: org.id, alertType: "DEADLINE_APPROACHING", offsetDays: 2 },
        { organisationId: org.id, alertType: "DEADLINE_APPROACHING", offsetDays: 0 },
        { organisationId: org.id, alertType: "DOCUMENT_EXPIRY", offsetDays: 30 },
        { organisationId: org.id, alertType: "DOCUMENT_EXPIRY", offsetDays: 14 },
        { organisationId: org.id, alertType: "DOCUMENT_EXPIRY", offsetDays: 7 },
        { organisationId: org.id, alertType: "RETENTION_RELEASE", offsetDays: 30 },
        { organisationId: org.id, alertType: "RETENTION_RELEASE", offsetDays: 14 },
        { organisationId: org.id, alertType: "RETENTION_RELEASE", offsetDays: 7 },
        { organisationId: org.id, alertType: "DAILY_DIGEST", offsetDays: 0 },
      ],
    })
  })
}
