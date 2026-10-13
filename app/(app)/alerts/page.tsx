import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { AlertConfigRow } from "@/components/alerts/alert-config-row"
import { AddAlertForm } from "@/components/alerts/add-alert-form"

export default async function AlertsPage() {
  const { org } = await requireOrg()

  const configs = await db.alertConfig.findMany({
    where: { organisationId: org.id },
    orderBy: [{ alertType: "asc" }, { offsetDays: "asc" }],
  })

  const deadlineConfigs = configs.filter((c) => c.alertType === "DEADLINE_APPROACHING")
  const docConfigs = configs.filter((c) => c.alertType === "DOCUMENT_EXPIRY")
  const retentionConfigs = configs.filter((c) => c.alertType === "RETENTION_RELEASE")
  const digestConfigs = configs.filter((c) => c.alertType === "DAILY_DIGEST")
  const otherConfigs = configs.filter((c) => !["DEADLINE_APPROACHING", "DOCUMENT_EXPIRY", "RETENTION_RELEASE", "DAILY_DIGEST"].includes(c.alertType))

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Alert configuration</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage when NoticeGuard sends email reminders for deadlines and document expiry.
        </p>
      </div>

      <ConfigSection title="Deadline alerts" configs={deadlineConfigs} />
      <ConfigSection title="Document expiry alerts" configs={docConfigs} />
      <ConfigSection title="Retention release alerts" configs={retentionConfigs} />
      <ConfigSection title="Daily digest" configs={digestConfigs} />
      {otherConfigs.length > 0 && <ConfigSection title="Other alerts" configs={otherConfigs} />}

      <div className="flex items-center justify-between">
        <AddAlertForm />
      </div>

      <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4 text-sm text-indigo-700">
        Alert emails are sent by the hourly deadline sweep. Configure your Resend sender domain and set{" "}
        <code className="bg-indigo-100 px-1 rounded text-xs">RESEND_API_KEY</code> to enable delivery.
      </div>
    </div>
  )
}

function ConfigSection({
  title,
  configs,
}: {
  title: string
  configs: { id: string; alertType: string; offsetDays: number; enabled: boolean }[]
}) {
  if (configs.length === 0) return null

  return (
    <div className="rounded-lg border bg-white overflow-x-auto shadow-sm">
      <div className="px-4 py-2.5 bg-slate-50 border-b">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Type</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Trigger</th>
            <th className="text-left px-4 py-2.5 font-medium text-slate-500 text-xs">Enabled</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {configs.map((c) => (
            <AlertConfigRow
              key={c.id}
              id={c.id}
              alertType={c.alertType}
              offsetDays={c.offsetDays}
              enabled={c.enabled}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
