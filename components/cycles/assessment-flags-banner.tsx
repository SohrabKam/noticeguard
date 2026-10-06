"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react"
import type { AssessmentFlag } from "@/lib/assessment-flags"

const SEVERITY_COLORS = {
  red: "border-red-300 bg-red-50 text-red-800",
  amber: "border-amber-300 bg-amber-50 text-amber-800",
  yellow: "border-yellow-300 bg-yellow-50 text-yellow-800",
} as const

const SEVERITY_LABELS = {
  red: "Critical",
  amber: "Warning",
  yellow: "Advisory",
} as const

export function AssessmentFlagsBanner({
  flags,
  cycleId,
}: {
  flags: AssessmentFlag[]
  cycleId: string
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState(false)
  const router = useRouter()

  const visible = flags.filter((f) => !dismissed.has(f.id))
  if (visible.length === 0) return null

  const redCount = visible.filter((f) => f.severity === "red").length
  const amberCount = visible.filter((f) => f.severity === "amber").length

  async function dismiss(flagId: string) {
    setDismissed((prev) => new Set([...prev, flagId]))
    try {
      const res = await fetch(`/api/assessments/${cycleId}/flags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagId, reason: "Dismissed by QS" }),
      })
      if (!res.ok) throw new Error("Failed to log dismissal")
    } catch {
      // Non-blocking — the banner state is local, audit logging is best-effort
    }
  }

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      {/* Summary bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50 transition-colors"
      >
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <span className="font-medium text-slate-900">
          {visible.length} assessment flag{visible.length !== 1 ? "s" : ""} — review before certifying
        </span>
        {redCount > 0 && (
          <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {redCount} critical
          </span>
        )}
        {amberCount > 0 && (
          <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {amberCount} warning
          </span>
        )}
        <span className="ml-auto">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </span>
      </button>

      {/* Expanded flag list */}
      {expanded && (
        <div className="border-t divide-y">
          {visible.map((flag) => (
            <div
              key={flag.id}
              className={cn(
                "flex items-start gap-3 px-4 py-3",
                SEVERITY_COLORS[flag.severity],
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5",
                  flag.severity === "red"
                    ? "bg-red-200 text-red-800"
                    : flag.severity === "amber"
                    ? "bg-amber-200 text-amber-800"
                    : "bg-yellow-200 text-yellow-800",
                )}
              >
                {SEVERITY_LABELS[flag.severity]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium mb-0.5">{flag.ruleName}</p>
                <p className="text-xs leading-relaxed opacity-90">{flag.message}</p>
              </div>
              <button
                onClick={() => dismiss(flag.id)}
                className="shrink-0 p-1 rounded hover:bg-black/10 transition-colors"
                title="Dismiss this flag"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}