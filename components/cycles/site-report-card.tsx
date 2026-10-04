"use client"

import { useState } from "react"
import { toast } from "sonner"
import { generateSiteReport } from "@/lib/actions/site-report"
import type { getCycleSiteReport } from "@/lib/actions/site-report"

type SiteReportView = NonNullable<Awaited<ReturnType<typeof getCycleSiteReport>>>

export function SiteReportCard({
  cycleId,
  report: initial,
}: {
  cycleId: string
  report: SiteReportView | null
}) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<SiteReportView | null>(initial)
  const [copied, setCopied] = useState(false)

  const baseUrl = typeof window !== "undefined" ? `${window.location.protocol}//${window.location.host}` : ""

  async function handleGenerate() {
    setLoading(true)
    try {
      const result = await generateSiteReport(cycleId)
      setReport({
        id: result.reportId,
        token: result.token,
        status: "OPEN",
        submittedAt: null,
        createdAt: new Date(),
        lines: [],
      })
      toast.success("Site report link generated — share it with the site manager")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate link")
    } finally {
      setLoading(false)
    }
  }

  function copyLink() {
    if (!report) return
    navigator.clipboard.writeText(`${baseUrl}/site-report/${report.token}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareLink() {
    if (!report) return
    const url = `${baseUrl}/site-report/${report.token}`
    if (navigator.share) {
      navigator.share({ title: "Site Progress Report", url })
    } else {
      navigator.clipboard.writeText(url)
      toast.success("Link copied to clipboard")
    }
  }

  if (!report) {
    return (
      <div className="rounded-lg border bg-white p-6">
        <h3 className="font-semibold text-slate-900 mb-2">Site report</h3>
        <p className="text-sm text-slate-500 mb-4">
          Generate a link for the site manager to report physical progress on each BOQ line. No login needed — they open the link on their phone.
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : "Generate site report link"}
        </button>
      </div>
    )
  }

  if (report.status === "SUBMITTED") {
    const lineCount = report.lines.length
    const reported = report.lines.filter((l) => l.pctComplete !== null).length
    return (
      <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-emerald-900">Site report submitted</h3>
            <p className="text-sm text-emerald-700 mt-0.5">
              {reported}/{lineCount} lines reported
              {report.submittedAt && <> · {new Date(report.submittedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</>}
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 underline"
          >
            {loading ? "…" : "Regenerate"}
          </button>
        </div>

        {/* Line summary */}
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {report.lines.map((l) => (
            <div
              key={l.id}
              className="flex items-center justify-between bg-white/60 rounded px-3 py-1.5 text-sm"
              style={{ marginLeft: l.indentLevel * 12 }}
            >
              <span className="text-slate-700 truncate flex-1">
                {l.itemRef}: {l.description}
              </span>
              <span className="text-emerald-700 font-medium tabular-nums ml-2 shrink-0">
                {l.pctComplete !== null ? `${l.pctComplete}%` : "—"}
              </span>
              {l.photos.length > 0 && (
                <span className="text-slate-400 text-xs ml-2">📷{l.photos.length}</span>
              )}
            </div>
          ))}
        </div>

        {/* Photo gallery */}
        {report.lines.some((l) => l.photos.length > 0) && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {report.lines.flatMap((l) =>
              l.photos.map((p: { url: string; takenAt: string }, i: number) => (
                <a
                  key={`${l.id}-${i}`}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-emerald-200 relative"
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[7px] text-center py-0.5">
                    {new Date(p.takenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </a>
              ))
            )}
          </div>
        )}
      </div>
    )
  }

  // OPEN — link generated but not yet submitted
  const url = `${baseUrl}/site-report/${report.token}`
  return (
    <div className="rounded-lg border bg-indigo-50 border-indigo-200 p-6">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-indigo-900">Site report — awaiting submission</h3>
          <p className="text-sm text-indigo-700 mt-0.5">
            Share this link with the site manager — no login needed.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-xs font-medium text-indigo-700 hover:text-indigo-900 underline"
        >
          {loading ? "…" : "Regenerate"}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs bg-white rounded px-3 py-2 border border-indigo-200 text-slate-700 break-all select-all">
          {url}
        </code>
        <button
          onClick={copyLink}
          className="shrink-0 px-3 py-2 text-xs font-medium bg-white border border-indigo-200 rounded text-indigo-700 hover:bg-indigo-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={shareLink}
          className="shrink-0 px-3 py-2 text-xs font-medium bg-white border border-indigo-200 rounded text-indigo-700 hover:bg-indigo-100"
        >
          Share
        </button>
      </div>
    </div>
  )
}