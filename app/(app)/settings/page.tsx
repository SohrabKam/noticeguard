import Link from "next/link"
import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { OrgSettingsForm } from "@/components/settings/org-settings-form"
import { MemberEscalationInput } from "@/components/settings/member-escalation-input"
import { MemberRoleSelect } from "@/components/settings/member-role-select"
import { RequiredDocTypesEditor } from "@/components/settings/required-doc-types-editor"
import { ApiKeysPanel } from "@/components/settings/api-keys-panel"

export default async function SettingsPage() {
  const { org } = await requireOrg()

  const fullOrg = await db.organisation.findUnique({
    where: { id: org.id },
    include: {
      members: { orderBy: { createdAt: "asc" } },
      apiKeys: { orderBy: { createdAt: "desc" } },
    },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Organisation and account configuration</p>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <h2 className="font-semibold text-slate-900">Organisation</h2>
        <OrgSettingsForm
          name={fullOrg?.name ?? ""}
          fromName={fullOrg?.fromName ?? null}
          fromEmail={fullOrg?.fromEmail ?? null}
        />
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Team members</h2>
          <Link href="/team" className="text-xs font-medium text-indigo-600 hover:underline">
            Invite / manage in Clerk →
          </Link>
        </div>
        {fullOrg?.members && fullOrg.members.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr>
                <th className="text-left py-2 font-medium text-slate-600">Name</th>
                <th className="text-left py-2 font-medium text-slate-600">Email</th>
                <th className="text-left py-2 font-medium text-slate-600">Role</th>
                <th className="text-left py-2 font-medium text-slate-600">Escalation email</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {fullOrg.members.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5">{m.name}</td>
                  <td className="py-2.5 text-slate-500">{m.email}</td>
                  <td className="py-2.5">
                    <MemberRoleSelect memberId={m.id} role={m.role} />
                  </td>
                  <td className="py-2.5">
                    <MemberEscalationInput memberId={m.id} escalationTo={m.escalationTo} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-400">No members found.</p>
        )}
        <p className="text-xs text-slate-400 mt-2">
          Escalation email receives urgent alerts (T-1 and breached deadlines) in addition to regular alerts.
          Role controls what a member can do — Viewers are read-only, Commercial can manage day-to-day
          work, Admin can also change organisation settings and roles.
        </p>
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">Required document types</h2>
          <p className="text-xs text-slate-400 mt-0.5">Documents that every subcontractor must hold. Missing entries will be flagged on the compliance page.</p>
        </div>
        <RequiredDocTypesEditor initial={fullOrg?.requiredDocTypes ?? []} />
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-slate-900">API keys</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            For connecting other software to NoticeGuard — see <code>API.md</code> in the repo for
            endpoints and examples. Read-only keys can only fetch data; read &amp; write keys can also
            log applications and push compliance documents.
          </p>
        </div>
        <ApiKeysPanel apiKeys={fullOrg?.apiKeys ?? []} />
      </div>

      <div className="rounded-lg border bg-white p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">AI governance</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              RICS-compliant AI systems register, risk register, and dip-sampling. Required under the <em>Responsible use of AI in surveying practice</em> standard.
            </p>
          </div>
          <Link href="/settings/ai" className="text-xs font-medium text-indigo-600 hover:underline shrink-0">
            Manage →
          </Link>
        </div>
      </div>
    </div>
  )
}
