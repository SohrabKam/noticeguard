"use server"
import { requireOrgAction } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateCycles } from "@/lib/dates/cycle-generator"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { toSafeErrorMessage } from "@/lib/prisma-error"

const ScheduleLineSchema = z.object({
  itemRef: z.string().min(1),
  description: z.string().min(1),
  contractValue: z.coerce.number().min(0),
})

const CreateContractSchema = z.object({
  projectId: z.string().min(1),
  subcontractorId: z.string().optional(),
  newSubcontractorName: z.string().optional(),
  newSubcontractorEmails: z.string().optional(),
  reference: z.string().min(1),
  description: z.string().optional(),
  contractForm: z.enum(["JCT_ICSUB", "DOM1", "BESPOKE", "SCHEME_DEFAULT"]).default("SCHEME_DEFAULT"),
  contractSum: z.coerce.number().positive(),
  retentionPct: z.coerce.number().min(0).max(100).default(5),
  signatory: z.string().optional(),
  appDueDateRule: z.enum(["FIXED_DAY_OF_MONTH", "FIXED_DAY_OF_WEEK", "MILESTONE"]).default("FIXED_DAY_OF_MONTH"),
  appDueDayOfMonth: z.coerce.number().min(1).max(31).optional(),
  appDueDayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  appDueWeekOfMonth: z.coerce.number().int().optional(),
  dueDateOffsetDays: z.coerce.number().int().positive().default(7),
  dueDateOffsetType: z.enum(["CALENDAR", "BUSINESS"]).default("CALENDAR"),
  paymentNoticeDeadlineDays: z.coerce.number().int().positive().default(5),
  paymentNoticeDeadlineType: z.enum(["CALENDAR", "BUSINESS"]).default("CALENDAR"),
  finalDateOffsetDays: z.coerce.number().int().positive().default(21),
  finalDateOffsetType: z.enum(["CALENDAR", "BUSINESS"]).default("CALENDAR"),
  payLessDeadlineDays: z.coerce.number().int().positive().default(7),
  payLessDeadlineType: z.enum(["CALENDAR", "BUSINESS"]).default("CALENDAR"),
  scheduleStartDate: z.string(),
  scheduleEndDate: z.string(),
  scheduleLines: z.array(ScheduleLineSchema).min(1, "Add at least one activity schedule line"),
})

export type CreateContractInput = z.infer<typeof CreateContractSchema>

export async function createContract(input: CreateContractInput) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const data = CreateContractSchema.parse(input)

    const project = await db.project.findFirst({
      where: { id: data.projectId, organisationId: org.id },
    })
    if (!project) throw new Error("Project not found")

    if (data.subcontractorId) {
      const existingSub = await db.subcontractor.findFirst({
        where: { id: data.subcontractorId, organisationId: org.id },
      })
      if (!existingSub) throw new Error("Subcontractor not found")
    }

    // Resolve or create subcontractor
    let subcontractorId = data.subcontractorId
    if (!subcontractorId && data.newSubcontractorName) {
      const emails = data.newSubcontractorEmails
        ? data.newSubcontractorEmails.split(",").map((e) => e.trim()).filter(Boolean)
        : []
      const sub = await db.subcontractor.create({
        data: {
          organisationId: org.id,
          name: data.newSubcontractorName,
          contactEmails: emails,
        },
      })
      subcontractorId = sub.id
    }
    if (!subcontractorId) throw new Error("Subcontractor required")

    const inboundEmail = `app-${Math.random().toString(36).slice(2, 8)}@in.noticeguard.app`

    const order = await db.subcontractOrder.create({
      data: {
        organisationId: org.id,
        projectId: data.projectId,
        subcontractorId,
        reference: data.reference,
        description: data.description,
        contractForm: data.contractForm,
        contractSum: data.contractSum,
        retentionPct: data.retentionPct / 100,
        signatory: data.signatory,
        inboundEmail,
        paymentSchedule: {
          create: {
            appDueDateRule: data.appDueDateRule,
            appDueDayOfMonth: data.appDueDayOfMonth,
            appDueDayOfWeek: data.appDueDayOfWeek,
            appDueWeekOfMonth: data.appDueWeekOfMonth,
            dueDateOffsetDays: data.dueDateOffsetDays,
            dueDateOffsetType: data.dueDateOffsetType,
            paymentNoticeDeadlineDays: data.paymentNoticeDeadlineDays,
            paymentNoticeDeadlineType: data.paymentNoticeDeadlineType,
            finalDateOffsetDays: data.finalDateOffsetDays,
            finalDateOffsetType: data.finalDateOffsetType,
            payLessDeadlineDays: data.payLessDeadlineDays,
            payLessDeadlineType: data.payLessDeadlineType,
            scheduleStartDate: new Date(data.scheduleStartDate),
            scheduleEndDate: new Date(data.scheduleEndDate),
          },
        },
        retentionLedger: { create: { totalHeld: 0 } },
      },
      include: { paymentSchedule: true },
    })

    // Create activity schedule lines
    if (data.scheduleLines.length > 0) {
      await db.activityScheduleLine.createMany({
        data: data.scheduleLines.map((line, i) => ({
          subcontractOrderId: order.id,
          sortOrder: i + 1,
          itemRef: line.itemRef,
          description: line.description,
          contractValue: line.contractValue,
        })),
      })
    }

    // Generate all cycles
    if (order.paymentSchedule) {
      const cycles = generateCycles(order.paymentSchedule)
      await db.paymentCycle.createMany({
        data: cycles.map((c) => ({
          paymentScheduleId: order.paymentSchedule!.id,
          cycleNumber: c.cycleNumber,
          applicationExpectedDate: c.applicationExpectedDate,
          dueDate: c.dueDate,
          paymentNoticeDeadline: c.paymentNoticeDeadline,
          finalDateForPayment: c.finalDateForPayment,
          payLessDeadline: c.payLessDeadline,
          dateDerivation: c.dateDerivation,
        })),
      })
    }

    await db.auditEvent.create({
      data: {
        organisationId: org.id,
        subcontractOrderId: order.id,
        userId,
        eventType: "contract.created",
        payload: { reference: data.reference, contractSum: data.contractSum },
      },
    })

    revalidatePath("/dashboard")
    revalidatePath("/subcontracts")

    return { orderId: order.id }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}
