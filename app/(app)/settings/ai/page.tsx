import { requireOrg } from "@/lib/auth"
import { AiRegisterClient } from "./client"

export default async function AiSettingsPage() {
  const { org } = await requireOrg()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">AI governance</h1>
        <p className="text-slate-500 text-sm mt-1">
          RICS-compliant AI systems register, risk register, and dip-sampling. Required under the <em>Responsible use of AI in surveying practice</em> standard, effective 9 March 2026.
        </p>
      </div>

      <AiRegisterClient orgId={org.id} />
    </div>
  )
}