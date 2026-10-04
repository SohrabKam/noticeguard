import { requireOrg } from "@/lib/auth"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { getRagStatus } from "@/lib/dashboard"
import { RagBadge } from "@/components/dashboard/rag-badge"
import { CycleStatusLabel } from "@/components/dashboard/cycle-status-label"
import { initAssessment } from "@/lib/actions/assessments"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssessmentWorkspaceLoader } from "@/components/cycles/assessment-workspace-loader"
import { ApplicationPanel } from "@/components/cycles/application-panel"
import { NoticePanel } from "@/components/cycles/notice-panel"
import { MarkPaidButton } from "@/components/cycles/mark-paid-button"
import { CloseCycleButton } from "@/components/cycles/close-cycle-button"
import { MilestoneDateEditor } from "@/components/cycles/milestone-date-editor"
import { AlertTriangle } from "lucide-react"

export default async function CycleWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { org } = await requireOrg()

  const cycle = await db.paymentCycle.findFirst({
    where: {
      id,
      paymentSchedule: {
        subcontractOrder: { organisationId: org.id },
      },
    },
    include: {
      application: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
      assessment: {
        include: {
          lines: { orderBy: { sortOrder: "asc" } },
        },
      },
      paymentNotice: true,
      payLessNotice: true,
      paymentSchedule: {
        include: {
          subcontractOrder: {
            include: {
              subcontractor: true,
              project: true,
            },
          },
        },
      },
    },
  })

  if (!cycle) notFound()

  // Auto-init assessment if the cycle is ready (application received or already under assessment)
  let assessmentId = cycle.assessment?.id
  if (!assessmentId && (cycle.status === "APPLICATION_RECEIVED" || cycle.status === "UNDER_ASSESSMENT")) {
    const result = await initAssessment(id)
    assessmentId = result.assessmentId
    // Re-fetch to get the created lines
    const refreshed = await db.paymentCycle.findUnique({
      where: { id },
      include: {
        assessment: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
        application: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
        paymentNotice: true,
        payLessNotice: true,
        paymentSchedule: {
          include: {
            subcontractOrder: {
              include: { subcontractor: true, project: true },
            },
          },
        },
      },
    })
    if (refreshed?.assessment) {
      cycle.assessment = refreshed.assessment
    }
  }

  const auditEvents = await db.auditEvent.findMany({
    where: { paymentCycleId: id },
    orderBy: { createdAt: "desc" },
  })

  const order = cycle.paymentSchedule.subcontractOrder
  const now = new Date()
  const rag = getRagStatus(new Date(cycle.paymentNoticeDeadline), now)

  // AssessmentWorkspace is a client component with its own plain-number
  // Assessment type — convert Prisma's Decimal fields explicitly here rather
  // than casting the whole object with `any` at the call site.
  const assessmentForWorkspace = cycle.assessment
    ? {
        id: cycle.assessment.id,
        isLocked: cycle.assessment.isLocked,
        grossValuation: Number(cycle.assessment.grossValuation),
        retentionAmount: Number(cycle.assessment.retentionAmount),
        previouslyCert: Number(cycle.assessment.previouslyCert),
        netThisCycle: Number(cycle.assessment.netThisCycle),
        lastSavedAt: cycle.assessment.lastSavedAt,
        lines: cycle.assessment.lines.map((l) => ({
          id: l.id,
          sortOrder: l.sortOrder,
          itemRef: l.itemRef,
          description: l.description,
          contractValue: Number(l.contractValue),
          isVariation: l.isVariation,
          indentLevel: l.indentLevel,
          qtyOrPctComplete: l.qtyOrPctComplete !== null ? Number(l.qtyOrPctComplete) : null,
          valueToDate: Number(l.valueToDate),
          claimedValueToDate: l.claimedValueToDate !== null ? Number(l.claimedValueToDate) : null,
          previouslyCertified: Number(l.previouslyCertified),
          thisCycle: Number(l.thisCycle),
          notes: l.notes,
        })),
      }
    : null

  // Same Decimal→number serialization for the other client components on
  // this page, which each declare their own plain-number prop type.
  const applicationForPanel = cycle.application
    ? {
        id: cycle.application.id,
        amountApplied: Number(cycle.application.amountApplied),
        dateReceived: cycle.application.dateReceived,
        receivedVia: cycle.application.receivedVia,
        notes: cycle.application.notes,
        attachmentUrl: cycle.application.attachmentUrl,
        lines: cycle.application.lines.map((l) => ({
          id: l.id,
          sortOrder: l.sortOrder,
          itemRef: l.itemRef,
          description: l.description,
          contractValue: Number(l.contractValue),
          isVariation: l.isVariation,
          indentLevel: l.indentLevel,
          qtyOrPctClaimed: l.qtyOrPctClaimed !== null ? Number(l.qtyOrPctClaimed) : null,
          valueToDateClaimed: Number(l.valueToDateClaimed),
          notes: l.notes,
        })),
      }
    : null

  const paymentNoticeForPanel = cycle.paymentNotice
    ? {
        id: cycle.paymentNotice.id,
        status: cycle.paymentNotice.status,
        sumDue: Number(cycle.paymentNotice.sumDue),
        basis: cycle.paymentNotice.basis,
        servedAt: cycle.paymentNotice.servedAt,
        serviceMethod: cycle.paymentNotice.serviceMethod,
      }
    : null

  const payLessNoticeForPanel = cycle.payLessNotice
    ? {
        id: cycle.payLessNotice.id,
        status: cycle.payLessNotice.status,
        sumDue: Number(cycle.payLessNotice.sumDue),
        basis: cycle.payLessNotice.basis,
        servedAt: cycle.payLessNotice.servedAt,
        serviceMethod: cycle.payLessNotice.serviceMethod,
      }
    : null

  const assessmentForNoticePanel = cycle.assessment
    ? {
        id: cycle.assessment.id,
        grossValuation: Number(cycle.assessment.grossValuation),
        retentionAmount: Number(cycle.assessment.retentionAmount),
        previouslyCert: Number(cycle.assessment.previouslyCert),
        netThisCycle: Number(cycle.assessment.netThisCycle),
      }
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="text-sm text-slate-400 mb-1">
          <Link href="/subcontracts" className="hover:underline">Subcontracts</Link>
          {" / "}
          <Link href={`/subcontracts/${order.id}`} className="hover:underline">{order.reference}</Link>
          {" / "}
          Cycle #{cycle.cycleNumber}
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {order.subcontractor.name} — Cycle #{cycle.cycleNumber}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">{order.project.name} · {order.reference}</p>
          </div>
          <div className="flex items-center gap-3">
            <CycleStatusLabel status={cycle.status} />
            <RagBadge status={rag} />
            {(cycle.status === "NOTICE_SERVED" || cycle.status === "PAY_LESS_SERVED") && (
              <MarkPaidButton cycleId={id} />
            )}
            {cycle.status !== "PAID" && cycle.status !== "CLOSED" && (
              <CloseCycleButton cycleId={id} />
            )}
            <Link
              href={`/cycles/${id}/bundle`}
              className="text-xs text-slate-400 hover:text-indigo-600 font-medium"
            >
              Bundle ↗
            </Link>
          </div>
        </div>
      </div>

      {/* Missed application banner */}
      {cycle.status === "AWAITING_APPLICATION" && new Date(cycle.applicationExpectedDate) < now && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-5 py-3 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">No application received</p>
            <p className="text-sm text-amber-700 mt-0.5">
              The application was due {formatDate(new Date(cycle.applicationExpectedDate))} but nothing has been logged.
              Under the Scheme for Construction Contracts you may issue a payment notice based on your own assessment.
            </p>
          </div>
        </div>
      )}

      {/* Key dates bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border p-3 bg-white">
          <p className="text-xs text-slate-500 mb-1">Application due</p>
          <p className="text-sm font-semibold text-slate-900">{formatDate(new Date(cycle.applicationExpectedDate))}</p>
          {cycle.status === "AWAITING_APPLICATION" && cycle.paymentSchedule.appDueDateRule === "MILESTONE" && (
            <MilestoneDateEditor
              cycleId={id}
              currentDate={new Date(cycle.applicationExpectedDate)}
            />
          )}
        </div>
        <DateCard label="Payment notice deadline" date={new Date(cycle.paymentNoticeDeadline)} highlight />
        <DateCard label="Pay-less deadline" date={new Date(cycle.payLessDeadline)} />
        <DateCard label="Final date for payment" date={new Date(cycle.finalDateForPayment)} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={
        cycle.status === "AWAITING_APPLICATION" ? "application"
        : cycle.status === "CLOSED" ? "audit"
        : (cycle.status === "NOTICE_SERVED" || cycle.status === "PAY_LESS_SERVED" || cycle.status === "PAID") ? "notices"
        : "assessment"
      }>
        <TabsList>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="mt-4">
          {assessmentForWorkspace ? (
            <AssessmentWorkspaceLoader
              assessment={assessmentForWorkspace}
              retentionPct={Number(order.retentionPct)}
              cycleId={id}
              isLocked={assessmentForWorkspace.isLocked}
            />
          ) : (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
              Log an application first to unlock the assessment grid.
            </div>
          )}
        </TabsContent>

        <TabsContent value="application" className="mt-4">
          <ApplicationPanel
            cycleId={id}
            application={applicationForPanel}
          />
        </TabsContent>

        <TabsContent value="notices" className="mt-4">
          <NoticePanel
            cycleId={id}
            cycleStatus={cycle.status}
            paymentNotice={paymentNoticeForPanel}
            payLessNotice={payLessNoticeForPanel}
            assessment={assessmentForNoticePanel}
            subcontractorName={order.subcontractor.name}
            paymentNoticeDeadline={new Date(cycle.paymentNoticeDeadline)}
            payLessDeadline={new Date(cycle.payLessDeadline)}
            finalDateForPayment={new Date(cycle.finalDateForPayment)}
          />
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <AuditTrail events={auditEvents} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DateCard({
  label,
  date,
  highlight,
}: {
  label: string
  date: Date
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-indigo-200 bg-indigo-50" : "bg-white"
      }`}
    >
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${highlight ? "text-indigo-700" : "text-slate-900"}`}>
        {formatDate(date)}
      </p>
    </div>
  )
}

const EVENT_LABELS: Record<string, string> = {
  "notice.payment.served": "Payment notice served",
  "notice.payless.served": "Pay-less notice served",
  "notice.email.sent": "Notice email sent",
  "notice.email.delivered": "Notice email delivered",
  "notice.email.delayed": "Notice email delivery delayed",
  "notice.email.bounced": "Notice email bounced",
  "notice.email.complained": "Notice email spam complaint",
  "cycle.paid": "Marked as paid",
  "cycle.marked_paid": "Marked as paid",
  "application.logged": "Application logged",
  "application.received": "Application received",
  "assessment.saved": "Assessment saved",
  "assessment.initialised": "Assessment initialised",
  "deadline.breached": "Payment notice deadline passed",
  "alert.sent": "Deadline alert sent",
  "alert.document_expiry": "Document expiry alert sent",
  "document.expiry.alert": "Document expiry alert sent",
  "alert.missed_application": "Missed application alert sent",
  "cycle.closed": "Cycle closed",
  "cycle.milestone_date_set": "Milestone application date set",
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function AuditTrail({ events }: { events: any[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
        No audit events recorded for this cycle yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white divide-y">
      {events.map((ev) => (
        <div key={ev.id} className="flex items-start gap-4 px-5 py-3.5">
          <div className="mt-0.5 w-2 h-2 rounded-full bg-indigo-400 shrink-0 mt-2" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">
              {EVENT_LABELS[ev.eventType] ?? ev.eventType}
            </p>
            {ev.payload && typeof ev.payload === "object" && Object.keys(ev.payload as object).length > 0 && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {Object.entries(ev.payload as Record<string, unknown>)
                  .filter(([, v]) => v !== null && v !== undefined && v !== "")
                  .map(([k, v]) => `${k}: ${String(v)}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          <time className="text-xs text-slate-400 shrink-0 tabular-nums">
            {new Date(ev.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </time>
        </div>
      ))}
    </div>
  )
}
