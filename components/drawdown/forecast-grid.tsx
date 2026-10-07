"use client"
import type { DrawdownRow } from "@/lib/drawdown"
import { useMemo, useState } from "react"
import Link from "next/link"

function fmt(n: number): string {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export interface ForecastPortfolioRow {
  projectName: string
  subcontractRef: string
  subcontractorName: string
  subcontractId: string
  /** Net cash-out per month (YYYY-MM → amount), includes retention releases as negative */
  monthlyNet: Map<string, number>
}

function monthsBetween(start: Date, end: Date): string[] {
  const months: string[] = []
  const d = new Date(start.getFullYear(), start.getMonth(), 1)
  while (d <= end) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    d.setMonth(d.getMonth() + 1)
  }
  return months
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-")
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return `${months[Number(m) - 1]} ${y.slice(2)}`
}

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Convert drawdown rows into monthly net cash allocations */
function rowsToMonthly(rows: DrawdownRow[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const key = getMonthKey(new Date(row.finalDateForPayment))
    const net = row.isActual && row.actualNet !== null ? row.actualNet : row.forecastNet
    map.set(key, (map.get(key) ?? 0) + net)
  }
  return map
}

export function PortfolioForecastGrid({ rows, dateRange }: { rows: ForecastPortfolioRow[]; dateRange?: { start: string; end: string } }) {
  const [filterProject, setFilterProject] = useState("")

  // Compute date range from actual data or fallback to 12 months
  const startDate = dateRange ? new Date(dateRange.start) : new Date()
  const endDate = dateRange ? new Date(dateRange.end) : new Date(Date.now() + 365 * 86400000)
  const monthKeys = monthsBetween(startDate, endDate)

  // Build project filter options
  const projects = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => set.add(r.projectName))
    return Array.from(set).sort()
  }, [rows])

  // Filter rows
  const filtered = useMemo(() => {
    if (!filterProject) return rows
    return rows.filter((r) => r.projectName === filterProject)
  }, [rows, filterProject])

  // Compute totals per month
  const monthTotals = useMemo(() => {
    const totals = new Map<string, number>()
    monthKeys.forEach((k) => totals.set(k, 0))
    filtered.forEach((r) => {
      monthKeys.forEach((k) => {
        totals.set(k, (totals.get(k) ?? 0) + (r.monthlyNet.get(k) ?? 0))
      })
    })
    return totals
  }, [filtered, monthKeys])

  // Group by project for display
  const grouped = useMemo(() => {
    const map = new Map<string, ForecastPortfolioRow[]>()
    filtered.forEach((r) => {
      const existing = map.get(r.projectName) ?? []
      existing.push(r)
      map.set(r.projectName, existing)
    })
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  // CSV export
  const csvContent = useMemo(() => {
    const headers = ["Project", "Subcontract", "Subcontractor", ...monthKeys.map(monthLabel)]
    const lines = [headers.join(",")]
    grouped.forEach(([proj, subs]) => {
      subs.forEach((s) => {
        const cells = [proj, s.subcontractRef, s.subcontractorName, ...monthKeys.map((k) => (s.monthlyNet.get(k) ?? 0).toFixed(2))]
        lines.push(cells.join(","))
      })
    })
    return lines.join("\n")
  }, [grouped, monthKeys])

  const downloadCsv = () => {
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `noticeguard-cash-forecast-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="text-sm rounded-md border border-slate-200 px-3 py-1.5 bg-white"
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        <span className="text-xs text-slate-400">{filtered.length} subcontract{filtered.length !== 1 ? "s" : ""}</span>

        <button
          onClick={downloadCsv}
          className="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-md border border-indigo-200 hover:bg-indigo-50"
        >
          Export CSV ↓
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-lg border bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="sticky left-0 bg-slate-50 text-left px-3 py-2.5 font-medium text-slate-600 z-10">Project</th>
                <th className="sticky left-[120px] bg-slate-50 text-left px-3 py-2.5 font-medium text-slate-600 z-10">Subcontract</th>
                <th className="text-left px-3 py-2.5 font-medium text-slate-600">Subcontractor</th>
                {monthKeys.map((k) => (
                  <th key={k} className="text-right px-3 py-2.5 font-medium text-slate-600 whitespace-nowrap">
                    {monthLabel(k)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {grouped.map(([proj, subs], gi) => {
                const projectTotal = new Map<string, number>()
                monthKeys.forEach((k) => projectTotal.set(k, 0))
                subs.forEach((s) => monthKeys.forEach((k) => projectTotal.set(k, (projectTotal.get(k) ?? 0) + (s.monthlyNet.get(k) ?? 0))))

                return (
                  <>
                    {/* Subcontract rows */}
                    {subs.map((s, si) => (
                      <tr key={s.subcontractId} className="hover:bg-slate-50">
                        {si === 0 && (
                          <td
                            className="sticky left-0 bg-white px-3 py-2 font-medium text-slate-700 z-10"
                            rowSpan={subs.length}
                          >
                            {proj}
                          </td>
                        )}
                        <td className="sticky left-[120px] bg-white px-3 py-2 z-10">
                          <Link
                            href={`/subcontracts/${s.subcontractId}`}
                            className="text-indigo-600 hover:underline text-xs font-mono"
                          >
                            {s.subcontractRef}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{s.subcontractorName}</td>
                        {monthKeys.map((k) => {
                          const v = s.monthlyNet.get(k) ?? 0
                          return (
                            <td key={k} className={`px-3 py-2 text-right tabular-nums ${v < 0 ? "text-violet-600" : v === 0 ? "text-slate-300" : "text-slate-700"}`}>
                              {v !== 0 ? `£${fmt(v)}` : "—"}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                    {/* Project totals row */}
                    {subs.length > 1 && (
                      <tr className="bg-slate-50/60 border-t border-slate-200">
                        <td className="sticky left-0 bg-slate-50/60 px-3 py-1.5 z-10" colSpan={3}>
                          <span className="text-xs font-medium text-slate-500">{proj} total</span>
                        </td>
                        {monthKeys.map((k) => {
                          const v = projectTotal.get(k) ?? 0
                          return (
                            <td key={k} className={`px-3 py-1.5 text-right tabular-nums text-xs font-medium ${v < 0 ? "text-violet-600" : v === 0 ? "text-slate-300" : "text-slate-600"}`}>
                              {v !== 0 ? `£${fmt(v)}` : "—"}
                            </td>
                          )
                        })}
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
            {/* Grand totals footer */}
            <tfoot>
              <tr className="bg-slate-100 border-t-2 border-slate-300">
                <td className="sticky left-0 bg-slate-100 px-3 py-2 font-semibold text-slate-900 z-10" colSpan={3}>
                  Portfolio total
                </td>
                {monthKeys.map((k) => {
                  const v = monthTotals.get(k) ?? 0
                  return (
                    <td key={k} className={`px-3 py-2 text-right tabular-nums text-sm font-semibold ${v < 0 ? "text-violet-600" : v === 0 ? "text-slate-300" : "text-slate-900"}`}>
                      {v !== 0 ? `£${fmt(v)}` : "—"}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Total monthly outflow (next 30d)</p>
          <p className="text-lg font-bold text-slate-900">
            £{fmt(Array.from(monthTotals.entries()).filter(([k]) => {
              const d = new Date(k + "-01")
              return d >= startDate && d <= new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
            }).reduce((s, [, v]) => s + v, 0))}
          </p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Forecast subcontracts</p>
          <p className="text-lg font-bold text-slate-900">{filtered.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Projects covered</p>
          <p className="text-lg font-bold text-slate-900">{grouped.length}</p>
        </div>
      </div>
    </div>
  )
}