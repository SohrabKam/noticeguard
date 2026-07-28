import { NextRequest, NextResponse } from "next/server"
import { requireOrgRoute } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const LineSchema = z.object({
  id: z.string().optional(),
  sortOrder: z.number().int(),
  itemRef: z.string(),
  description: z.string(),
  contractValue: z.union([z.number(), z.null(), z.undefined()]).transform((v) => (v == null || isNaN(Number(v)) ? 0 : Number(v))),
  indentLevel: z.union([z.number().int(), z.null(), z.undefined()]).transform((v) => (v == null ? 0 : Math.max(0, Math.min(2, Math.round(Number(v)))))),
  isVariation: z.boolean().optional().default(false),
})

const BodySchema = z.object({
  lines: z.array(LineSchema),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params
    const authResult = await requireOrgRoute({ minRole: "COMMERCIAL" })
    if (!authResult.ok) return authResult.response
    const { org } = authResult

    const order = await db.subcontractOrder.findFirst({
      where: { id: orderId, organisationId: org.id },
      include: { scheduleLines: { select: { id: true, isVariation: true } } },
    })
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = BodySchema.safeParse(await req.json())
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 })

    const incoming = body.data.lines
    const existingIds = new Set(order.scheduleLines.map((l) => l.id))
    const variationIds = new Set(order.scheduleLines.filter((l) => l.isVariation).map((l) => l.id))

    // IDs present in incoming (non-variation lines only)
    const incomingIds = new Set(incoming.filter((l) => l.id).map((l) => l.id!))

    // Delete non-variation lines no longer in the incoming list
    const toDelete = [...existingIds].filter((id) => !variationIds.has(id) && !incomingIds.has(id))

    // Upsert all incoming lines — variation-derived lines are never
    // editable here (they're managed via the Variations flow, same rule
    // enforced by lib/actions/schedule.ts's updateScheduleLine), so skip
    // any incoming entry that refers to one instead of overwriting it.
    // Built as un-awaited Prisma operations (not wrapped in async/await) so
    // they can run inside a single $transaction with the delete — a partial
    // failure here previously left deleted lines with no replacements.
    const upsertOps = incoming
      .filter((line) => !(line.id && variationIds.has(line.id)))
      .map((line) =>
        line.id && existingIds.has(line.id)
          ? db.activityScheduleLine.update({
              where: { id: line.id },
              data: {
                sortOrder: line.sortOrder,
                itemRef: line.itemRef,
                description: line.description,
                contractValue: line.contractValue,
                indentLevel: line.indentLevel,
              },
            })
          : db.activityScheduleLine.create({
              data: {
                subcontractOrderId: orderId,
                sortOrder: line.sortOrder,
                itemRef: line.itemRef,
                description: line.description,
                contractValue: line.contractValue,
                indentLevel: line.indentLevel,
                isVariation: false,
              },
            })
      )

    const [, ...results] = await db.$transaction([
      db.activityScheduleLine.deleteMany({ where: { id: { in: toDelete } } }),
      ...upsertOps,
    ])

    return NextResponse.json({
      lines: results.map((l) => ({ id: l.id, sortOrder: l.sortOrder })),
    })
  } catch (err) {
    console.error("[schedule PUT] unhandled error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
