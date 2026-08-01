"use server"
import { requireOrgAction } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCycles } from "@/lib/dates/cycle-generator"
import { assertEditableScheduleLine } from "@/lib/schedule-lines"
import { revalidatePath } from "next/cache"
import { toSafeErrorMessage } from "@/lib/prisma-error"

export async function updateScheduleLine(
  lineId: string,
  data: { itemRef: string; description: string; contractValue: number }
) {
  try {
    const { org } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const line = await db.activityScheduleLine.findFirst({
      where: { id: lineId, subcontractOrder: { organisationId: org.id } },
      include: { subcontractOrder: true },
    })
    if (!line) throw new Error("Line not found")
    assertEditableScheduleLine(line, "edit")

    await db.activityScheduleLine.update({
      where: { id: lineId },
      data: {
        itemRef: data.itemRef,
        description: data.description,
        contractValue: data.contractValue,
      },
    })

    revalidatePath(`/subcontracts/${line.subcontractOrderId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

export async function addScheduleLine(
  orderId: string,
  data: { itemRef: string; description: string; contractValue: number }
) {
  try {
    const { org } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const order = await db.subcontractOrder.findFirst({
      where: { id: orderId, organisationId: org.id },
      include: { scheduleLines: { orderBy: { sortOrder: "desc" }, take: 1 } },
    })
    if (!order) throw new Error("Order not found")

    const nextSort = (order.scheduleLines[0]?.sortOrder ?? 0) + 10

    await db.activityScheduleLine.create({
      data: {
        subcontractOrderId: orderId,
        sortOrder: nextSort,
        itemRef: data.itemRef,
        description: data.description,
        contractValue: data.contractValue,
        isVariation: false,
      },
    })

    revalidatePath(`/subcontracts/${orderId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

export async function deleteScheduleLine(lineId: string) {
  try {
    const { org } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const line = await db.activityScheduleLine.findFirst({
      where: { id: lineId, subcontractOrder: { organisationId: org.id } },
    })
    if (!line) throw new Error("Line not found")
    assertEditableScheduleLine(line, "delete")

    await db.activityScheduleLine.delete({ where: { id: lineId } })

    revalidatePath(`/subcontracts/${line.subcontractOrderId}`)
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

export async function extendSchedule(orderId: string, newEndDateStr: string) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const order = await db.subcontractOrder.findFirst({
      where: { id: orderId, organisationId: org.id },
      include: {
        paymentSchedule: {
          include: { cycles: { select: { id: true }, orderBy: { cycleNumber: "asc" } } },
        },
      },
    })
    if (!order?.paymentSchedule) throw new Error("Order or schedule not found")

    const schedule = order.paymentSchedule
    const newEndDate = new Date(newEndDateStr)
    const currentEnd = new Date(schedule.scheduleEndDate)

    if (newEndDate <= currentEnd) throw new Error("New end date must be after the current end date")

    // Update the schedule end date first so generateCycles uses the new range
    const updatedSchedule = await db.paymentSchedule.update({
      where: { id: schedule.id },
      data: { scheduleEndDate: newEndDate },
    })

    const existingCount = schedule.cycles.length

    // Generate from the month after the old end date so we only create new cycles
    const afterCurrentEnd = new Date(currentEnd.getFullYear(), currentEnd.getMonth() + 1, 1)
    const extendedFromSchedule = {
      ...updatedSchedule,
      scheduleStartDate: afterCurrentEnd,
    }
    const newCycles = generateCycles(extendedFromSchedule, existingCount)

    if (newCycles.length === 0) throw new Error("No new cycles would be generated for that date range")

    await db.paymentCycle.createMany({
      data: newCycles.map((c) => ({
        paymentScheduleId: schedule.id,
        cycleNumber: c.cycleNumber,
        applicationExpectedDate: c.applicationExpectedDate,
        dueDate: c.dueDate,
        paymentNoticeDeadline: c.paymentNoticeDeadline,
        finalDateForPayment: c.finalDateForPayment,
        payLessDeadline: c.payLessDeadline,
        dateDerivation: c.dateDerivation,
        status: "AWAITING_APPLICATION",
      })),
    })

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: orderId,
        userId,
        eventType: "schedule.extended",
        payload: {
          previousEndDate: currentEnd.toISOString(),
          newEndDate: newEndDate.toISOString(),
          cyclesAdded: newCycles.length,
        },
      },
    })

    revalidatePath(`/subcontracts/${orderId}`)
    return { cyclesAdded: newCycles.length }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}
