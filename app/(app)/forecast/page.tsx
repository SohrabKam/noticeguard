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
            include: {
              assessment: true,
            },
          },
        },
      },
      retentionLedger: true,
    },
    orderBy: { project: { name: "asc" } },
  })

  // Compute drawdown for each subcontract and flatten into monthly rows
  const rows: ForecastPortfolioRow[] = orders.flatMap((order) => {
    if (!order.paymentSchedule || order.scheduleLines.length === 0) return []

    const packageValue = order.scheduleLines.reduce(
      (sum, l) => sum + Number(l.contractValue),
      0,
    )

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

    // Convert drawdown rows to monthly net cash buckets
    const monthly = new Map<string, number>()
    for (const dr of drawdown.rows) {
      const d = new Date(dr.finalDateForPayment)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const net = dr.isActual && dr.actualNet !== null ? dr.actualNet : dr.forecastNet
      monthly.set(key, (monthly.get(key) ?? 0) + net)
    }

    return {
      projectName: order.project.name,
      subcontractRef: order.reference,
      subcontractorName: order.subcontractor.name,
      subcontractId: order.id,
      monthlyNet: monthly,
    }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Cash forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Portfolio cash-out forecast — what you owe subbies, month by month. Retention releases shown as negative (money coming back).
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-20 text-center text-sm text-slate-400">
          No subcontracts with payment schedules yet.
          <br />
          <a href="/subcontracts" className="text-indigo-600 hover:underline mt-1 inline-block">
            Set up your first subcontract →
          </a>
        </div>
      ) : (
        <PortfolioForecastGrid rows={rows} />
      )}
    </div>
  )
}