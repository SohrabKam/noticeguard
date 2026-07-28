import { requireOrg } from "@/lib/auth"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { computeAssessmentTotals, computeAutoSums } from "@/lib/assessment-totals"
import { AUDIT_EVENT_LABELS } from "@/lib/audit-event-labels"
import { PrintButton } from "../notice-print/print-button"

export default async function BundlePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { org } = await requireOrg()

  const fullOrg = await db.organisation.findUnique({ where: { id: org.id } })

  const cycle = await db.paymentCycle.findFirst({
    where: {
      id,
      paymentSchedule: { subcontractOrder: { organisationId: org.id } },
    },
    include: {
      application: true,
      assessment: { include: { lines: { orderBy: { sortOrder: "asc" } } } },
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

  if (!cycle) notFound()

  const auditEvents = await db.auditEvent.findMany({
    where: { paymentCycleId: id },
    orderBy: { createdAt: "asc" },
  })

  const order = cycle.paymentSchedule.subcontractOrder
  const fmtGbp = (n: number | string) =>
    `£${Number(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const assessment = cycle.assessment
  // Excludes parent (section/item) rows from the sum — see lib/assessment-totals.ts.
  const assessmentLinesForCalc = assessment
    ? assessment.lines.map((l) => ({
        indentLevel: l.indentLevel,
        valueToDate: Number(l.valueToDate),
        previouslyCertified: Number(l.previouslyCertified),
      }))
    : []
  const totals = assessment
    ? computeAssessmentTotals(assessmentLinesForCalc, Number(order.retentionPct))
    : null
  const lineAutoSums = computeAutoSums(assessmentLinesForCalc)
  const gross = totals?.gross ?? null
  const retention = totals?.retention ?? null
  const prev = totals?.prev ?? null
  const net = totals?.net ?? null

  const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; font-size: 12px; }
          .bundle { max-width: 100% !important; margin: 0 !important; border: none !important; border-radius: 0 !important; }
          .section { break-inside: avoid; }
        }
        @media screen {
          body { background: #f1f5f9; }
          .bundle { max-width: 800px; margin: 32px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; }
        }
      `}</style>

      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <PrintButton />
        <a
          href={`/cycles/${id}`}
          className="inline-flex items-center px-3 py-1.5 rounded-md border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          ← Back
        </a>
      </div>

      <div className="bundle" style={{ fontFamily: "sans-serif", color: "#1e293b" }}>
        {/* Header */}
        <div style={{ background: "#1e293b", padding: "20px 28px", borderRadius: "8px 8px 0 0" }}>
          <div style={{ color: "#fff", fontSize: "18px", fontWeight: 700 }}>{fullOrg?.name}</div>
          <div style={{ color: "#94a3b8", fontSize: "12px", marginTop: "4px" }}>
            Compliance bundle — generated {generatedAt}
          </div>
        </div>

        <div style={{ padding: "28px" }}>
          {/* Cycle header */}
          <h1 style={{ margin: "0 0 4px", fontSize: "20px", fontWeight: 700 }}>
            {order.subcontractor.name} — Payment Cycle #{cycle.cycleNumber}
          </h1>
          <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: "14px" }}>
            {order.project.name} · {order.reference}
          </p>

          {/* Key dates */}
          <div className="section" style={{ marginBottom: "24px" }}>
            <SectionTitle>Key dates</SectionTitle>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                <BRow label="Application expected" value={formatDate(new Date(cycle.applicationExpectedDate))} />
                <BRow label="Payment notice deadline" value={formatDate(new Date(cycle.paymentNoticeDeadline))} />
                <BRow label="Pay-less notice deadline" value={formatDate(new Date(cycle.payLessDeadline))} />
                <BRow label="Final date for payment" value={formatDate(new Date(cycle.finalDateForPayment))} />
                <BRow label="Status" value={cycle.status.replace(/_/g, " ")} />
              </tbody>
            </table>
          </div>

          {/* Application */}
          {cycle.application && (
            <div className="section" style={{ marginBottom: "24px" }}>
              <SectionTitle>Application received</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  <BRow label="Amount applied for" value={fmtGbp(Number(cycle.application.amountApplied))} />
                  <BRow
                    label="Date received"
                    value={new Date(cycle.application.dateReceived).toLocaleDateString("en-GB", { dateStyle: "medium" } as Intl.DateTimeFormatOptions)}
                  />
                  {cycle.application.receivedVia && (
                    <BRow label="Received via" value={cycle.application.receivedVia} />
                  )}
                  {cycle.application.notes && (
                    <BRow label="Notes" value={cycle.application.notes} />
                  )}
                  {cycle.application.attachmentUrl && (
                    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 0", color: "#64748b", width: "220px" }}>Attachment</td>
                      <td style={{ padding: "6px 0" }}>
                        <a href={`/api/applications/${cycle.application.id}/download`} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5" }}>
                          View document ↗
                        </a>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Assessment summary */}
          {assessment && gross !== null && (
            <div className="section" style={{ marginBottom: "24px" }}>
              <SectionTitle>Assessment summary</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  <BRow label="Gross valuation" value={fmtGbp(gross)} />
                  <BRow label={`Retention (${(Number(order.retentionPct) * 100).toFixed(0)}%)`} value={`-${fmtGbp(retention!)}`} />
                  <BRow label="Previously certified" value={`-${fmtGbp(prev!)}`} />
                  <BRow label="Net this cycle" value={fmtGbp(net!)} bold />
                </tbody>
              </table>

              {assessment.lines.length > 0 && (
                <div style={{ marginTop: "12px", overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                        {["Ref", "Description", "Contract value", "Value to date", "Prev certified", "This cycle"].map((h) => (
                          <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#64748b" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {assessment.lines.map((l, i) => {
                        // Section/item rows display the auto-summed value of
                        // their children, not their own stale stored value.
                        const vtd = lineAutoSums[i]
                        return (
                          <tr key={l.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "5px 8px" }}>{l.itemRef}</td>
                            <td style={{ padding: "5px 8px" }}>{l.description}</td>
                            <td style={{ padding: "5px 8px" }}>{fmtGbp(Number(l.contractValue))}</td>
                            <td style={{ padding: "5px 8px" }}>{fmtGbp(vtd)}</td>
                            <td style={{ padding: "5px 8px" }}>{fmtGbp(Number(l.previouslyCertified))}</td>
                            <td style={{ padding: "5px 8px" }}>{fmtGbp(vtd - Number(l.previouslyCertified))}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Payment notice */}
          {cycle.paymentNotice?.status === "SERVED" && (
            <div className="section" style={{ marginBottom: "24px" }}>
              <SectionTitle>Payment notice</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  <BRow label="Sum proposed to be paid" value={fmtGbp(Number(cycle.paymentNotice.sumDue))} bold />
                  <BRow
                    label="Served at"
                    value={new Date(cycle.paymentNotice.servedAt as unknown as string).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
                  />
                  <BRow label="Service method" value={cycle.paymentNotice.serviceMethod ?? "—"} />
                </tbody>
              </table>
              {cycle.paymentNotice.basis && (
                <div style={{ marginTop: "8px", background: "#f8fafc", borderLeft: "3px solid #6366f1", padding: "10px 14px", fontSize: "13px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Basis</p>
                  <p style={{ margin: 0 }}>{cycle.paymentNotice.basis}</p>
                </div>
              )}
            </div>
          )}

          {/* Pay-less notice */}
          {cycle.payLessNotice?.status === "SERVED" && (
            <div className="section" style={{ marginBottom: "24px" }}>
              <SectionTitle>Pay-less notice</SectionTitle>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <tbody>
                  <BRow label="Sum we intend to pay" value={fmtGbp(Number(cycle.payLessNotice.sumDue))} bold />
                  <BRow
                    label="Served at"
                    value={new Date(cycle.payLessNotice.servedAt as unknown as string).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
                  />
                  <BRow label="Service method" value={cycle.payLessNotice.serviceMethod ?? "—"} />
                </tbody>
              </table>
              {cycle.payLessNotice.basis && (
                <div style={{ marginTop: "8px", background: "#f8fafc", borderLeft: "3px solid #dc2626", padding: "10px 14px", fontSize: "13px" }}>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Basis</p>
                  <p style={{ margin: 0 }}>{cycle.payLessNotice.basis}</p>
                </div>
              )}
            </div>
          )}

          {/* Audit trail */}
          <div className="section" style={{ marginBottom: "8px" }}>
            <SectionTitle>Audit trail</SectionTitle>
            {auditEvents.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#94a3b8" }}>No events recorded.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#64748b", width: "180px" }}>Timestamp</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#64748b" }}>Event</th>
                    <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#64748b" }}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "5px 8px", color: "#64748b", whiteSpace: "nowrap" }}>
                        {new Date(ev.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </td>
                      <td style={{ padding: "5px 8px", fontWeight: 500 }}>
                        {AUDIT_EVENT_LABELS[ev.eventType] ?? ev.eventType}
                      </td>
                      <td style={{ padding: "5px 8px", color: "#64748b" }}>
                        {ev.payload && typeof ev.payload === "object"
                          ? Object.entries(ev.payload as Record<string, unknown>)
                              .filter(([, v]) => v !== null && v !== undefined && v !== "")
                              .map(([k, v]) => `${k}: ${String(v)}`)
                              .join(", ")
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
            Generated by NoticeGuard on behalf of {fullOrg?.name} · {generatedAt}.
            This document is provided for record-keeping purposes only. NoticeGuard does not provide legal advice.
          </p>
        </div>
      </div>
    </>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
      {children}
    </h2>
  )
}

function BRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
      <td style={{ padding: "6px 0", color: "#64748b", width: "220px" }}>{label}</td>
      <td style={{ padding: "6px 0", fontWeight: bold ? 700 : 500 }}>{value}</td>
    </tr>
  )
}
