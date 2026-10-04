import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"
import { computeApplicationTotal } from "@/lib/assessment-totals"

const PatchSchema = z.object({
  changes: z.array(
    z.object({
      lineId: z.string(),
      field: z.enum(["qtyOrPctClaimed", "valueToDateClaimed", "notes"]),
      oldValue: z.any(),
      newValue: z.any(),
    })
  ),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const authResult = await requireOrgRoute({ minRole: "COMMERCIAL" })
  if (!authResult.ok) return authResult.response
  const { org, userId } = authResult

  const application = await db.application.findFirst({
    where: {
      id,
      paymentCycle: {
        paymentSchedule: {
          subcontractOrder: { organisationId: org.id },
        },
      },
    },
  })
  if (!application) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = PatchSchema.safeParse(await req.json())
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

  const { changes } = body.data

  await Promise.all(
    changes.map((change) =>
      // Scoped by applicationId (not just lineId) so a line belonging to a
      // different application/org can't be targeted by substituting its id.
      db.applicationLine.updateMany({
        where: { id: change.lineId, applicationId: id },
        data:
          change.field === "qtyOrPctClaimed"
            ? { qtyOrPctClaimed: change.newValue }
            : change.field === "valueToDateClaimed"
            ? { valueToDateClaimed: change.newValue }
            : { notes: change.newValue },
      })
    )
  )

  // Recalculate the claimed total. Ordered by sortOrder — the auto-sum logic
  // (shared with Assessment) excludes parent (section/item) rows from the
  // sum since their live value is derived from children, not stored directly.
  const lines = await db.applicationLine.findMany({
    where: { applicationId: id },
    orderBy: { sortOrder: "asc" },
  })

  const cycle = await db.paymentCycle.findFirst({
    where: { application: { id } },
    include: {
      paymentSchedule: { include: { subcontractOrder: true } },
    },
  })

  const amountApplied = computeApplicationTotal(
    lines.map((l) => ({
      indentLevel: l.indentLevel,
      valueToDateClaimed: Number(l.valueToDateClaimed),
    }))
  )

  await db.application.update({
    where: { id },
    data: { amountApplied },
  })

  await db.auditEvent.create({
    data: {
      organisationId: org.id,
      subcontractOrderId: cycle?.paymentSchedule.subcontractOrder.id,
      paymentCycleId: cycle?.id,
      userId,
      eventType: "application.saved",
      payload: { applicationId: id, amountApplied },
    },
  })

  return NextResponse.json({ amountApplied })
}
