import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { ConnectionsPanel } from "@/components/settings/connections-panel"

export default async function ConnectionsSettingsPage() {
  const { org } = await requireOrg()

  const connections = await db.connection.findMany({
    where: { organisationId: org.id },
    include: { syncLogs: { orderBy: { startedAt: "desc" }, take: 5 } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Accounting integrations</h1>
        <p className="text-slate-500 text-sm mt-1">
          Connect NoticeGuard to your accounting system to automatically pull subcontractor data
        </p>
      </div>
      <ConnectionsPanel connections={connections} />
    </div>
  )
}