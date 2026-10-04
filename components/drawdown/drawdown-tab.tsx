"use client"
import type { DrawdownRow } from "@/lib/drawdown"
import { cn } from "@/lib/utils"
import Link from "next/link"

function fmt(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

type Summary = {
  packageValue: number
  certifiedToDate: number
  retentionHeld: number
  remainingCommitment: number
  remainingCycles: number
  pcReleaseDate: Date | null
  pcReleaseAmount: number | null
  mcdReleaseDate: Date | null
  mcdReleaseAmount: number | null
}

export function DrawdownTab({ rows, summary }: { rows: DrawdownRow[]; summary: Summary }) {
  const maxCumulative = Math.max(
    1,
    ...rows.map((r) => Math.abs(r.cumulativeNet)),
    summary.packageValue,
  )

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Package value" value={`£${fmt(summary.packageValue)}`} />
        <SummaryCard
          label="Certified to date"
          value={`£${fmt(summary.certifiedToDate)}`}
          sub={`${summary.certifiedToDate > 0 ? ((summary.certifiedToDate / summary.packageValue) * 100).toFixed(0) : "0"}% drawn`}
        />
        <SummaryCard
          label="Retention held"
          value={`£${fmt(summary.retentionHeld)}`}
          sub={
            summary.pcReleaseDate
              ? `PC release: ${fmtDate(summary.pcReleaseDate)}`
              : "No release dates set"
          }
        />
        <SummaryCard
          label="Remaining"
          value={`£${fmt(summary.remainingCommitment)}`}
          sub={`${summary.remainingCycles} cycle${summary.remainingCycles !== 1 ? "s" : ""} remaining`}
        />
      </div>

      {/* Mini bar chart: cumulative net cash-out over time */}
      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold text-slate-900 mb-3 text-sm">Cash-out forecast</h3>
        <div className="flex items-end gap-[2px] h-32">
          {rows
            .filter((r) => r.cycleNumber > 0 || r.status.startsWith("RETENTION"))
            .map((r, i) => {
            const pct = Math.max(2, (Math.abs(r.cumulativeNet) / maxCumulative) * 100)
            const isActual = r.isActual
            const isRetention = r.status.startsWith("RETENTION")
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    isRetention
                      ? "bg-violet-400/50"
                      : isActual
                      ? "bg-emerald-500"
                      : "bg-indigo-300/60",
                  )}
                  style={{ height: `${pct}%` }}
                />
                {i % Math.max(1, Math.floor(rows.length / 12)) === 0 && (
                  <span className="text-[9px] text-slate-400 mt-1 tabular-nums">
                    #{r.cycleNumber > 0 ? r.cycleNumber : r.status === "RETENTION_PC" ? "PC" : "MCD"}
                  </span>
                )}
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {r.cycleNumber > 0 ? `Cycle #${r.cycleNumber}` : r.status.replace("RETENTION_", "Retention ")}: £{fmt(r.isActual ? (r.actualNet ?? r.forecastNet) : r.forecastNet)}
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-emerald-500 inline-block" /> Certified</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-indigo-300/60 inline-block" /> Forecast</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-violet-400/50 inline-block" /> Retention release</span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Cycle</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Forecast date</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Gross</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Retention</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Net cash out</th>
                <th className="text-right px-4 py-2.5 font-medium text-slate-600">Cumulative</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, i) => {
                const isRetention = row.status.startsWith("RETENTION")
                const isForecast = !row.isActual && row.forecastGross > 0
                return (
                  <tr
                    key={`${row.cycleNumber}-${row.status}-${i}`}
                    className={cn(
                      "hover:bg-slate-50",
                      isRetention && "bg-violet-50/40",
                      row.isActual && "bg-emerald-50/30",
                    )}
                  >
                    <td className="px-4 py-2.5 font-medium">
                      {isRetention ? (
                        <span className="text-violet-600">
                          {row.status === "RETENTION_PC" ? "PC release" : "MCD release"}
                        </span>
                      ) : (
                        <Link
                          href={`/cycles/${row.cycleId}`}
                          className="text-indigo-600 hover:underline"
                        >
                          #{row.cycleNumber}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDate(row.finalDateForPayment)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span
                        className={cn(
                          row.isActual
                            ? "text-slate-900 font-medium"
                            : isForecast
                            ? "text-slate-400"
                            : "text-slate-300",
                          isRetention && "text-violet-600",
                        )}
                      >
                        {row.forecastGross === 0 && !row.isActual && !isRetention
                          ? "—"
                          : `£${fmt(row.isActual && row.actualGross !== null ? row.actualGross : row.forecastGross)}`}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      {isRetention ? "—" : `£${fmt(row.isActual && row.actualRetention !== null ? row.actualRetention : row.forecastRetention)}`}
                    </td>
                    <td className={cn(
                      "px-4 py-2.5 text-right tabular-nums font-medium",
                      isRetention ? "text-violet-600" : row.isActual ? "text-slate-900" : "text-slate-400",
                    )}>
                      £{fmt(row.isActual && row.actualNet !== null ? row.actualNet : row.forecastNet)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">
                      £{fmt(row.cumulativeNet)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.isActual && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">
                          Certified
                        </span>
                      )}
                      {isRetention && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">
                          {row.isActual ? "Released" : "Forecast"}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}