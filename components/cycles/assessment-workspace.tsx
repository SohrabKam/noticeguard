"use client"
import { useState, useCallback, useRef, useMemo } from "react"
import DataEditor, {
  type GridCell,
  type GridColumn,
  type Item,
  GridCellKind,
  type EditableGridCell,
  type Theme,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import { toast } from "sonner"
import { Download } from "lucide-react"
import { isParentRow, computeAutoSums, computeAssessmentTotals } from "@/lib/assessment-totals"

type AssessmentLine = {
  id: string
  sortOrder: number
  itemRef: string
  description: string
  contractValue: number | string
  isVariation: boolean
  indentLevel: number
  qtyOrPctComplete: number | string | null
  valueToDate: number | string
  claimedValueToDate: number | string | null
  previouslyCertified: number | string
  thisCycle: number | string
  notes: string | null
}

type Assessment = {
  id: string
  isLocked: boolean
  grossValuation: number | string
  retentionAmount: number | string
  previouslyCert: number | string
  netThisCycle: number | string
  lastSavedAt: Date | string | null
  lines: AssessmentLine[]
}

// Shared isParentRow/computeAutoSums (see lib/assessment-totals.ts) operate
// on plain-number fields; this file's lines carry `number | string` (as
// serialized across the server/client boundary), so convert once here.
function toNumericLines(lines: AssessmentLine[]) {
  return lines.map((l) => ({
    indentLevel: l.indentLevel,
    valueToDate: Number(l.valueToDate),
    previouslyCertified: Number(l.previouslyCertified),
  }))
}

function exportCsv(lines: AssessmentLine[]) {
  const headers = ["Ref", "Description", "Contract Value", "Qty/%", "Value to Date", "Prev Certified", "This Cycle", "Notes"]
  const autoSums = computeAutoSums(toNumericLines(lines))
  const rows = lines.map((l, i) => {
    const vtd = autoSums[i]
    const thisVal = vtd - Number(l.previouslyCertified)
    return [
      l.itemRef,
      `"${l.description.replace(/"/g, '""')}"`,
      Number(l.contractValue).toFixed(2),
      l.qtyOrPctComplete !== null ? Number(l.qtyOrPctComplete).toFixed(2) : "",
      vtd.toFixed(2),
      Number(l.previouslyCertified).toFixed(2),
      thisVal.toFixed(2),
      `"${(l.notes ?? "").replace(/"/g, '""')}"`,
    ]
  })
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `assessment-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const COL_ITEM_REF = 0
const COL_DESCRIPTION = 1
const COL_CONTRACT_VALUE = 2
const COL_QTY_PCT = 3
const COL_CLAIMED = 4
const COL_VALUE_TO_DATE = 5
const COL_PREV_CERT = 6
const COL_THIS_CYCLE = 7
const COL_NOTES = 8

const COLUMNS: GridColumn[] = [
  { title: "Ref", width: 70, id: "itemRef" },
  { title: "Description", width: 300, id: "description" },
  { title: "Contract value", width: 120, id: "contractValue" },
  { title: "Qty / %", width: 80, id: "qtyOrPctComplete" },
  { title: "Claimed", width: 120, id: "claimedValueToDate" },
  { title: "Value to date", width: 120, id: "valueToDate" },
  { title: "Prev certified", width: 120, id: "previouslyCertified" },
  { title: "This cycle", width: 120, id: "thisCycle" },
  { title: "Notes", width: 200, id: "notes" },
]

const SECTION_THEME: Partial<Theme> = {
  bgCell: "#dde3ed",
  textDark: "#0f172a",
  baseFontStyle: "700 13px",
}

const ITEM_THEME: Partial<Theme> = {
  bgCell: "#f1f5f9",
  textDark: "#1e293b",
  baseFontStyle: "600 13px",
}

function fmt(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  return isNaN(v) ? "0.00" : v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(n: number | string | null | undefined) {
  const v = Number(n ?? 0)
  return isNaN(v) ? "" : v.toFixed(2)
}

export function AssessmentWorkspace({
  assessment,
  retentionPct,
  isLocked,
}: {
  assessment: Assessment
  retentionPct: number
  // Not read in this component — kept so the prop contract stays stable for
  // callers/loaders; wire it up if a cycle-scoped link/action is added here.
  cycleId: string
  isLocked: boolean
}) {
  const [lines, setLines] = useState<AssessmentLine[]>(assessment.lines)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(
    assessment.lastSavedAt ? new Date(assessment.lastSavedAt as string) : null
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingChanges = useRef<Map<string, { lineId: string; field: string; oldValue: unknown; newValue: unknown }>>(
    new Map()
  )

  const autoSums = useMemo(() => computeAutoSums(toNumericLines(lines)), [lines])

  // Totals: sum only leaf rows (non-parent rows) — declared early since
  // scheduleSave's closure below references them.
  const { gross, retention, prev, net } = useMemo(
    () => computeAssessmentTotals(toNumericLines(lines), retentionPct),
    [lines, retentionPct]
  )

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const line = lines[row]
      if (!line) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }

      const isParent = isParentRow(lines, row)
      const theme = line.indentLevel === 0 ? SECTION_THEME
        : line.indentLevel === 1 ? ITEM_THEME
        : undefined

      const vtd = autoSums[row]
      const thisVal = vtd - Number(line.previouslyCertified)

      switch (col) {
        case COL_ITEM_REF:
          return {
            kind: GridCellKind.Text,
            data: line.itemRef,
            displayData: line.itemRef,
            allowOverlay: false,
            readonly: true,
            themeOverride: theme,
          }
        case COL_DESCRIPTION: {
          const descPrefix = line.indentLevel === 2 ? "└─ " : ""
          const hPad = line.indentLevel === 0 ? 10 : line.indentLevel === 1 ? 26 : 42
          return {
            kind: GridCellKind.Text,
            data: line.description,
            displayData: descPrefix + line.description,
            allowOverlay: false,
            readonly: true,
            themeOverride: { ...(theme ?? {}), cellHorizontalPadding: hPad },
          }
        }
        case COL_CONTRACT_VALUE:
          return {
            kind: GridCellKind.Text,
            data: fmt(line.contractValue),
            displayData: `£${fmt(line.contractValue)}`,
            allowOverlay: false,
            readonly: true,
            themeOverride: theme,
          }
        case COL_QTY_PCT:
          if (isParent || isLocked) {
            return {
              kind: GridCellKind.Text,
              data: "",
              displayData: isParent ? "" : pct(line.qtyOrPctComplete),
              allowOverlay: false,
              readonly: true,
              themeOverride: theme,
            }
          }
          return {
            kind: GridCellKind.Number,
            data: Number(line.qtyOrPctComplete ?? 0),
            displayData: pct(line.qtyOrPctComplete),
            allowOverlay: true,
            readonly: false,
          }
        case COL_CLAIMED:
          return {
            kind: GridCellKind.Text,
            data: line.claimedValueToDate !== null ? fmt(line.claimedValueToDate) : "",
            displayData: line.claimedValueToDate !== null ? `£${fmt(line.claimedValueToDate)}` : "—",
            allowOverlay: false,
            readonly: true,
            themeOverride: theme,
          }
        case COL_VALUE_TO_DATE:
          if (isParent) {
            return {
              kind: GridCellKind.Text,
              data: fmt(vtd),
              displayData: `Σ £${fmt(vtd)}`,
              allowOverlay: false,
              readonly: true,
              themeOverride: theme,
            }
          }
          return {
            kind: GridCellKind.Number,
            data: Number(line.valueToDate),
            displayData: `£${fmt(line.valueToDate)}`,
            allowOverlay: !isLocked,
            readonly: isLocked,
          }
        case COL_PREV_CERT:
          return {
            kind: GridCellKind.Text,
            data: fmt(line.previouslyCertified),
            displayData: isParent ? `Σ £${fmt(Number(line.previouslyCertified))}` : `£${fmt(line.previouslyCertified)}`,
            allowOverlay: false,
            readonly: true,
            themeOverride: theme,
          }
        case COL_THIS_CYCLE:
          return {
            kind: GridCellKind.Text,
            data: fmt(thisVal),
            displayData: isParent ? `Σ £${fmt(thisVal)}` : `£${fmt(thisVal)}`,
            allowOverlay: false,
            readonly: true,
            themeOverride: theme,
          }
        case COL_NOTES:
          return {
            kind: GridCellKind.Text,
            data: line.notes ?? "",
            displayData: line.notes ?? "",
            allowOverlay: !isLocked && !isParent,
            readonly: isLocked || isParent,
            themeOverride: theme,
          }
        default:
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }
      }
    },
    [lines, isLocked, autoSums]
  )

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const changes = Array.from(pendingChanges.current.values())
      if (changes.length === 0) return
      pendingChanges.current.clear()
      setSaving(true)
      try {
        const res = await fetch(`/api/assessments/${assessment.id}/lines`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes }),
        })
        if (!res.ok) throw new Error("Save failed")
        const data: { gross: number; retention: number; prev: number; net: number } = await res.json()
        // The server recomputes totals with the same lib/assessment-totals.ts
        // logic as this component, so they should always agree. Surface it
        // if they ever don't (e.g. a concurrent edit from another tab/user,
        // or a future regression) instead of silently trusting whichever
        // figure happens to be on screen.
        if (Math.abs(data.gross - gross) > 0.01 || Math.abs(data.net - net) > 0.01) {
          console.warn("[assessment] client/server totals diverged", { client: { gross, retention, prev, net }, server: data })
          toast.warning("Totals were recalculated on save — refresh to see the latest figures.")
        }
        setLastSaved(new Date())
      } catch {
        toast.error("Failed to save — changes may be lost")
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [assessment.id, gross, retention, prev, net])

  const onCellEdited = useCallback(
    ([col, row]: Item, newCell: EditableGridCell) => {
      if (isLocked) return
      const line = lines[row]
      if (!line) return
      if (isParentRow(lines, row)) return

      let field: string
      let oldValue: unknown
      let newValue: unknown

      if (col === COL_QTY_PCT) {
        field = "qtyOrPctComplete"
        const pctVal = newCell.kind === GridCellKind.Number ? (newCell.data ?? 0) : 0
        oldValue = Number(line.qtyOrPctComplete ?? 0)
        newValue = pctVal
        // Derive valueToDate from % complete × contractValue
        const derived = (pctVal / 100) * Number(line.contractValue)
        setLines((prev) =>
          prev.map((l, i) =>
            i === row ? { ...l, qtyOrPctComplete: pctVal, valueToDate: derived } : l
          )
        )
        pendingChanges.current.set(`${line.id}-qtyOrPctComplete`, { lineId: line.id, field: "qtyOrPctComplete", oldValue, newValue })
        pendingChanges.current.set(`${line.id}-valueToDate`, { lineId: line.id, field: "valueToDate", oldValue: Number(line.valueToDate), newValue: derived })
        scheduleSave()
        return
      } else if (col === COL_VALUE_TO_DATE) {
        field = "valueToDate"
        oldValue = Number(line.valueToDate)
        newValue = newCell.kind === GridCellKind.Number ? (newCell.data ?? 0) : 0
      } else if (col === COL_NOTES) {
        field = "notes"
        oldValue = line.notes
        newValue = newCell.kind === GridCellKind.Text ? newCell.data : ""
      } else {
        return
      }

      setLines((prev) =>
        prev.map((l, i) =>
          i === row ? { ...l, [field]: newValue } : l
        )
      )

      pendingChanges.current.set(`${line.id}-${field}`, {
        lineId: line.id,
        field,
        oldValue,
        newValue,
      })
      scheduleSave()
    },
    [lines, isLocked, scheduleSave]
  )

  return (
    <div className="space-y-4">
      {isLocked && (
        <div className="rounded-lg bg-slate-100 border border-slate-200 px-4 py-2.5 text-sm text-slate-600 flex items-center gap-2">
          <span>🔒</span> This assessment is locked. No further edits can be made.
        </div>
      )}

      <div className="rounded-lg border overflow-hidden shadow-sm">
        <DataEditor
          getCellContent={getCellContent}
          columns={COLUMNS}
          rows={lines.length}
          onCellEdited={onCellEdited}
          width="100%"
          height={Math.min(600, Math.max(200, lines.length * 34 + 36))}
          rowMarkers="none"
          freezeColumns={2}
          smoothScrollX
          smoothScrollY
          theme={{
            accentColor: "#6366f1",
            accentLight: "#eef2ff",
            textDark: "#1e293b",
            textMedium: "#64748b",
            textLight: "#94a3b8",
            bgCell: "#ffffff",
            bgHeader: "#f8fafc",
            bgHeaderHasFocus: "#eef2ff",
            borderColor: "#e2e8f0",
            fontFamily: "Inter, system-ui, sans-serif",
            baseFontStyle: "13px",
            headerFontStyle: "600 12px",
          }}
        />
      </div>

      {/* Totals */}
      <div className="grid grid-cols-4 gap-3">
        <TotalCard label="Gross valuation" value={gross} />
        <TotalCard label={`Retention (${(retentionPct * 100).toFixed(0)}%)`} value={-retention} />
        <TotalCard label="Previously certified" value={-prev} />
        <TotalCard label="Net this cycle" value={net} highlight />
      </div>

      {/* Footer: save status + CSV export */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {saving && <span className="animate-pulse">Saving…</span>}
          {!saving && lastSaved && (
            <span>Last saved {lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => exportCsv(lines)}
          className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download CSV
        </button>
      </div>
    </div>
  )
}

function TotalCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-indigo-200 bg-indigo-50" : "bg-white"}`}>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-base font-bold ${highlight ? "text-indigo-700" : value < 0 ? "text-red-600" : "text-slate-900"}`}>
        {value < 0 ? "-" : ""}£{Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
      </p>
    </div>
  )
}
