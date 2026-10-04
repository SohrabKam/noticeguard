import { requireOrg } from "@/lib/auth"
import { getDashboardCycles, getRecentlyPaidCycles, getPortfolioStats } from "@/lib/dashboard"
import { RagBadge } from "@/components/dashboard/rag-badge"
import { CycleStatusLabel } from "@/components/dashboard/cycle-status-label"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import Link from "next/link"
import { AlertTriangle, CheckCircle2, Clock, Download, Search } from "lucide-react"
import { SeedDemoButton } from "@/components/dashboard/seed-demo-button"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { org } = await requireOrg()
  const { filter, q } = await searchParams
  const search = q?.trim().toLowerCase() ?? ""

  const [cycles, recentlyPaid, portfolio] = await Promise.all([
    getDashboardCycles(org.id),
    getRecentlyPaidCycles(org.id),
    getPortfolioStats(org.id),
  ])

  const breached = cycles.filter((c) => c.rag === "breached").length
  const urgent = cycles.filter((c) => c.rag === "red").length
  const dueSoon = cycles.filter((c) => c.rag === "amber").length
  const onTrack = cycles.filter((c) => c.rag === "green").length

  const ragFiltered = filter === "breached" ? cycles.filter((c) => c.rag === "breached")
    : filter === "red" ? cycles.filter((c) => c.rag === "red")
    : filter === "amber" ? cycles.filter((c) => c.rag === "amber")
    : filter === "green" ? cycles.filter((c) => c.rag === "green")
    : cycles

  const visibleCycles = search
    ? ragFiltered.filter((c) =>
        c.subcontractorName.toLowerCase().includes(search) ||
        c.projectName.toLowerCase().includes(search) ||
        c.subcontractRef.toLowerCase().includes(search)
      )
    : ragFiltered

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Compliance Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">
            All live payment cycles ordered by next deadline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SeedDemoButton />
          <a
            href="/api/portfolio/export"
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 border border-slate-200 rounded px-3 py-1.5 bg-white hover:border-indigo-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Breached banner */}
      {breached > 0 && (
        <div className="rounded-lg bg-red-600 text-white px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">
              {breached} payment notice deadline{breached !== 1 ? "s have" : " has"} passed without a notice being served.
              Legal exposure may apply under the Housing Grants Act.
            </p>
          </div>
          <span className="text-red-200 text-xs font-medium ml-4 shrink-0">Act immediately ↓</span>
        </div>
      )}

      {/* Portfolio stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Active contracts"
          value={portfolio.activeContracts.toString()}
          sub={`${portfolio.livePaymentCycles} live payment cycle${portfolio.livePaymentCycles !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Total contract value"
          value={`£${portfolio.totalContractValue.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
        />
        <StatCard
          label="Retention held"
          value={`£${portfolio.totalRetentionHeld.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          label="Outstanding (noticed)"
          value={portfolio.totalOutstanding > 0
            ? `£${portfolio.totalOutstanding.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : "£0"}
          sub="Sum of served but unpaid notices"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <Link href="?filter=breached">
          <SummaryCard
            label="Breached"
            value={breached}
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            className={`border-red-200 bg-red-50 cursor-pointer hover:ring-2 hover:ring-red-300 transition-all ${filter === "breached" ? "ring-2 ring-red-400" : ""}`}
            valueClass="text-red-700"
          />
        </Link>
        <Link href="?filter=red">
          <SummaryCard
            label="Urgent (≤2 days)"
            value={urgent}
            icon={<Clock className="w-5 h-5 text-red-500" />}
            className={`border-red-100 bg-red-50/50 cursor-pointer hover:ring-2 hover:ring-red-200 transition-all ${filter === "red" ? "ring-2 ring-red-300" : ""}`}
            valueClass="text-red-600"
          />
        </Link>
        <Link href="?filter=amber">
          <SummaryCard
            label="Due soon (≤5 days)"
            value={dueSoon}
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            className={`border-amber-100 bg-amber-50 cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all ${filter === "amber" ? "ring-2 ring-amber-400" : ""}`}
            valueClass="text-amber-700"
          />
        </Link>
        <Link href="?filter=green">
          <SummaryCard
            label="On track"
            value={onTrack}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            className={`border-emerald-100 bg-emerald-50 cursor-pointer hover:ring-2 hover:ring-emerald-300 transition-all ${filter === "green" ? "ring-2 ring-emerald-400" : ""}`}
            valueClass="text-emerald-700"
          />
        </Link>
      </div>

      {/* RAG filter tabs + search */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 text-sm">
          {([
            { label: `All (${cycles.length})`, value: undefined },
            { label: `Breached (${breached})`, value: "breached" },
            { label: `Urgent (${urgent})`, value: "red" },
            { label: `Due soon (${dueSoon})`, value: "amber" },
            { label: `On track (${onTrack})`, value: "green" },
          ] as const).map(({ label, value }) => (
            <Link
              key={label}
              href={value ? `?filter=${value}${search ? `&q=${encodeURIComponent(search)}` : ""}` : search ? `?q=${encodeURIComponent(search)}` : "/dashboard"}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                filter === value || (!filter && !value)
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <form method="get" className="flex items-center gap-2">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search subcontractor, project, ref…"
              className="pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring w-56"
            />
          </div>
          {search && (
            <Link href={filter ? `?filter=${filter}` : "/dashboard"} className="text-xs text-slate-400 hover:text-slate-600">
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Cycles table */}
      <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
        {visibleCycles.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            {search ? `No cycles matching "${q}".` : filter ? "No cycles match this filter." : "No live payment cycles. Add a subcontract to get started."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Subcontractor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Cycle</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Next deadline</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Days left</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">RAG</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleCycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  className={
                    cycle.rag === "breached"
                      ? "bg-red-50"
                      : cycle.rag === "red"
                      ? "bg-red-50/40"
                      : "hover:bg-slate-50"
                  }
                >
                  <td className="px-4 py-3">
                    <CycleStatusLabel status={cycle.status} />
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {cycle.subcontractorName}
                    <div className="text-xs text-slate-400 font-normal">{cycle.subcontractRef}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{cycle.projectName}</td>
                  <td className="px-4 py-3 text-slate-600">#{cycle.cycleNumber}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {formatDate(new Date(cycle.nextDeadlineDate))}
                    </div>
                    <div className="text-xs text-slate-400">{cycle.nextDeadlineLabel}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {cycle.daysUntilDeadline < 0
                      ? `+${Math.abs(cycle.daysUntilDeadline)}d overdue`
                      : `${cycle.daysUntilDeadline}d`}
                  </td>
                  <td className="px-4 py-3">
                    <RagBadge status={cycle.rag} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/cycles/${cycle.id}`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recently paid */}
      {recentlyPaid.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Recently paid (last 90 days)</h2>
          <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Subcontractor</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Project</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Cycle</th>
                  <th className="text-right px-4 py-2.5 font-medium text-slate-600">Sum paid</th>
                  <th className="text-left px-4 py-2.5 font-medium text-slate-600">Paid</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentlyPaid.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 opacity-80">
                    <td className="px-4 py-2.5 font-medium text-slate-700">
                      {c.subcontractorName}
                      <div className="text-xs text-slate-400 font-normal">{c.subcontractRef}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{c.projectName}</td>
                    <td className="px-4 py-2.5 text-slate-500">#{c.cycleNumber}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-700">
                      {c.sumDue !== null
                        ? `£${c.sumDue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-xs">
                      {c.paidAt ? formatDate(c.paidAt) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/cycles/${c.id}`} className="text-xs text-indigo-500 hover:underline">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  className,
  valueClass,
}: {
  label: string
  value: number
  icon: React.ReactNode
  className: string
  valueClass: string
}) {
  return (
    <div className={`rounded-lg border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">{icon}</div>
      <div className={`text-3xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}
