import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { getRagStatus } from "@/lib/dashboard"
import { RagBadge } from "@/components/dashboard/rag-badge"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import Link from "next/link"
import { Plus, FileText, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SyncOriginBadge } from "@/components/integrations/sync-origin-badge"

export default async function SubcontractsPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; archived?: string; q?: string }>
}) {
  const { org } = await requireOrg()
  const { projectId, archived, q } = await searchParams
  const showArchived = archived === "1"
  const search = q?.trim() ?? ""

  const orders = await db.subcontractOrder.findMany({
    where: {
      organisationId: org.id,
      isActive: showArchived ? false : true,
      ...(projectId ? { projectId } : {}),
      ...(search ? {
        OR: [
          { reference: { contains: search, mode: "insensitive" } },
          { subcontractor: { name: { contains: search, mode: "insensitive" } } },
          { project: { name: { contains: search, mode: "insensitive" } } },
        ],
      } : {}),
    },
    include: {
      project: { select: { name: true } },
      subcontractor: { select: { name: true } },
      paymentSchedule: {
        include: {
          cycles: {
            where: {
              status: {
                in: ["AWAITING_APPLICATION", "APPLICATION_RECEIVED", "UNDER_ASSESSMENT", "NOTICE_SERVED", "PAY_LESS_SERVED"],
              },
            },
            orderBy: { paymentNoticeDeadline: "asc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  const now = new Date()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {showArchived ? "Archived subcontracts" : "Subcontracts"}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {showArchived ? "Inactive subcontract orders" : "All live subcontract orders"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={showArchived ? "/subcontracts" : "/subcontracts?archived=1"}
            className="text-xs text-slate-400 hover:text-slate-600 hover:underline"
          >
            {showArchived ? "← Active" : "View archived"}
          </Link>
          {!showArchived && (
            <Link href="/subcontracts/new">
              <Button><Plus className="w-4 h-4 mr-2" />New subcontract</Button>
            </Link>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form method="get" className="flex items-center gap-2 max-w-xs">
        {projectId && <input type="hidden" name="projectId" value={projectId} />}
        {showArchived && <input type="hidden" name="archived" value="1" />}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search subcontractor, project, ref…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {search && (
          <a
            href={`/subcontracts${projectId ? `?projectId=${projectId}` : ""}${showArchived ? `${projectId ? "&" : "?"}archived=1` : ""}`}
            className="text-xs text-slate-400 hover:text-slate-600 whitespace-nowrap"
          >
            Clear
          </a>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-20 text-center">
          <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No subcontracts yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">
            {showArchived
              ? "No archived subcontracts"
              : projectId
              ? "No subcontracts for this project"
              : "Add your first subcontract to start tracking payment deadlines"}
          </p>
          <Link href="/subcontracts/new">
            <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Add subcontract</Button>
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Subcontractor</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Project</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Reference</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">Contract sum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">Next deadline</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600">RAG</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => {
                const nextCycle = order.paymentSchedule?.cycles[0]
                let nextDeadline: Date | null = null
                let deadlineLabel = "Payment notice deadline"
                if (nextCycle) {
                  if (nextCycle.status === "PAY_LESS_SERVED") {
                    nextDeadline = new Date(nextCycle.finalDateForPayment)
                    deadlineLabel = "Final date for payment"
                  } else if (nextCycle.status === "NOTICE_SERVED") {
                    nextDeadline = new Date(nextCycle.payLessDeadline)
                    deadlineLabel = "Pay-less deadline"
                  } else {
                    nextDeadline = new Date(nextCycle.paymentNoticeDeadline)
                  }
                }
                const rag = nextDeadline ? getRagStatus(nextDeadline, now) : undefined

                return (
                  <tr key={order.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{order.subcontractor.name}</td>
                    <td className="px-4 py-3 text-slate-600">{order.project.name}</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                      <span className="flex items-center gap-1.5">
                        {order.reference}
                        <SyncOriginBadge id={order.id} />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      £{Number(order.contractSum).toLocaleString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      {nextDeadline ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {formatDate(nextDeadline)}
                          </div>
                          <div className="text-xs text-slate-400">{deadlineLabel}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">No active cycles</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {rag ? <RagBadge status={rag} /> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/subcontracts/${order.id}`}
                        className="text-xs font-medium text-indigo-600 hover:underline"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
