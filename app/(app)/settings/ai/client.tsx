"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AI_SYSTEMS, AI_RISKS, type AiSystem, type AiRisk } from "@/lib/ai-register"

export function AiRegisterClient({ orgId }: { orgId: string }) {
  const [activeTab, setActiveTab] = useState("systems")

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList>
        <TabsTrigger value="systems">AI systems register</TabsTrigger>
        <TabsTrigger value="risks">Risk register</TabsTrigger>
        <TabsTrigger value="dip-sampling">Dip-sampling</TabsTrigger>
      </TabsList>

      <TabsContent value="systems" className="mt-4">
        <SystemsTab />
      </TabsContent>

      <TabsContent value="risks" className="mt-4">
        <RisksTab />
      </TabsContent>

      <TabsContent value="dip-sampling" className="mt-4">
        <DipSamplingTab orgId={orgId} />
      </TabsContent>
    </Tabs>
  )
}

function SystemsTab() {
  const phases = [...new Set(AI_SYSTEMS.map((s) => s.phase))].sort()

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-slate-600 mb-1">
          All AI-influenced systems in use or planned for this product. Each system is categorised by its AI approach and whether it has material impact under the RICS standard.
        </p>
        <p className="text-xs text-slate-400">
          Next review date = first-used date + 3 months, resetting each time the named surveyor reviews.
        </p>
      </div>

      {phases.map((phase) => {
        const systems = AI_SYSTEMS.filter((s) => s.phase === phase)
        return (
          <div key={phase} className="space-y-3">
            <h3 className="font-semibold text-slate-800">
              Phase {phase} — {phase === "1" ? "Deterministic (rules-based, no ML)" : "LLM-assisted (human-verified)"}
            </h3>
            <div className="rounded-lg border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">System</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Purpose</th>
                    <th className="text-center px-4 py-2.5 font-medium text-slate-600 w-[100px]">Material impact</th>
                    <th className="text-center px-4 py-2.5 font-medium text-slate-600 w-[90px]">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600 w-[110px]">Next review</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {systems.map((s) => (
                    <SystemRow key={s.id} system={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SystemRow({ system }: { system: AiSystem }) {
  const isActive = system.firstUsed !== "TBD"
  const nextReview = isActive
    ? new Date(new Date(system.firstUsed).getTime() + 90 * 86400000)
    : null
  const isDue = nextReview && nextReview < new Date()
  const isDueSoon = nextReview && !isDue && nextReview < new Date(Date.now() + 14 * 86400000)

  const ragColor = !isActive
    ? "bg-slate-100 text-slate-500"
    : system.reviewed
    ? isDue
      ? "bg-red-100 text-red-700"
      : isDueSoon
      ? "bg-amber-100 text-amber-700"
      : "bg-emerald-100 text-emerald-700"
    : "bg-slate-100 text-slate-500"

  const ragLabel = !isActive
    ? "Planned"
    : system.reviewed
    ? isDue
      ? "Overdue"
      : isDueSoon
      ? "Due soon"
      : "Reviewed"
    : "Not reviewed"

  const categoryLabel =
    system.category === "deterministic"
      ? "Rules"
      : system.category === "llm-assisted"
      ? "LLM"
      : "Extraction"

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <p className="font-medium text-slate-900">{system.name}</p>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-0">
          {categoryLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-slate-600">{system.purpose}</td>
      <td className="px-4 py-3 text-center">
        {system.hasMaterialImpact ? (
          <span className="text-xs font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">Yes</span>
        ) : (
          <span className="text-xs text-slate-400">No</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ragColor}`}>
          {ragLabel}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500">
        {isActive && nextReview
          ? nextReview.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
          : "—"}
      </td>
    </tr>
  )
}

function RisksTab() {
  const likelihoodColor = (l: string) =>
    l === "HIGH" ? "text-red-600" : l === "MEDIUM" ? "text-amber-600" : "text-slate-500"
  const impactColor = (i: string) =>
    i === "HIGH" ? "text-red-600" : i === "MEDIUM" ? "text-amber-600" : "text-slate-500"

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-slate-600">
          Risk register with RAG ratings per the RICS standard. Reviewed at least quarterly by the named surveyor.
        </p>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Risk</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-600 w-[80px]">Likelihood</th>
              <th className="text-center px-3 py-2.5 font-medium text-slate-600 w-[80px]">Impact</th>
              <th className="text-left px-4 py-2.5 font-medium text-slate-600">Mitigation</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {AI_RISKS.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{r.description}</p>
                </td>
                <td className={`px-3 py-3 text-center text-xs font-medium ${likelihoodColor(r.likelihood)}`}>
                  {r.likelihood}
                </td>
                <td className={`px-3 py-3 text-center text-xs font-medium ${impactColor(r.impact)}`}>
                  {r.impact}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 leading-relaxed">{r.mitigation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <p className="text-xs text-slate-400">
          Last reviewed: {new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}. Next quarterly review due:{" "}
          {new Date(Date.now() + 90 * 86400000).toLocaleDateString("en-GB", { dateStyle: "long" })}.
        </p>
      </div>
    </div>
  )
}

function DipSamplingTab({ orgId }: { orgId: string }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4">
        <p className="text-sm text-slate-600 mb-1">
          Randomised dip-sampling of AI-influenced assessments. The RICS standard requires regular random samples to verify that automated or AI-assisted outputs are reliable.
        </p>
        <p className="text-xs text-slate-400">
          Dip-sampling will activate once Phase 1 anomaly flags are generating reviewable assessments. Each flagged assessment has a 10% chance of being sampled for named-surveyor review.
        </p>
      </div>

      <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center">
        <p className="text-sm text-slate-400 mb-2">No assessments flagged for review yet.</p>
        <p className="text-xs text-slate-300">
          Dip-sampling activates automatically when anomaly flags are triggered in Phase 1.
        </p>
      </div>
    </div>
  )
}