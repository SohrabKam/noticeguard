import { requireOrg } from "@/lib/auth"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { Prisma } from "@/lib/generated/prisma/client"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { RagBadge } from "@/components/dashboard/rag-badge"
import { CycleStatusLabel } from "@/components/dashboard/cycle-status-label"
import { getRagStatus } from "@/lib/dashboard"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LogVariationSheet } from "@/components/variations/log-variation-sheet"
import { EditVariationSheet } from "@/components/variations/edit-variation-sheet"
import { RetentionPanel } from "@/components/retention/retention-panel"
import { SubcontractSettingsForm } from "@/components/subcontracts/subcontract-settings-form"
import { UpsertDocSheet } from "@/components/compliance/upsert-doc-sheet"
import { ScheduleEditorLoader } from "@/components/schedule/schedule-editor-loader"
import { ExtendScheduleForm } from "@/components/schedule/extend-schedule-form"
import { AUDIT_EVENT_LABELS } from "@/lib/audit-event-labels"

type CycleWithNotices = Prisma.PaymentCycleGetPayload<{
  include: {
    application: true
    paymentNotice: { select: { status: true; servedAt: true; sumDue: true } }
    payLessNotice: { select: { status: true; servedAt: true; sumDue: true } }
  }
}>

function CycleTable({ rows, dim, now }: { rows: CycleWithNotices[]; dim?: boolean; now: Date }) {
  return (
    <div className={`rounded-lg border bg-white overflow-hidden shadow-sm ${dim ? "opacity-60" : ""}`}>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">#</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">PN deadline</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Final date</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
            <th className="text-right px-4 py-2.5 font-medium text-slate-600">Certified</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-600">RAG</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((cycle) => {
            const rag = getRagStatus(cycle.paymentNoticeDeadline, now)
            const notice = cycle.payLessNotice?.status === "SERVED" ? cycle.payLessNotice : cycle.paymentNotice
            const certified = notice?.status === "SERVED" ? Number(notice.sumDue) : null
            return (
              <tr key={cycle.id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium">#{cycle.cycleNumber}</td>
                <td className="px-4 py-2.5">{formatDate(new Date(cycle.paymentNoticeDeadline))}</td>
                <td className="px-4 py-2.5 text-slate-500">{formatDate(new Date(cycle.finalDateForPayment))}</td>
                <td className="px-4 py-2.5"><CycleStatusLabel status={cycle.status} /></td>
                <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                  {certified !== null ? `£${certified.toLocaleString("en-GB", { minimumFractionDigits: 2 })}` : "—"}
                </td>
                <td className="px-4 py-2.5"><RagBadge status={rag} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Link href={`/cycles/${cycle.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                      Open →
                    </Link>
                    {notice?.status === "SERVED" && (
                      <a
                        href={`/cycles/${cycle.id}/notice-print?type=${cycle.payLessNotice?.status === "SERVED" ? "payless" : "payment"}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-400 hover:text-slate-600"
                        title="View notice"
                      >
                        Notice ↗
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function SubcontractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { org } = await requireOrg()

  const [fullOrg, order] = await Promise.all([
    db.organisation.findUnique({ where: { id: org.id }, select: { requiredDocTypes: true } }),
    db.subcontractOrder.findFirst({
      where: { id, organisationId: org.id },
      include: {
        project: true,
        subcontractor: {
          include: { complianceDocs: { orderBy: { documentType: "asc" } } },
        },
        scheduleLines: { orderBy: { sortOrder: "asc" } },
        paymentSchedule: {
          include: {
            cycles: {
              orderBy: { cycleNumber: "asc" },
              include: {
                application: true,
                paymentNotice: { select: { status: true, servedAt: true, sumDue: true } },
                payLessNotice: { select: { status: true, servedAt: true, sumDue: true } },
              },
            },
          },
        },
        variations: { orderBy: { createdAt: "desc" } },
        retentionLedger: true,
        auditEvents: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
  ])

  if (!order) notFound()

  const requiredDocTypes = fullOrg?.requiredDocTypes ?? []
  const cycles = order.paymentSchedule?.cycles ?? []
  const now = new Date()

  // Aggregate certified-to-date from all served notices (prefer payless over payment per cycle)
  const certifiedToDate = cycles.reduce((sum, c) => {
    const notice = c.payLessNotice?.status === "SERVED" ? c.payLessNotice : c.paymentNotice?.status === "SERVED" ? c.paymentNotice : null
    return sum + (notice?.sumDue ? Number(notice.sumDue) : 0)
  }, 0)

  // Include agreed variations in the adjusted contract sum
  const agreedVariationsTotal = order.variations
    .filter((v) => v.status === "AGREED")
    .reduce((sum, v) => sum + (v.agreedValue ? Number(v.agreedValue) : 0), 0)
  const adjustedContractSum = Number(order.contractSum) + agreedVariationsTotal

  const pctComplete = adjustedContractSum > 0
    ? (certifiedToDate / adjustedContractSum) * 100
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-400 mb-1">
            <Link href="/subcontracts" className="hover:underline">Subcontracts</Link> / {order.reference}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{order.subcontractor.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {order.reference} · {order.project.name} ·{" "}
            £{adjustedContractSum.toLocaleString("en-GB")} contract sum
            {agreedVariationsTotal !== 0 && (
              <span className="text-xs text-slate-400 ml-1">
                (incl. {agreedVariationsTotal > 0 ? "+" : ""}£{agreedVariationsTotal.toLocaleString("en-GB")} variations)
              </span>
            )}
          </p>
          {certifiedToDate > 0 && (
            <p className="text-xs text-slate-400 mt-1">
              £{certifiedToDate.toLocaleString("en-GB", { minimumFractionDigits: 2 })} certified to date
              {" "}({pctComplete.toFixed(1)}% of contract)
            </p>
          )}
        </div>
        <Link
          href={`/subcontracts/new`}
          className="text-sm text-indigo-600 hover:underline"
        >
          + New subcontract
        </Link>
      </div>

      <Tabs defaultValue="cycles">
        <TabsList>
          <TabsTrigger value="cycles">Payment cycles ({cycles.length})</TabsTrigger>
          <TabsTrigger value="variations">Variations ({order.variations.length})</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="docs">Compliance docs</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="cycles" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <a
              href={`/api/subcontracts/${order.id}/export`}
              className="text-xs font-medium text-slate-500 hover:text-indigo-600 border border-slate-200 rounded px-3 py-1.5 bg-white hover:border-indigo-300 transition-colors"
            >
              Export CSV ↓
            </a>
          </div>
          {(() => {
            const lookahead = new Date(now.getTime() + 45 * 86_400_000)
            const pastPaid = cycles.filter((c) => c.status === "PAID" || c.status === "CLOSED")
            const active = cycles.filter((c) => !["PAID", "CLOSED", "AWAITING_APPLICATION"].includes(c.status))
            const awaitingActive = cycles.filter((c) => c.status === "AWAITING_APPLICATION" && new Date(c.applicationExpectedDate) <= lookahead)
            const awaitingFuture = cycles.filter((c) => c.status === "AWAITING_APPLICATION" && new Date(c.applicationExpectedDate) > lookahead)
            const liveCycles = [...active, ...awaitingActive]

            return (
              <>
                {liveCycles.length > 0 && <CycleTable rows={liveCycles} now={now} />}
                {pastPaid.length > 0 && (
                  <details>
                    <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 mb-2">
                      {pastPaid.length} paid / closed cycle{pastPaid.length !== 1 ? "s" : ""}
                    </summary>
                    <CycleTable rows={pastPaid} now={now} dim />
                  </details>
                )}
                {awaitingFuture.length > 0 && (
                  <details>
                    <summary className="text-xs font-medium text-slate-400 cursor-pointer hover:text-slate-600 mb-2">
                      {awaitingFuture.length} future scheduled cycle{awaitingFuture.length !== 1 ? "s" : ""}
                    </summary>
                    <CycleTable rows={awaitingFuture} now={now} dim />
                  </details>
                )}
                {liveCycles.length === 0 && pastPaid.length === 0 && awaitingFuture.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
                    No cycles generated yet.
                  </div>
                )}
              </>
            )
          })()}
        </TabsContent>

        <TabsContent value="variations" className="mt-4">
          <div className="flex justify-end mb-3">
            <LogVariationSheet orderId={order.id} />
          </div>
          <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
            {order.variations.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">No variations logged yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ref</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Description</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Est. value</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Agreed value</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {order.variations.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs">{v.reference}</td>
                      <td className="px-4 py-3">{v.description}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          v.status === "AGREED"
                            ? "bg-emerald-100 text-emerald-700"
                            : v.status === "INSTRUCTED"
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-slate-100 text-slate-500"
                        }`}>
                          {v.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {v.estimatedValue ? `£${Number(v.estimatedValue).toLocaleString("en-GB")}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {v.agreedValue ? `£${Number(v.agreedValue).toLocaleString("en-GB")}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                        {v.attachmentUrls.length > 0 && (
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            📎 {v.attachmentUrls.length}
                          </span>
                        )}
                        <EditVariationSheet
                          variation={{
                            id: v.id,
                            orderId: order.id,
                            reference: v.reference,
                            description: v.description,
                            status: v.status,
                            estimatedValue: v.estimatedValue ? Number(v.estimatedValue) : null,
                            agreedValue: v.agreedValue ? Number(v.agreedValue) : null,
                            notes: v.notes,
                            attachmentUrls: v.attachmentUrls,
                          }}
                        />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="retention" className="mt-4">
          <RetentionPanel
            orderId={order.id}
            ledger={order.retentionLedger ? {
              ...order.retentionLedger,
              totalHeld: Number(order.retentionLedger.totalHeld),
              pcReleaseAmount: order.retentionLedger.pcReleaseAmount !== null ? Number(order.retentionLedger.pcReleaseAmount) : null,
              mcdReleaseAmount: order.retentionLedger.mcdReleaseAmount !== null ? Number(order.retentionLedger.mcdReleaseAmount) : null,
            } : null}
            contractSum={Number(order.contractSum)}
            retentionPct={Number(order.retentionPct)}
          />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleEditorLoader
            orderId={order.id}
            lines={order.scheduleLines.map((l) => ({
              id: l.id,
              sortOrder: l.sortOrder,
              itemRef: l.itemRef,
              description: l.description,
              contractValue: Number(l.contractValue) || 0,
              indentLevel: (l.indentLevel as number | null) ?? 0,
              isVariation: l.isVariation,
            }))}
          />
        </TabsContent>

        <TabsContent value="docs" className="mt-4">
          {(() => {
            const covered = new Set(order.subcontractor.complianceDocs.map((d) => d.documentType))
            const missingTypes = requiredDocTypes.filter((t) => !covered.has(t))
            const hasDocs = order.subcontractor.complianceDocs.length > 0 || missingTypes.length > 0
            return (
              <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Compliance documents</span>
                  <UpsertDocSheet
                    subcontractorId={order.subcontractor.id}
                    subcontractorName={order.subcontractor.name}
                    requiredDocTypes={requiredDocTypes}
                  />
                </div>
                {!hasDocs ? (
                  <div className="py-12 text-center text-slate-400 text-sm">No compliance documents.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Document type</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Issue date</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Expiry date</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-slate-600">File</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {order.subcontractor.complianceDocs.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">{d.documentType}</td>
                          <td className="px-4 py-3">
                            {d.issueDate ? formatDate(new Date(d.issueDate)) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {d.expiryDate ? formatDate(new Date(d.expiryDate)) : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                d.status === "VALID"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : d.status === "EXPIRING_SOON"
                                  ? "bg-amber-100 text-amber-700"
                                  : d.status === "EXPIRED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {d.status.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {d.fileUrl ? (
                              <a
                                href={`/api/compliance-documents/${d.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-600 hover:underline"
                              >
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-slate-300">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <UpsertDocSheet
                              subcontractorId={order.subcontractor.id}
                              subcontractorName={order.subcontractor.name}
                              requiredDocTypes={requiredDocTypes}
                              existing={{
                                id: d.id,
                                documentType: d.documentType,
                                issueDate: d.issueDate,
                                expiryDate: d.expiryDate,
                                notes: d.notes,
                                fileUrl: d.fileUrl,
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                      {missingTypes.map((t) => (
                        <tr key={`missing-${t}`} className="bg-slate-50/60">
                          <td className="px-4 py-3 text-slate-400">{t}</td>
                          <td className="px-4 py-3 text-slate-300">—</td>
                          <td className="px-4 py-3 text-slate-300">—</td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">MISSING</span>
                          </td>
                          <td className="px-4 py-3 text-slate-300 text-xs">—</td>
                          <td className="px-4 py-3">
                            <UpsertDocSheet
                              subcontractorId={order.subcontractor.id}
                              subcontractorName={order.subcontractor.name}
                              requiredDocTypes={requiredDocTypes}
                              prefillDocType={t}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })()}
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          {order.auditEvents.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-slate-200 py-12 text-center text-sm text-slate-400">
              No audit events recorded for this subcontract yet.
            </div>
          ) : (
            <div className="rounded-lg border bg-white divide-y shadow-sm">
              {order.auditEvents.map((e) => (
                <div key={e.id} className="flex items-start gap-4 px-5 py-3.5">
                  <div className="mt-2 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900">
                      {AUDIT_EVENT_LABELS[e.eventType] ?? e.eventType}
                    </p>
                    {e.payload && typeof e.payload === "object" && Object.keys(e.payload as object).length > 0 && (
                      <p className="text-xs text-slate-400 mt-0.5 truncate">
                        {Object.entries(e.payload as Record<string, unknown>)
                          .filter(([, v]) => v !== null && v !== undefined && v !== "")
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <time className="text-xs text-slate-400 shrink-0 tabular-nums">
                    {new Date(e.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-4 space-y-6">
          <SubcontractSettingsForm
            orderId={order.id}
            description={order.description ?? ""}
            signatory={order.signatory ?? ""}
            noticeRecipients={order.noticeRecipients}
            contactEmails={order.subcontractor.contactEmails}
            contractSum={Number(order.contractSum)}
            retentionPct={Number(order.retentionPct) * 100}
            inboundEmail={order.inboundEmail ?? ""}
          />

          {order.paymentSchedule && (
            <div className="max-w-lg rounded-lg border bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Payment schedule terms</h3>
                <ExtendScheduleForm
                  orderId={order.id}
                  currentEndDate={new Date(order.paymentSchedule.scheduleEndDate)}
                />
              </div>
              <p className="text-xs text-slate-400">These were set at contract creation and determine how cycle dates are calculated.</p>
              <div className="text-sm space-y-2">
                {[
                  { label: "Schedule period", value: `${formatDate(new Date(order.paymentSchedule.scheduleStartDate))} — ${formatDate(new Date(order.paymentSchedule.scheduleEndDate))}` },
                  { label: "Application due", value: (() => {
                    const s = order.paymentSchedule
                    if (s.appDueDateRule === "FIXED_DAY_OF_MONTH") return `Day ${s.appDueDayOfMonth} of each month`
                    if (s.appDueDateRule === "FIXED_DAY_OF_WEEK") {
                      const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
                      const WEEKS: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "Last" }
                      const day = DAYS[s.appDueDayOfWeek ?? 4] ?? "Thursday"
                      const week = WEEKS[s.appDueWeekOfMonth ?? -1] ?? "Last"
                      return `${week} ${day} of each month`
                    }
                    return "Milestone-driven (set per cycle)"
                  })() },
                  { label: "Payment notice deadline", value: `${order.paymentSchedule.paymentNoticeDeadlineDays} ${order.paymentSchedule.paymentNoticeDeadlineType.toLowerCase()} days after due date` },
                  { label: "Final date for payment", value: `${order.paymentSchedule.finalDateOffsetDays} ${order.paymentSchedule.finalDateOffsetType.toLowerCase()} days after due date` },
                  { label: "Pay-less deadline", value: `${order.paymentSchedule.payLessDeadlineDays} ${order.paymentSchedule.payLessDeadlineType.toLowerCase()} days before final date` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-1 border-b last:border-0">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
