"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

type LineData = {
  id: string
  sortOrder: number
  itemRef: string
  description: string
  indentLevel: number
  contractValue: number
  pctComplete: number | null
  note: string | null
  photos: Array<{ url: string; takenAt: string }>
}

type ReportData = {
  token: string
  status: string
  submittedAt: string | null
  cycleNumber: number
  subcontractRef: string
  subcontractorName: string
  projectName: string
  lines: LineData[]
}

const PRESET_PCTS = [0, 25, 50, 75, 100]

/** Burn a visible timestamp into a photo via canvas. Returns data URL. */
function burnTimestamp(file: File, takenAt: Date): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext("2d")!
        ctx.drawImage(img, 0, 0)

        // Timestamp bar
        const barH = Math.max(28, Math.round(img.height * 0.06))
        const ts = takenAt.toLocaleString("en-GB", {
          day: "2-digit", month: "short", year: "numeric",
          hour: "2-digit", minute: "2-digit",
        })
        const fontSize = Math.max(13, Math.round(barH * 0.45))

        ctx.fillStyle = "rgba(0,0,0,0.55)"
        ctx.fillRect(0, img.height - barH, img.width, barH)
        ctx.fillStyle = "#ffffff"
        ctx.font = `600 ${fontSize}px -apple-system, sans-serif`
        ctx.textAlign = "right"
        ctx.fillText(ts, img.width - 12, img.height - barH / 2 + fontSize / 3)

        resolve(canvas.toDataURL("image/jpeg", 0.85))
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function SiteReportClient({ report: initial }: { report: ReportData }) {
  const [lines, setLines] = useState<LineData[]>(initial.lines)
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(initial.status === "SUBMITTED")
  const [submittedAt, setSubmittedAt] = useState(initial.submittedAt)
  const fileRefs = useRef<Record<string, HTMLInputElement>>({})

  const token = initial.token

  const updateLine = useCallback(async (lineId: string, pctComplete: number | null) => {
    setSaving((s) => ({ ...s, [lineId]: true }))
    try {
      const res = await fetch(`/api/site-report/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId, pctComplete }),
      })
      if (!res.ok) throw new Error("Save failed")
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, pctComplete } : l)))
    } catch {
      // silently fail — the % button stays as-is
    } finally {
      setSaving((s) => ({ ...s, [lineId]: false }))
    }
  }, [token])

  const handlePhoto = useCallback(async (lineId: string, file: File) => {
    const takenAt = new Date()
    setUploading((s) => ({ ...s, [lineId]: true }))
    try {
      const burned = await burnTimestamp(file, takenAt)
      const res = await fetch(`/api/site-report/${token}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineId, image: burned, takenAt: takenAt.toISOString() }),
      })
      if (!res.ok) throw new Error("Upload failed")
      const { url }: { url: string } = await res.json()
      setLines((prev) =>
        prev.map((l) => (l.id === lineId ? { ...l, photos: [...l.photos, { url, takenAt: takenAt.toISOString() }] } : l))
      )
    } catch {
      // silently fail
    } finally {
      setUploading((s) => ({ ...s, [lineId]: false }))
      // Reset file input
      if (fileRefs.current[lineId]) fileRefs.current[lineId].value = ""
    }
  }, [token])

  const handleSubmit = async () => {
    if (!confirm("Submit this report? Once submitted it cannot be changed.")) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/site-report/${token}/submit`, { method: "POST" })
      if (!res.ok) throw new Error("Submit failed")
      const { submittedAt: ts }: { submittedAt: string } = await res.json()
      setSubmitted(true)
      setSubmittedAt(ts)
    } catch {
      alert("Failed to submit. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submitted state ──
  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Report submitted</h2>
          <p className="text-sm text-slate-500 mb-2">
            {initial.subcontractorName} · Cycle #{initial.cycleNumber}
          </p>
          {submittedAt && (
            <p className="text-xs text-slate-400">
              Submitted {new Date(submittedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Active report ──
  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-5 py-6">
        <h1 className="text-lg font-bold">Site Progress Report</h1>
        <p className="text-sm text-indigo-200 mt-1">
          {initial.subcontractorName} · Cycle #{initial.cycleNumber}
        </p>
        <p className="text-xs text-indigo-300 mt-0.5">
          {initial.projectName} · {initial.subcontractRef}
        </p>
      </div>

      {/* Lines */}
      <div className="px-4 pt-4 space-y-3">
        {lines.map((line) => {
          const indent = line.indentLevel > 0 ? line.indentLevel * 16 : 0
          const isParent = line.indentLevel === 0
          return (
            <div
              key={line.id}
              className={cn(
                "rounded-xl border bg-white p-4",
                isParent && "bg-slate-100 border-slate-200",
              )}
              style={{ marginLeft: indent }}
            >
              {/* Item info */}
              <p className={cn("text-sm font-semibold", isParent ? "text-slate-800" : "text-slate-700")}>
                {line.itemRef}: {line.description}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Contract value: £{line.contractValue.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
              </p>

              {/* % buttons */}
              {!isParent && (
                <div className="mt-3">
                  <p className="text-xs text-slate-500 mb-1.5">% complete:</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {PRESET_PCTS.map((pct) => (
                      <button
                        key={pct}
                        onClick={() => updateLine(line.id, pct)}
                        disabled={saving[line.id]}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                          line.pctComplete === pct
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300",
                          saving[line.id] && "opacity-50",
                        )}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Photos */}
              {!isParent && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {line.photos.map((p, i) => (
                      <a
                        key={i}
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 block"
                      >
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center py-0.5">
                          {new Date(p.takenAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </a>
                    ))}
                    <button
                      onClick={() => fileRefs.current[line.id]?.click()}
                      disabled={uploading[line.id]}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                    >
                      {uploading[line.id] ? (
                        <span className="text-[10px]">…</span>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </button>
                    <input
                      ref={(el) => { if (el) fileRefs.current[line.id] = el }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handlePhoto(line.id, file)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Submit button — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-4 py-4">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-semibold text-base disabled:opacity-50 hover:bg-indigo-700 transition-colors"
        >
          {submitting ? "Submitting…" : "Submit report"}
        </button>
      </div>
    </div>
  )
}