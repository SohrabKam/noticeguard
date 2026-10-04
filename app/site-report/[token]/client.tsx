"use client"

import { useState, useRef, useCallback, useMemo } from "react"
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
  const [expandedPhotos, setExpandedPhotos] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState("")
  const fileRefs = useRef<Record<string, HTMLInputElement>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const token = initial.token

  // Filter lines by search
  const filteredLines = useMemo(() => {
    if (!search.trim()) return lines
    const q = search.toLowerCase()
    return lines.filter(
      (l) =>
        l.itemRef.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q),
    )
  }, [lines, search])

  // Only leaf lines (indentLevel >= 2) are editable; parents show auto-sum
  const isEditable = (line: LineData) => line.indentLevel >= 2

  const saveLine = useCallback(
    async (lineId: string, pctComplete: number | null) => {
      setSaving((s) => ({ ...s, [lineId]: true }))
      try {
        const res = await fetch(`/api/site-report/${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, pctComplete }),
        })
        if (!res.ok) {
          // revert on failure — but we optimistically update below
        }
      } catch {
        // silently ignore
      } finally {
        setSaving((s) => ({ ...s, [lineId]: false }))
      }
    },
    [token],
  )

  const debouncedSave = useCallback(
    (lineId: string, pct: number | null) => {
      if (saveTimers.current[lineId]) clearTimeout(saveTimers.current[lineId])
      saveTimers.current[lineId] = setTimeout(() => saveLine(lineId, pct), 600)
    },
    [saveLine],
  )

  const updatePct = useCallback(
    (lineId: string, raw: string) => {
      // Accept empty, partial, or full numbers
      if (raw === "" || raw === "-") {
        setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, pctComplete: null } : l)))
        debouncedSave(lineId, null)
        return
      }
      const n = parseFloat(raw)
      if (isNaN(n)) return
      const clamped = Math.max(0, Math.min(100, n))
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, pctComplete: clamped } : l)))
      debouncedSave(lineId, clamped)
    },
    [debouncedSave],
  )

  const quickSet = useCallback(
    (lineId: string, pct: number) => {
      setLines((prev) => prev.map((l) => (l.id === lineId ? { ...l, pctComplete: pct } : l)))
      if (saveTimers.current[lineId]) clearTimeout(saveTimers.current[lineId])
      saveLine(lineId, pct)
    },
    [saveLine],
  )

  const handlePhoto = useCallback(
    async (lineId: string, file: File) => {
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
          prev.map((l) =>
            l.id === lineId
              ? { ...l, photos: [...l.photos, { url, takenAt: takenAt.toISOString() }] }
              : l,
          ),
        )
      } catch {
        // silently fail
      } finally {
        setUploading((s) => ({ ...s, [lineId]: false }))
        if (fileRefs.current[lineId]) fileRefs.current[lineId].value = ""
      }
    },
    [token],
  )

  const handleSubmit = async () => {
    if (!confirm("Submit this report? Once submitted it cannot be changed.")) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/site-report/${token}/submit`, { method: "POST" })
      if (!res.ok) throw new Error("Submit failed")
      const json = await res.json()
      setSubmitted(true)
      setSubmittedAt(json.submittedAt)
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
              {new Date(submittedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
      </div>
    )
  }

  const doneCount = lines.filter((l) => isEditable(l) && l.pctComplete !== null).length
  const editableCount = lines.filter((l) => isEditable(l)).length

  return (
    <div className="min-h-screen bg-white pb-20">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-4 sticky top-0 z-10">
        <h1 className="text-base font-bold leading-tight">Site Progress Report</h1>
        <p className="text-xs text-indigo-200 mt-0.5">
          {initial.subcontractorName} · Cycle #{initial.cycleNumber}
        </p>
        <p className="text-[10px] text-indigo-300 mt-0.5">
          {initial.projectName} · {initial.subcontractRef} · {doneCount}/{editableCount} lines reported
        </p>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b bg-slate-50 sticky top-[80px] z-10">
        <input
          type="search"
          placeholder={`Search ${lines.length} lines…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 sticky top-[128px] z-10">
            <tr>
              <th className="text-left px-2 py-2 font-medium text-slate-600 w-[60px]">Ref</th>
              <th className="text-left px-2 py-2 font-medium text-slate-600">Description</th>
              <th className="text-center px-1 py-2 font-medium text-slate-600 w-[80px]">%</th>
              <th className="text-center px-1 py-2 font-medium text-slate-600 w-[36px]">📷</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLines.map((line) => {
              const editable = isEditable(line)
              const pct = line.pctComplete
              const pctStr = pct !== null ? String(pct) : ""
              const pctColor =
                pct === null ? "text-slate-400" : pct >= 100 ? "text-emerald-600" : pct > 0 ? "text-amber-600" : "text-slate-600"
              const photoCount = line.photos.length

              return (
                <tr
                  key={line.id}
                  className={cn(
                    "hover:bg-slate-50",
                    line.indentLevel === 0 && "bg-slate-50 font-bold",
                    line.indentLevel === 1 && "bg-slate-50/50 font-semibold",
                  )}
                >
                  {/* Ref */}
                  <td
                    className="px-2 py-1.5 text-xs text-slate-500 whitespace-nowrap"
                    style={{ paddingLeft: 4 + line.indentLevel * 8 }}
                  >
                    {line.itemRef}
                  </td>

                  {/* Description */}
                  <td className="px-2 py-1.5 text-xs text-slate-700 leading-tight">
                    <span className="line-clamp-2">{line.description}</span>
                    {!editable && line.indentLevel <= 1 && (
                      <span className="text-[10px] text-slate-400 ml-1">(section)</span>
                    )}
                  </td>

                  {/* % input */}
                  <td className="px-1 py-1.5 text-center">
                    {editable ? (
                      <div className="flex items-center gap-0.5 justify-center">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={pctStr}
                          onChange={(e) => updatePct(line.id, e.target.value)}
                          onBlur={() => {
                            // final save on blur
                            if (saveTimers.current[line.id]) {
                              clearTimeout(saveTimers.current[line.id])
                              saveLine(line.id, line.pctComplete)
                            }
                          }}
                          placeholder="—"
                          className={cn(
                            "w-14 text-center text-xs rounded border px-1 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400",
                            pctColor,
                            saving[line.id] && "opacity-40",
                          )}
                        />
                        {/* Quick-set micro-buttons */}
                        <button
                          onClick={() => quickSet(line.id, 0)}
                          className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200 leading-none"
                          title="0%"
                        >
                          0
                        </button>
                        <button
                          onClick={() => quickSet(line.id, 100)}
                          className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 leading-none"
                          title="100%"
                        >
                          100
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>

                  {/* Photo */}
                  <td className="px-1 py-1.5 text-center">
                    {editable ? (
                      <div className="relative">
                        <button
                          onClick={() => fileRefs.current[line.id]?.click()}
                          disabled={uploading[line.id]}
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            photoCount > 0
                              ? "bg-indigo-50 text-indigo-600 font-medium"
                              : "text-slate-400 hover:text-indigo-500",
                            uploading[line.id] && "opacity-50",
                          )}
                        >
                          {uploading[line.id] ? "…" : photoCount > 0 ? `${photoCount}` : "+"}
                        </button>
                        {photoCount > 0 && (
                          <button
                            onClick={() =>
                              setExpandedPhotos((p) => ({
                                ...p,
                                [line.id]: !p[line.id],
                              }))
                            }
                            className="text-[9px] text-indigo-400 underline ml-0.5"
                          >
                            {expandedPhotos[line.id] ? "hide" : "view"}
                          </button>
                        )}
                        <input
                          ref={(el) => {
                            if (el) fileRefs.current[line.id] = el
                          }}
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
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Expanded photo strips */}
      {Object.entries(expandedPhotos)
        .filter(([, v]) => v)
        .map(([lineId]) => {
          const line = lines.find((l) => l.id === lineId)
          if (!line || line.photos.length === 0) return null
          return (
            <div
              key={`photos-${lineId}`}
              className="px-3 py-2 border-t bg-slate-50 flex gap-2 overflow-x-auto"
            >
              {line.photos.map((p, i) => (
                <a
                  key={i}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 w-24 h-24 rounded-lg overflow-hidden border relative"
                >
                  <img src={p.url} alt="" className="w-full h-full object-cover" />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[7px] text-center py-0.5">
                    {new Date(p.takenAt).toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </a>
              ))}
            </div>
          )
        })}

      {/* Submit bar — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t px-3 py-3">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold text-sm disabled:opacity-50 hover:bg-indigo-700 transition-colors"
        >
          {submitting ? "Submitting…" : `Submit report (${doneCount}/${editableCount})`}
        </button>
      </div>
    </div>
  )
}