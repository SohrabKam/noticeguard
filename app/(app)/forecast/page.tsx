import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { computeDrawdown } from "@/lib/drawdown"
import { PortfolioForecastGrid, type ForecastPortfolioRow } from "@/components/drawdown/forecast-grid"

export default async function CashForecastPage() {
  const { org } = await requireOrg()

  const orders = await db.subcontractOrder.findMany({
    where: { organisationId: org.id },
    include: {
      project: { select: { name: true } },
      subcontractor: { select: { name: true } },
      scheduleLines: { orderBy: { sortOrder: "asc" } },
      paymentSchedule: {
        include: {
          cycles: {
            orderBy: { cycleNumber: "asc" },
            include: { assessment: true },
          },
        },
      },
      retentionLedger: true,
    },
    orderBy: { project: { name: "asc" } },
  })

  // Build rows and determine the actual date range from cycle dates
  let firstDate: Date | null = null
  let lastDate: Date | null = null
  const rows: ForecastPortfolioRow[] = []

  for (const order of orders) {
    if (!order.paymentSchedule || order.scheduleLines.length === 0) continue

    const packageValue = order.scheduleLines.reduce((sum, l) => sum + Number(l.contractValue), 0)

    const drawdown = computeDrawdown({
      packageValue,
      retentionPct: Number(order.retentionPct) * 100,
      profile: order.paymentSchedule?.forecastProfile ?? "EVEN",
      cycles: order.paymentSchedule.cycles.map((c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        status: c.status,
        finalDateForPayment: c.finalDateForPayment,
        assessment: c.assessment,
      })),
      retention: order.retentionLedger,
    })

    // Track date range from drawdown rows
    for (const dr of drawdown.rows) {
      const d = new Date(dr.finalDateForPayment)
      if (!firstDate || d < firstDate) firstDate = d
      if (!lastDate || d > lastDate) lastDate = d
    }

    // Convert to monthly net cash
    const monthly = new Map<string, number>()
    for (const dr of drawdown.rows) {
      const d = new Date(dr.finalDateForPayment)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const net = dr.isActual && dr.actualNet !== null ? dr.actualNet : dr.forecastNet
      monthly.set(key, (monthly.get(key) ?? 0) + net)
    }

    rows.push({
      projectName: order.project.name,
      subcontractRef: order.reference,
      subcontractorName: order.subcontractor.name,
      subcontractId: order.id,
      monthlyNet: monthly,
    })
  }

  // Default to 12 months from now if no data
  if (!firstDate) firstDate = new Date()
  if (!lastDate) lastDate = new Date(Date.now() + 365 * 86400000)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cash forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Portfolio cash-out forecast across {orders.length} subcontracts. Amounts are net cash out per month based on payment cycle final dates.
        </p>
      </div>

      <PortfolioForecastGrid
        rows={rows}
        dateRange={{
          start: firstDate.toISOString(),
          end: lastDate.toISOString(),
        }}
      />
    </div>
  )
}