import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import Link from "next/link"
import { Plus, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EditProjectSheet } from "@/components/projects/edit-project-sheet"
import { SyncOriginBadge } from "@/components/integrations/sync-origin-badge"

function fmt(n: number) {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(1)}m`
  if (n >= 1_000) return `£${(n / 1_000).toFixed(0)}k`
  return `£${n.toFixed(0)}`
}

export default async function ProjectsPage() {
  const { org } = await requireOrg()

  const projects = await db.project.findMany({
    where: { organisationId: org.id },
    include: {
      subcontracts: {
        include: {
          variations: { where: { status: "AGREED" }, select: { agreedValue: true } },
          paymentSchedule: {
            include: {
              cycles: {
                where: { status: { in: ["NOTICE_SERVED", "PAY_LESS_SERVED", "PAID"] } },
                include: { assessment: { select: { grossValuation: true } } },
                orderBy: { cycleNumber: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-slate-500 text-sm mt-1">All active development projects</p>
        </div>
        <Link href="/projects/new">
          <Button><Plus className="w-4 h-4 mr-2" />New project</Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-20 text-center">
          <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No projects yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Create a project to start adding subcontracts</p>
          <Link href="/projects/new">
            <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Create first project</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            let contractValue = 0
            let certifiedToDate = 0
            for (const sc of p.subcontracts) {
              const varTotal = sc.variations.reduce((s, v) => s + (v.agreedValue ? Number(v.agreedValue) : 0), 0)
              contractValue += Number(sc.contractSum) + varTotal
              const latestCycle = sc.paymentSchedule?.cycles[0]
              if (latestCycle?.assessment) {
                certifiedToDate += Number(latestCycle.assessment.grossValuation)
              }
            }

            return (
              <div key={p.id} className="rounded-lg border bg-white p-5 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <FolderOpen className="w-5 h-5 text-indigo-500 mt-0.5" />
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    <EditProjectSheet project={{ id: p.id, name: p.name, reference: p.reference, address: p.address }} />
                  </div>
                </div>
                <h3 className="font-semibold text-slate-900">
                  <span className="inline-flex items-center gap-2">{p.name}<SyncOriginBadge id={p.id} /></span>
                </h3>
                {p.reference && <p className="text-xs text-slate-400 mt-0.5">{p.reference}</p>}
                {p.address && <p className="text-sm text-slate-500 mt-1">{p.address}</p>}
                {contractValue > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Contract value</p>
                      <p className="text-sm font-semibold text-slate-900">{fmt(contractValue)}</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-2">
                      <p className="text-xs text-slate-400">Certified to date</p>
                      <p className="text-sm font-semibold text-slate-900">
                        {certifiedToDate > 0 ? fmt(certifiedToDate) : "—"}
                      </p>
                    </div>
                  </div>
                )}
                <div className="mt-4 pt-3 border-t flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {p.subcontracts.length} subcontract{p.subcontracts.length !== 1 ? "s" : ""}
                  </span>
                  <Link href={`/subcontracts?projectId=${p.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
                    View subcontracts →
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
