import { inngest } from "./client"
import { db } from "@/lib/db"
import { getRagStatus } from "@/lib/dashboard"
import { sendDeadlineAlert, sendDocExpiryAlert, sendDailyDigest, sendMissedApplicationAlert, resend } from "@/lib/email/resend"
import { differenceInCalendarDays } from "date-fns"
import { CycleStatus } from "@/lib/generated/prisma/client"

const LIVE_STATUSES: CycleStatus[] = [
  "AWAITING_APPLICATION",
  "APPLICATION_RECEIVED",
  "UNDER_ASSESSMENT",
  "NOTICE_SERVED",
  "PAY_LESS_SERVED",
]

// Called when a background job exhausts all its retries. These jobs are what
// actually check and alert on legally binding payment deadlines — a job that
// dies silently (e.g. a schema drift or DB outage) means a deadline can be
// missed with nobody aware it happened. Logs loudly and, if configured,
// emails an operator so the failure doesn't go unnoticed.
async function notifyOpsOfFailure(fnId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[inngest] "${fnId}" failed after exhausting all retries:`, message)

  const opsEmail = process.env.OPS_ALERT_EMAIL
  if (!opsEmail) return

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "alerts@noticeguard.app",
      to: opsEmail,
      subject: `[NoticeGuard] Background job failed: ${fnId}`,
      text: `The "${fnId}" background job failed after exhausting all retries and will not run again until the next scheduled trigger.\n\nError: ${message}\n\nThis job is part of the deadline-alerting pipeline — investigate promptly.`,
    })
  } catch (sendError) {
    console.error(`[inngest] failed to send ops-failure alert email for "${fnId}":`, sendError)
  }
}

// Runs hourly: evaluates all live cycles and fires alerts where due
export const deadlineSweep = inngest.createFunction(
  {
    id: "deadline-sweep",
    name: "Deadline sweep",
    // Fires every hour on the hour — timezone is irrelevant for an
    // every-hour cadence, unlike the once-a-day sweeps below.
    triggers: [{ cron: "0 * * * *" }],
    onFailure: async ({ error }) => notifyOpsOfFailure("deadline-sweep", error),
  },
  async ({ step }) => {
    const cycles = await step.run("fetch-live-cycles", async () => {
      return db.paymentCycle.findMany({
        where: { status: { in: LIVE_STATUSES } },
        include: {
          paymentSchedule: {
            include: {
              subcontractOrder: {
                include: {
                  project: { select: { name: true, organisationId: true } },
                  subcontractor: { select: { name: true, contactEmails: true } },
                },
              },
            },
          },
          paymentNotice: { select: { status: true } },
          payLessNotice: { select: { status: true } },
        },
      })
    })

    // Memoized so it's stable across step retries within this run — if it
    // were plain `new Date()`, a retry that lands after a delay could shift
    // `now` (and therefore `daysUntil` and the step IDs derived from it),
    // breaking Inngest's replay-memoization and risking a duplicate send.
    const now = new Date(await step.run("get-run-timestamp", async () => new Date()))
    let alertsSent = 0

    // Batch-fetch every org referenced by these cycles once, instead of a
    // separate query per cycle (many cycles typically share the same org).
    const orgIds = [...new Set(cycles.map((c) => c.paymentSchedule.subcontractOrder.organisationId))]
    const orgs = await step.run("fetch-orgs", async () => {
      return db.organisation.findMany({
        where: { id: { in: orgIds } },
        include: {
          members: { select: { email: true, escalationTo: true, role: true } },
          alertConfigs: true,
        },
      })
    })
    const orgById = new Map(orgs.map((o) => [o.id, o]))

    for (const cycle of cycles) {
      const order = cycle.paymentSchedule.subcontractOrder
      const org = orgById.get(order.organisationId)
      if (!org) continue

      // Determine active deadline — wrap in new Date() because Inngest JSON-serializes step results
      let deadlineDate = new Date(cycle.paymentNoticeDeadline as unknown as string)
      let deadlineLabel = "Payment notice deadline"
      if (cycle.status === "PAY_LESS_SERVED") {
        deadlineDate = new Date(cycle.finalDateForPayment as unknown as string)
        deadlineLabel = "Final date for payment"
      } else if (cycle.status === "NOTICE_SERVED" && cycle.payLessNotice?.status !== "SERVED") {
        deadlineDate = new Date(cycle.payLessDeadline as unknown as string)
        deadlineLabel = "Pay-less notice deadline"
      }

      const daysUntil = differenceInCalendarDays(deadlineDate, now)
      const rag = getRagStatus(deadlineDate, now)

      // Default alert offsets: 5d, 2d, 0d (day-of), breached
      const alertOffsets = org.alertConfigs.length > 0
        ? org.alertConfigs.filter((c) => c.enabled && c.alertType === "DEADLINE_APPROACHING").map((c) => c.offsetDays)
        : [5, 2, 0]

      const shouldAlert = alertOffsets.includes(daysUntil) || (daysUntil < 0 && daysUntil > -3)

      if (!shouldAlert) continue

      // Idempotency: check audit log — don't re-send same alert today
      const alreadySent = await db.auditEvent.findFirst({
        where: {
          paymentCycleId: cycle.id,
          eventType: "alert.sent",
          payload: { path: ["daysUntil"], equals: daysUntil },
          createdAt: { gte: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
        },
      })
      if (alreadySent) continue

      const recipients = org.members
        .filter((m) => m.role === "ADMIN" || m.role === "COMMERCIAL")
        .map((m) => m.email)

      // Escalation: if T-1 or breached, also alert escalation contacts
      if (daysUntil <= 1) {
        const escalation = org.members
          .filter((m) => m.escalationTo)
          .map((m) => m.escalationTo!)
        recipients.push(...escalation)
      }

      const uniqueRecipients = [...new Set(recipients)].filter(Boolean)
      if (uniqueRecipients.length === 0) continue

      const cycleUrl = `${process.env.NEXT_PUBLIC_APP_URL}/cycles/${cycle.id}`

      // Split into separate steps: once "send" completes, Inngest memoizes
      // it, so a later failure in "record" retries only the record step
      // instead of re-sending the email.
      await step.run(`send-alert-${cycle.id}-${daysUntil}`, async () => {
        await sendDeadlineAlert({
          to: uniqueRecipients,
          subcontractorName: order.subcontractor.name,
          projectName: order.project.name,
          cycleNumber: cycle.cycleNumber,
          deadlineLabel,
          deadlineDate,
          daysUntil,
          cycleUrl,
          orgName: org.name,
        })
      })

      await step.run(`record-alert-${cycle.id}-${daysUntil}`, async () => {
        await db.auditEvent.create({
          data: {
            organisationId: org.id,
            subcontractOrderId: order.id,
            paymentCycleId: cycle.id,
            eventType: "alert.sent",
            payload: {
              deadlineLabel,
              deadlineDate: deadlineDate.toISOString(),
              daysUntil,
              recipients: uniqueRecipients,
              rag,
            },
          },
        })

        // One-time breach record on first day overdue
        if (daysUntil === -1) {
          const alreadyBreached = await db.auditEvent.findFirst({
            where: { paymentCycleId: cycle.id, eventType: "deadline.breached" },
          })
          if (!alreadyBreached) {
            await db.auditEvent.create({
              data: {
                organisationId: org.id,
                subcontractOrderId: order.id,
                paymentCycleId: cycle.id,
                eventType: "deadline.breached",
                payload: { deadlineLabel, deadlineDate: deadlineDate.toISOString() },
              },
            })
          }
        }
      })

      alertsSent++
    }

    return { cyclesChecked: cycles.length, alertsSent }
  }
)

// Runs daily at 08:00: retention release date reminders
export const retentionReleaseSweep = inngest.createFunction(
  {
    id: "retention-release-sweep",
    name: "Retention release sweep",
    triggers: [{ cron: "TZ=Europe/London 0 8 * * *" }],
    onFailure: async ({ error }) => notifyOpsOfFailure("retention-release-sweep", error),
  },
  async ({ step }) => {
    const now = new Date(await step.run("get-run-timestamp", async () => new Date()))
    const in30 = new Date(now.getTime() + 30 * 86_400_000)
    const DEFAULT_RETENTION_OFFSETS = [30, 14, 7, 1, 0]

    // Fetch full ledger + order/project/subcontractor data in one batched
    // query (previously just IDs, with each ledger and its org re-fetched
    // individually inside the per-item loop below).
    const ledgers = await step.run("fetch-upcoming-releases", async () => {
      return db.retentionLedger.findMany({
        where: {
          OR: [
            { pcReleaseDate: { lte: in30, gte: now }, pcReleasedAt: null },
            { mcdReleaseDate: { lte: in30, gte: now }, mcdReleasedAt: null },
          ],
        },
        include: {
          subcontractOrder: {
            include: {
              project: { select: { name: true } },
              subcontractor: { select: { name: true } },
            },
          },
        },
      })
    })

    // Batch-fetch every org referenced by these ledgers once.
    const retentionOrgIds = [...new Set(ledgers.map((l) => l.subcontractOrder.organisationId))]
    const retentionOrgs = await step.run("fetch-orgs", async () => {
      return db.organisation.findMany({
        where: { id: { in: retentionOrgIds } },
        include: {
          members: { select: { email: true, role: true } },
          alertConfigs: { where: { alertType: "RETENTION_RELEASE", enabled: true } },
        },
      })
    })
    const retentionOrgById = new Map(retentionOrgs.map((o) => [o.id, o]))

    for (const ledger of ledgers) {
      await step.run(`retention-alert-${ledger.id}`, async () => {
        const order = ledger.subcontractOrder
        const org = retentionOrgById.get(order.organisationId)
        if (!org) return

        const ALERT_OFFSETS = org.alertConfigs.length > 0
          ? org.alertConfigs.map((c: { offsetDays: number }) => c.offsetDays)
          : DEFAULT_RETENTION_OFFSETS

        const recipients = org.members
          .filter((m: { role: string }) => m.role === "ADMIN" || m.role === "COMMERCIAL")
          .map((m: { email: string }) => m.email)
        if (recipients.length === 0) return

        const releaseDates: Array<{ type: "pc" | "mcd"; label: string; date: Date; amount: number | null }> = []
        if (ledger.pcReleaseDate && !ledger.pcReleasedAt) {
          releaseDates.push({
            type: "pc",
            label: "Practical Completion",
            date: new Date(ledger.pcReleaseDate as unknown as string),
            amount: ledger.pcReleaseAmount ? Number(ledger.pcReleaseAmount) : null,
          })
        }
        if (ledger.mcdReleaseDate && !ledger.mcdReleasedAt) {
          releaseDates.push({
            type: "mcd",
            label: "Making Good Defects",
            date: new Date(ledger.mcdReleaseDate as unknown as string),
            amount: ledger.mcdReleaseAmount ? Number(ledger.mcdReleaseAmount) : null,
          })
        }

        const fmtGbp = (n: number) =>
          `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

        for (const release of releaseDates) {
          const daysUntil = differenceInCalendarDays(release.date, now)
          if (!ALERT_OFFSETS.includes(daysUntil)) continue

          const alreadySent = await db.auditEvent.findFirst({
            where: {
              subcontractOrderId: order.id,
              eventType: "retention.release.alert",
              payload: { path: ["releaseType"], equals: release.type },
              createdAt: { gte: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
            },
          })
          if (alreadySent) continue

          if (process.env.RESEND_API_KEY) {
            const { sendNoticeEmail } = await import("@/lib/email/resend")
            const dueSoon = daysUntil === 0 ? "today" : `in ${daysUntil} day${daysUntil !== 1 ? "s" : ""}`
            const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#1e293b">
              <div style="background:#1e293b;padding:16px 24px;border-radius:8px 8px 0 0">
                <span style="color:#fff;font-size:16px;font-weight:700">NoticeGuard — Retention release due</span>
              </div>
              <div style="border:1px solid #e2e8f0;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px">
                <p style="margin:0 0 12px;font-size:14px">
                  A <strong>${release.label}</strong> retention release is due <strong>${dueSoon}</strong>.
                </p>
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                  <tr><td style="padding:5px 0;color:#64748b;width:160px">Subcontractor</td><td style="padding:5px 0;font-weight:600">${order.subcontractor.name}</td></tr>
                  <tr><td style="padding:5px 0;color:#64748b">Project</td><td style="padding:5px 0">${order.project.name}</td></tr>
                  <tr><td style="padding:5px 0;color:#64748b">Release type</td><td style="padding:5px 0">${release.label}</td></tr>
                  <tr><td style="padding:5px 0;color:#64748b">Due date</td><td style="padding:5px 0">${release.date.toLocaleDateString("en-GB", { dateStyle: "long" })}</td></tr>
                  ${release.amount !== null ? `<tr><td style="padding:5px 0;color:#64748b">Amount</td><td style="padding:5px 0;font-weight:700">${fmtGbp(release.amount)}</td></tr>` : ""}
                </table>
                <p style="margin-top:16px;font-size:12px;color:#94a3b8">This is an automated reminder from NoticeGuard.</p>
              </div>
            </div>`

            await sendNoticeEmail({
              to: recipients,
              from: org.fromEmail ?? "notices@noticeguard.app",
              fromName: "NoticeGuard",
              subject: `Retention release due ${dueSoon} — ${order.subcontractor.name}`,
              html,
            })
          }

          await db.auditEvent.create({
            data: {
              organisationId: org.id,
              subcontractOrderId: order.id,
              eventType: "retention.release.alert",
              payload: {
                releaseType: release.type,
                releaseLabel: release.label,
                daysUntil,
                releaseDate: release.date.toISOString(),
                amount: release.amount,
                recipients,
              },
            },
          })
        }
      })
    }

    return { ledgersChecked: ledgers.length }
  }
)

// Runs daily at 08:00: document expiry reminders
export const documentExpirySweep = inngest.createFunction(
  {
    id: "document-expiry-sweep",
    name: "Document expiry sweep",
    triggers: [{ cron: "TZ=Europe/London 0 8 * * *" }],
    onFailure: async ({ error }) => notifyOpsOfFailure("document-expiry-sweep", error),
  },
  async ({ step }) => {
    const now = new Date(await step.run("get-run-timestamp", async () => new Date()))
    const in30 = new Date(now.getTime() + 30 * 86_400_000)

    // Recompute stale compliance document statuses first
    await step.run("recompute-doc-statuses", async () => {
      // Mark expired
      await db.complianceDocument.updateMany({
        where: { expiryDate: { lt: now }, status: { not: "EXPIRED" } },
        data: { status: "EXPIRED" },
      })
      // Mark expiring soon (within 30 days)
      await db.complianceDocument.updateMany({
        where: {
          expiryDate: { gte: now, lte: in30 },
          status: { not: "EXPIRING_SOON" },
        },
        data: { status: "EXPIRING_SOON" },
      })
      // Mark valid (has expiry date beyond 30 days, was previously something else)
      await db.complianceDocument.updateMany({
        where: {
          expiryDate: { gt: in30 },
          status: { in: ["EXPIRED", "EXPIRING_SOON"] },
        },
        data: { status: "VALID" },
      })
    })

    const docs = await step.run("fetch-expiring-docs", async () => {
      return db.complianceDocument.findMany({
        where: {
          expiryDate: { lte: in30, gte: now },
          status: { not: "EXPIRED" },
        },
        include: {
          subcontractor: {
            include: {
              organisation: {
                include: {
                  members: { select: { email: true, role: true } },
                  alertConfigs: { where: { alertType: "DOCUMENT_EXPIRY", enabled: true } },
                },
              },
            },
          },
        },
      })
    })

    for (const doc of docs) {
      const daysUntil = differenceInCalendarDays(doc.expiryDate!, now)
      const org = doc.subcontractor.organisation
      const docAlertOffsets = org.alertConfigs.length > 0
        ? org.alertConfigs.map((c) => c.offsetDays)
        : [30, 14, 7]
      if (!docAlertOffsets.includes(daysUntil)) continue

      const alreadySent = await db.auditEvent.findFirst({
        where: {
          eventType: "alert.document_expiry",
          payload: { path: ["documentId"], equals: doc.id },
          createdAt: { gte: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
        },
      })
      if (alreadySent) continue

      const recipients = org.members
        .filter((m) => m.role === "ADMIN" || m.role === "COMMERCIAL")
        .map((m) => m.email)

      if (recipients.length === 0) continue

      await step.run(`doc-expiry-${doc.id}`, async () => {
        const expiryDate = new Date(doc.expiryDate as unknown as string)

        if (process.env.RESEND_API_KEY) {
          await sendDocExpiryAlert({
            to: recipients,
            subcontractorName: doc.subcontractor.name,
            documentType: doc.documentType,
            expiryDate,
            daysUntil,
            orgName: org.name,
          })
        }

        await db.auditEvent.create({
          data: {
            organisationId: org.id,
            eventType: "alert.document_expiry",
            payload: {
              documentId: doc.id,
              documentType: doc.documentType,
              subcontractorName: doc.subcontractor.name,
              expiryDate: expiryDate.toISOString(),
              daysUntil,
              recipients,
            },
          },
        })
      })
    }

    return { docsChecked: docs.length }
  }
)

// Runs daily at 07:00: sends a daily digest to orgs with DAILY_DIGEST enabled
export const dailyDigestSweep = inngest.createFunction(
  {
    id: "daily-digest-sweep",
    name: "Daily digest sweep",
    triggers: [{ cron: "TZ=Europe/London 0 7 * * *" }],
    onFailure: async ({ error }) => notifyOpsOfFailure("daily-digest-sweep", error),
  },
  async ({ step }) => {
    const now = new Date(await step.run("get-run-timestamp", async () => new Date()))
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.noticeguard.app"

    const orgIds = await step.run("fetch-digest-org-ids", async () => {
      const configs = await db.alertConfig.findMany({
        where: { alertType: "DAILY_DIGEST", enabled: true },
        select: { organisationId: true },
        distinct: ["organisationId"],
      })
      return configs.map((c) => c.organisationId)
    })

    for (const orgId of orgIds) {
      await step.run(`digest-${orgId}`, async () => {
        const org = await db.organisation.findUnique({
          where: { id: orgId },
          include: { members: { select: { email: true, role: true } } },
        })
        if (!org) return

        const LIVE_CYCLE_STATUSES: CycleStatus[] = [
          "AWAITING_APPLICATION",
          "APPLICATION_RECEIVED",
          "UNDER_ASSESSMENT",
          "NOTICE_SERVED",
          "PAY_LESS_SERVED",
        ]

        const cycles = await db.paymentCycle.findMany({
          where: {
            status: { in: LIVE_CYCLE_STATUSES },
            paymentSchedule: { subcontractOrder: { organisationId: orgId, isActive: true } },
          },
          include: {
            paymentSchedule: {
              include: {
                subcontractOrder: {
                  include: {
                    project: { select: { name: true } },
                    subcontractor: { select: { name: true } },
                  },
                },
              },
            },
            payLessNotice: { select: { status: true } },
          },
        })

        const mapped = cycles.map((c) => {
          const order = c.paymentSchedule.subcontractOrder
          let nextDeadlineDate = c.paymentNoticeDeadline
          let nextDeadlineLabel = "Payment notice deadline"

          if (c.status === "PAY_LESS_SERVED") {
            nextDeadlineDate = c.finalDateForPayment
            nextDeadlineLabel = "Final date for payment"
          } else if (c.status === "NOTICE_SERVED" && c.payLessNotice?.status !== "SERVED") {
            nextDeadlineDate = c.payLessDeadline
            nextDeadlineLabel = "Pay-less deadline"
          }

          const deadline = new Date(nextDeadlineDate as unknown as string)
          const daysUntil = differenceInCalendarDays(deadline, now)
          const rag = getRagStatus(deadline, now)

          return {
            id: c.id,
            cycleNumber: c.cycleNumber,
            subcontractorName: order.subcontractor.name,
            projectName: order.project.name,
            label: nextDeadlineLabel,
            daysUntil,
            rag,
          }
        })

        const breached = mapped
          .filter((c) => c.rag === "breached")
          .map((c) => ({ ...c, daysOverdue: Math.abs(c.daysUntil) }))
        const urgent = mapped.filter((c) => c.rag === "red")
        const dueSoon = mapped.filter((c) => c.rag === "amber")

        const recipients = org.members
          .filter((m) => m.role === "ADMIN" || m.role === "COMMERCIAL")
          .map((m) => m.email)

        if (recipients.length === 0) return

        if (process.env.RESEND_API_KEY) {
          await sendDailyDigest({
            to: recipients,
            orgName: org.name,
            appUrl: APP_URL,
            breached,
            urgent,
            dueSoon,
            totalLive: cycles.length,
          })
        }

        await db.auditEvent.create({
          data: {
            organisationId: orgId,
            eventType: "alert.daily_digest",
            payload: {
              totalLive: cycles.length,
              breached: breached.length,
              urgent: urgent.length,
              dueSoon: dueSoon.length,
              recipients,
            },
          },
        })
      })
    }

    return { orgsNotified: orgIds.length }
  }
)

// Runs hourly: alerts when no application has been received past the expected date
export const missedApplicationSweep = inngest.createFunction(
  {
    id: "missed-application-sweep",
    name: "Missed application sweep",
    // Fires every hour at :30 — timezone is irrelevant for an every-hour cadence.
    triggers: [{ cron: "30 * * * *" }],
    onFailure: async ({ error }) => notifyOpsOfFailure("missed-application-sweep", error),
  },
  async ({ step }) => {
    const now = new Date(await step.run("get-run-timestamp", async () => new Date()))
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.noticeguard.app"

    const overdueCycles = await step.run("fetch-overdue-application-cycles", async () => {
      return db.paymentCycle.findMany({
        where: {
          status: "AWAITING_APPLICATION",
          applicationExpectedDate: { lt: now },
        },
        include: {
          paymentSchedule: {
            include: {
              subcontractOrder: {
                include: {
                  project: { select: { name: true, organisationId: true } },
                  subcontractor: { select: { name: true } },
                },
              },
            },
          },
        },
      })
    })

    let alertsSent = 0

    // Batch-fetch every org referenced by these cycles once, instead of a
    // separate query per cycle.
    const overdueOrgIds = [...new Set(overdueCycles.map((c) => c.paymentSchedule.subcontractOrder.organisationId))]
    const overdueOrgs = await step.run("fetch-orgs", async () => {
      return db.organisation.findMany({
        where: { id: { in: overdueOrgIds } },
        include: {
          members: { select: { email: true, role: true } },
          alertConfigs: { where: { alertType: "DEADLINE_APPROACHING", enabled: true } },
        },
      })
    })
    const overdueOrgById = new Map(overdueOrgs.map((o) => [o.id, o]))

    for (const cycle of overdueCycles) {
      const order = cycle.paymentSchedule.subcontractOrder
      const org = overdueOrgById.get(order.organisationId)
      if (!org) continue

      const appExpected = new Date(cycle.applicationExpectedDate as unknown as string)
      const daysOverdue = differenceInCalendarDays(now, appExpected)

      // Only alert on days 1, 2, and 3 overdue to avoid repeated noise
      if (daysOverdue < 1 || daysOverdue > 3) continue

      const alreadySent = await db.auditEvent.findFirst({
        where: {
          paymentCycleId: cycle.id,
          eventType: "alert.missed_application",
          payload: { path: ["daysOverdue"], equals: daysOverdue },
          createdAt: { gte: new Date(now.getTime() - 23 * 60 * 60 * 1000) },
        },
      })
      if (alreadySent) continue

      const recipients = org.members
        .filter((m) => m.role === "ADMIN" || m.role === "COMMERCIAL")
        .map((m) => m.email)
      if (recipients.length === 0) continue

      const cycleUrl = `${APP_URL}/cycles/${cycle.id}`

      // Split into separate steps: once "send" completes, Inngest memoizes
      // it, so a later failure in "record" retries only the record step
      // instead of re-sending the email.
      await step.run(`missed-app-send-${cycle.id}-${daysOverdue}`, async () => {
        if (process.env.RESEND_API_KEY) {
          await sendMissedApplicationAlert({
            to: recipients,
            subcontractorName: order.subcontractor.name,
            projectName: order.project.name,
            cycleNumber: cycle.cycleNumber,
            applicationExpectedDate: appExpected,
            paymentNoticeDeadline: new Date(cycle.paymentNoticeDeadline as unknown as string),
            daysOverdue,
            cycleUrl,
            orgName: org.name,
          })
        }
      })

      await step.run(`missed-app-record-${cycle.id}-${daysOverdue}`, async () => {
        await db.auditEvent.create({
          data: {
            organisationId: org.id,
            subcontractOrderId: order.id,
            paymentCycleId: cycle.id,
            eventType: "alert.missed_application",
            payload: {
              daysOverdue,
              applicationExpectedDate: appExpected.toISOString(),
              recipients,
            },
          },
        })
      })

      alertsSent++
    }

    return { cyclesChecked: overdueCycles.length, alertsSent }
  }
)
