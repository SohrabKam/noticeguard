// Site report actions — generate token, get/public access, update lines,
// upload photos, and submit (lock). Reports are per-cycle, authenticated
// by unguessable token rather than Clerk session (zero-login for site), and
// locked on submit.

"use server"

import { db } from "@/lib/db"
import { requireOrgAction } from "@/lib/auth"
import { toSafeErrorMessage } from "@/lib/prisma-error"
import { revalidatePath } from "next/cache"
import crypto from "node:crypto"
import type { Prisma } from "@/lib/generated/prisma/client"

// ── QS-side: generate a report link ──────────────────────────────────────────

export async function generateSiteReport(cycleId: string) {
  try {
    const { org, userId } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const cycle = await db.paymentCycle.findFirst({
      where: {
        id: cycleId,
        paymentSchedule: { subcontractOrder: { organisationId: org.id } },
      },
      include: {
        siteReport: true,
        paymentSchedule: {
          include: {
            subcontractOrder: { include: { scheduleLines: { orderBy: { sortOrder: "asc" } } } },
          },
        },
      },
    })
    if (!cycle) throw new Error("Cycle not found")

    // If already has a submitted report, regenerate it (new token, new lines)
    if (cycle.siteReport) {
      await db.siteReport.delete({ where: { id: cycle.siteReport.id } })
    }

    const token = crypto.randomBytes(24).toString("hex")
    const boqLines = cycle.paymentSchedule.subcontractOrder.scheduleLines

    const report = await db.siteReport.create({
      data: {
        paymentCycleId: cycleId,
        token,
        createdById: userId,
        lines: {
          create: boqLines.map((l) => ({
            sortOrder: l.sortOrder,
            itemRef: l.itemRef,
            description: l.description,
            indentLevel: l.indentLevel,
            contractValue: l.contractValue,
          })),
        },
      },
    })

    revalidatePath(`/cycles/${cycleId}`)
    return { reportId: report.id, token }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

// ── Public: load report by token ─────────────────────────────────────────────

export async function getSiteReportByToken(token: string) {
  try {
    const report = await db.siteReport.findUnique({
      where: { token },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
        paymentCycle: {
          select: {
            cycleNumber: true,
            paymentSchedule: {
              select: {
                subcontractOrder: {
                  select: {
                    reference: true,
                    subcontractor: { select: { name: true } },
                    project: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    })
    if (!report) return null

    return {
      id: report.id,
      token: report.token,
      status: report.status,
      submittedAt: report.submittedAt,
      cycleNumber: report.paymentCycle.cycleNumber,
      subcontractRef: report.paymentCycle.paymentSchedule.subcontractOrder.reference,
      subcontractorName: report.paymentCycle.paymentSchedule.subcontractOrder.subcontractor.name,
      projectName: report.paymentCycle.paymentSchedule.subcontractOrder.project.name,
      lines: report.lines.map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        itemRef: l.itemRef,
        description: l.description,
        indentLevel: l.indentLevel,
        contractValue: Number(l.contractValue),
        pctComplete: l.pctComplete !== null ? Number(l.pctComplete) : null,
        note: l.note,
        photos: l.photos as PhotoRecord[],
      })),
    }
  } catch (error) {
    console.error("[site-report] failed to load by token:", error)
    return null
  }
}

export type SiteReportData = NonNullable<Awaited<ReturnType<typeof getSiteReportByToken>>>

// ── Public: update a line's pctComplete or note ──────────────────────────────

export async function updateSiteReportLine(token: string, lineId: string, data: { pctComplete?: number | null; note?: string | null }) {
  try {
    const report = await db.siteReport.findUnique({ where: { token } })
    if (!report) throw new Error("Report not found")
    if (report.status === "SUBMITTED") throw new Error("Report is locked")

    await db.siteReportLine.updateMany({
      where: { id: lineId, siteReportId: report.id },
      data: {
        ...(data.pctComplete !== undefined ? { pctComplete: data.pctComplete } : {}),
        ...(data.note !== undefined ? { note: data.note } : {}),
      },
    })
    return { ok: true }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

// ── Public: add photo to a line ──────────────────────────────────────────────

export type PhotoRecord = { url: string; takenAt: string }

export async function addSiteReportPhoto(token: string, lineId: string, photo: PhotoRecord) {
  try {
    const report = await db.siteReport.findUnique({ where: { token } })
    if (!report) throw new Error("Report not found")
    if (report.status === "SUBMITTED") throw new Error("Report is locked")

    const line = await db.siteReportLine.findFirst({ where: { id: lineId, siteReportId: report.id } })
    if (!line) throw new Error("Line not found")

    const existing = (line.photos as PhotoRecord[]) ?? []
    await db.siteReportLine.update({
      where: { id: lineId },
      data: { photos: [...existing, photo] },
    })
    return { ok: true }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

// ── Public: submit (lock) the report ─────────────────────────────────────────

export async function submitSiteReport(token: string) {
  try {
    const report = await db.siteReport.findUnique({ where: { token } })
    if (!report) throw new Error("Report not found")
    if (report.status === "SUBMITTED") throw new Error("Report already submitted")

    await db.siteReport.update({
      where: { id: report.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    })

    // Audit event
    await db.auditEvent.create({
      data: {
        organisationId: (await db.paymentCycle.findUnique({ where: { id: report.paymentCycleId }, select: { paymentSchedule: { select: { subcontractOrder: { select: { organisationId: true } } } } } }))?.paymentSchedule?.subcontractOrder?.organisationId ?? "",
        paymentCycleId: report.paymentCycleId,
        eventType: "site.report.submitted",
        payload: { reportId: report.id, token: token },
      },
    })
    return { ok: true }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}

// ── QS-side: get site report for a cycle ────────────────────────────────────

export async function getCycleSiteReport(cycleId: string) {
  try {
    const { org } = await requireOrgAction({ minRole: "COMMERCIAL" })

    const report = await db.siteReport.findUnique({
      where: {
        paymentCycleId: cycleId,
        paymentCycle: { paymentSchedule: { subcontractOrder: { organisationId: org.id } } },
      },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
      },
    })
    if (!report) return null

    return {
      id: report.id,
      token: report.token,
      status: report.status,
      submittedAt: report.submittedAt,
      createdAt: report.createdAt,
      lines: report.lines.map((l) => ({
        id: l.id,
        sortOrder: l.sortOrder,
        itemRef: l.itemRef,
        description: l.description,
        indentLevel: l.indentLevel,
        contractValue: Number(l.contractValue),
        pctComplete: l.pctComplete !== null ? Number(l.pctComplete) : null,
        note: l.note,
        photos: l.photos as PhotoRecord[],
      })),
    }
  } catch (error) {
    throw new Error(toSafeErrorMessage(error))
  }
}