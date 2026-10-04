"use server"
import { requireOrgAction } from "@/lib/auth"
import { db } from "@/lib/db"
import { revalidatePath } from "next/cache"
import { toSafeErrorMessage } from "@/lib/prisma-error"

// Called when a cycle workspace is opened for the first time.
// Creates the Assessment and copies lines from the ActivitySchedule template,
// filling previouslyCertified from the most recently certified cycle.
export async function initAssessment(cycleId: string) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const cycle = await db.paymentCycle.findFirst({
      where: {
        id: cycleId,
        paymentSchedule: { subcontractOrder: { organisationId: org.id } },
      },
      include: {
        assessment: true,
        application: { include: { lines: true } },
        paymentSchedule: {
          include: {
            subcontractOrder: {
              include: { scheduleLines: { orderBy: { sortOrder: "asc" } } },
            },
            cycles: {
              where: { status: { in: ["NOTICE_SERVED", "PAY_LESS_SERVED", "PAID", "CLOSED"] } },
              orderBy: { cycleNumber: "desc" },
              take: 1,
              include: {
                assessment: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
              },
            },
          },
        },
      },
    })

    if (!cycle) throw new Error("Cycle not found")
    if (cycle.assessment) return { assessmentId: cycle.assessment.id } // already initialised

    const order = cycle.paymentSchedule.subcontractOrder
    const templateLines = order.scheduleLines
    const lastCycle = cycle.paymentSchedule.cycles[0]
    const lastLines = lastCycle?.assessment?.lines ?? []

    // Build a map of itemRef → valueToDate from last certified cycle
    const prevMap = new Map(lastLines.map((l) => [l.itemRef, Number(l.valueToDate)]))

    // Build a map of itemRef → what the subcontractor claimed this cycle
    // (Application may not exist yet if an assessment is somehow initialised
    // before an application is logged — falls back to no claim in that case).
    const claimedMap = new Map(
      (cycle.application?.lines ?? []).map((l) => [l.itemRef, Number(l.valueToDateClaimed)])
    )

    // Both only depend on data already fetched above (order.id, templateLines) —
    // independent of each other, so run them together.
    const [assessment, variations] = await Promise.all([
      db.assessment.create({
        data: {
          paymentCycleId: cycleId,
          lines: {
            create: templateLines.map((tl) => {
              const prevCert = prevMap.get(tl.itemRef) ?? 0
              const claimed = claimedMap.get(tl.itemRef)
              return {
                sortOrder: tl.sortOrder,
                itemRef: tl.itemRef,
                description: tl.description,
                contractValue: tl.contractValue,
                isVariation: tl.isVariation,
                indentLevel: tl.indentLevel,
                variationId: tl.variationId,
                // Start from what the subcontractor claimed this cycle, so
                // the contractor is certifying/adjusting a real submission
                // rather than starting from a blank slate — falls back to
                // "no change from last cycle" if nothing was claimed for
                // this line (e.g. a variation added after the application).
                valueToDate: claimed ?? prevCert,
                claimedValueToDate: claimed ?? null,
                previouslyCertified: prevCert,
                thisCycle: 0,
              }
            }),
          },
        },
      }),
      // Also add any instructed/agreed variations not yet in template
      db.variation.findMany({
        where: {
          subcontractOrderId: order.id,
          status: { in: ["INSTRUCTED", "AGREED"] },
        },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const templateRefs = new Set(templateLines.map((l) => l.itemRef))
    const newVarLines = variations.filter((v) => !templateRefs.has(`VAR-${v.reference}`))

    // Independent writes — the new variation lines don't affect the cycle
    // status update and vice versa.
    await Promise.all([
      newVarLines.length > 0
        ? db.assessmentLine.createMany({
            data: newVarLines.map((v, i) => {
              const claimed = claimedMap.get(`VAR-${v.reference}`)
              return {
                assessmentId: assessment.id,
                sortOrder: templateLines.length + i + 1,
                itemRef: `VAR-${v.reference}`,
                description: v.description,
                contractValue: Number(v.agreedValue ?? v.estimatedValue ?? 0),
                isVariation: true,
                variationId: v.id,
                valueToDate: claimed ?? 0,
                claimedValueToDate: claimed ?? null,
                previouslyCertified: 0,
                thisCycle: 0,
              }
            }),
          })
        : Promise.resolve(),
      db.paymentCycle.update({
        where: { id: cycleId },
        data: { status: "UNDER_ASSESSMENT" },
      }),
    ])

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: order.id,
        paymentCycleId: cycleId,
        userId,
        eventType: "assessment.initialised",
        payload: { linesCreated: templateLines.length + newVarLines.length },
      },
    })

    revalidatePath(`/cycles/${cycleId}`)
    return { assessmentId: assessment.id }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

// Called when a subcontractor's application is first logged for a cycle.
// Creates the Application shell (header fields only — amountApplied starts
// at 0 and is server-derived from ApplicationLine totals from then on, see
// app/api/applications/[id]/lines/route.ts) and seeds ApplicationLine[] from
// the ActivitySchedule template, same copy + variation-folding pattern as
// initAssessment, so contractor staff can enter the subcontractor's claimed
// %/£ complete per line.
export async function initApplication(cycleId: string, formData: FormData) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const cycle = await db.paymentCycle.findFirst({
      where: {
        id: cycleId,
        paymentSchedule: { subcontractOrder: { organisationId: org.id } },
      },
      include: {
        application: true,
        paymentSchedule: {
          include: {
            subcontractOrder: {
              include: { scheduleLines: { orderBy: { sortOrder: "asc" } } },
            },
          },
        },
      },
    })
    if (!cycle) throw new Error("Cycle not found")
    if (cycle.application) throw new Error("Application already logged")

    const order = cycle.paymentSchedule.subcontractOrder
    const templateLines = order.scheduleLines

    const dateReceived = formData.get("dateReceived") as string
    const notes = (formData.get("notes") as string) || undefined
    const receivedVia = (formData.get("receivedVia") as string) || "manual"
    const attachmentUrl = (formData.get("attachmentUrl") as string) || undefined

    const [application, variations] = await Promise.all([
      db.application.create({
        data: {
          paymentCycleId: cycleId,
          amountApplied: 0,
          dateReceived: new Date(dateReceived),
          receivedVia,
          notes,
          attachmentUrl,
          lines: {
            create: templateLines.map((tl) => ({
              sortOrder: tl.sortOrder,
              itemRef: tl.itemRef,
              description: tl.description,
              contractValue: tl.contractValue,
              isVariation: tl.isVariation,
              indentLevel: tl.indentLevel,
              variationId: tl.variationId,
              valueToDateClaimed: 0,
            })),
          },
        },
      }),
      db.variation.findMany({
        where: {
          subcontractOrderId: order.id,
          status: { in: ["INSTRUCTED", "AGREED"] },
        },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const templateRefs = new Set(templateLines.map((l) => l.itemRef))
    const newVarLines = variations.filter((v) => !templateRefs.has(`VAR-${v.reference}`))

    await Promise.all([
      newVarLines.length > 0
        ? db.applicationLine.createMany({
            data: newVarLines.map((v, i) => ({
              applicationId: application.id,
              sortOrder: templateLines.length + i + 1,
              itemRef: `VAR-${v.reference}`,
              description: v.description,
              contractValue: Number(v.agreedValue ?? v.estimatedValue ?? 0),
              isVariation: true,
              variationId: v.id,
              valueToDateClaimed: 0,
            })),
          })
        : Promise.resolve(),
      db.paymentCycle.update({
        where: { id: cycleId },
        data: { status: "APPLICATION_RECEIVED" },
      }),
    ])

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: order.id,
        paymentCycleId: cycleId,
        userId,
        eventType: "application.received",
        payload: { dateReceived, receivedVia, notes, linesCreated: templateLines.length + newVarLines.length },
      },
    })

    revalidatePath(`/cycles/${cycleId}`)
    return { applicationId: application.id }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

export async function updateApplication(applicationId: string, formData: FormData) {
  try {
    const { org } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const application = await db.application.findFirst({
      where: {
        id: applicationId,
        paymentCycle: {
          paymentSchedule: { subcontractOrder: { organisationId: org.id } },
        },
      },
      include: { paymentCycle: true },
    })
    if (!application) throw new Error("Application not found")

    const dateReceived = formData.get("dateReceived") as string
    const notes = (formData.get("notes") as string) || undefined
    const receivedVia = (formData.get("receivedVia") as string) || undefined
    const attachmentUrl = formData.get("attachmentUrl") as string | null

    await db.application.update({
      where: { id: applicationId },
      data: {
        dateReceived: new Date(dateReceived),
        notes: notes ?? null,
        ...(receivedVia ? { receivedVia } : {}),
        attachmentUrl: attachmentUrl || null,
      },
    })

    revalidatePath(`/cycles/${application.paymentCycleId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}
