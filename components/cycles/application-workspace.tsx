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
import { isParentRow, computeAutoSums, computeApplicationTotal } from "@/lib/assessment-totals"

type ApplicationLine = {
  id: string
  sortOrder: number
  itemRef: string
  description: string
  contractValue: number | string
  isVariation: boolean
  indentLevel: number
  qtyOrPctClaimed: number | string | null
  valueToDateClaimed: number | string
  notes: string | null
}

function toNumericLines(lines: ApplicationLine[]) {
  return lines.map((l) => ({
    indentLevel: l.indentLevel,
    valueToDateClaimed: Number(l.valueToDateClaimed),
  }))
}

// isParentRow/computeAutoSums operate on a generic {indentLevel, valueToDate}
// shape — adapt the claimed-figure field name once here, same pattern
// computeApplicationTotal uses internally.
function toAutoSumLines(lines: ApplicationLine[]) {
  return lines.map((l) => ({ indentLevel: l.indentLevel, valueToDate: Number(l.valueToDateClaimed) }))
}

const COL_ITEM_REF = 0
const COL_DESCRIPTION = 1
const COL_CONTRACT_VALUE = 2
const COL_QTY_PCT = 3
const COL_VALUE_CLAIMED = 4
const COL_NOTES = 5

const COLUMNS: GridColumn[] = [
  { title: "Ref", width: 70, id: "itemRef" },
  { title: "Description", width: 320, id: "description" },
  { title: "Contract value", width: 120, id: "contractValue" },
  { title: "Qty / %", width: 80, id: "qtyOrPctClaimed" },
  { title: "Value claimed", width: 130, id: "valueToDateClaimed" },
  { title: "Notes", width: 220, id: "notes" },
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

export function ApplicationWorkspace({
  applicationId,
  lines: initialLines,
}: {
  applicationId: string
  lines: ApplicationLine[]
}) {
  const [lines, setLines] = useState<ApplicationLine[]>(initialLines)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingChanges = useRef<Map<string, { lineId: string; field: string; oldValue: unknown; newValue: unknown }>>(
    new Map()
  )

  const autoSumLines = useMemo(() => toAutoSumLines(lines), [lines])
  const autoSums = useMemo(() => computeAutoSums(autoSumLines), [autoSumLines])
  const total = useMemo(() => computeApplicationTotal(toNumericLines(lines)), [lines])

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const line = lines[row]
      if (!line) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }

      const isParent = isParentRow(autoSumLines, row)
      const theme = line.indentLevel === 0 ? SECTION_THEME
        : line.indentLevel === 1 ? ITEM_THEME
        : undefined

      const claimed = autoSums[row]

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
          if (isParent) {
            return {
              kind: GridCellKind.Text,
              data: "",
              displayData: "",
              allowOverlay: false,
              readonly: true,
              themeOverride: theme,
            }
          }
          return {
            kind: GridCellKind.Number,
            data: Number(line.qtyOrPctClaimed ?? 0),
            displayData: pct(line.qtyOrPctClaimed),
            allowOverlay: true,
            readonly: false,
          }
        case COL_VALUE_CLAIMED:
          if (isParent) {
            return {
              kind: GridCellKind.Text,
              data: fmt(claimed),
              displayData: `Σ £${fmt(claimed)}`,
              allowOverlay: false,
              readonly: true,
              themeOverride: theme,
            }
          }
          return {
            kind: GridCellKind.Number,
            data: Number(line.valueToDateClaimed),
            displayData: `£${fmt(line.valueToDateClaimed)}`,
            allowOverlay: true,
            readonly: false,
          }
        case COL_NOTES:
          return {
            kind: GridCellKind.Text,
            data: line.notes ?? "",
            displayData: line.notes ?? "",
            allowOverlay: !isParent,
            readonly: isParent,
            themeOverride: theme,
          }
        default:
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }
      }
    },
    [lines, autoSumLines, autoSums]
  )

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const changes = Array.from(pendingChanges.current.values())
      if (changes.length === 0) return
      pendingChanges.current.clear()
      setSaving(true)
      try {
        const res = await fetch(`/api/applications/${applicationId}/lines`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ changes }),
        })
        if (!res.ok) throw new Error("Save failed")
        const data: { amountApplied: number } = await res.json()
        if (Math.abs(data.amountApplied - total) > 0.01) {
          console.warn("[application] client/server totals diverged", { client: total, server: data.amountApplied })
          toast.warning("Total was recalculated on save — refresh to see the latest figure.")
        }
        setLastSaved(new Date())
      } catch {
        toast.error("Failed to save — changes may be lost")
      } finally {
        setSaving(false)
      }
    }, 800)
  }, [applicationId, total])

  const onCellEdited = useCallback(
    ([col, row]: Item, newCell: EditableGridCell) => {
      const line = lines[row]
      if (!line) return
      if (isParentRow(autoSumLines, row)) return

      let field: string
      let oldValue: unknown
      let newValue: unknown

      if (col === COL_QTY_PCT) {
        field = "qtyOrPctClaimed"
        const pctVal = newCell.kind === GridCellKind.Number ? (newCell.data ?? 0) : 0
        oldValue = Number(line.qtyOrPctClaimed ?? 0)
        newValue = pctVal
        // Derive valueToDateClaimed from % complete × contractValue
        const derived = (pctVal / 100) * Number(line.contractValue)
        setLines((prev) =>
          prev.map((l, i) =>
            i === row ? { ...l, qtyOrPctClaimed: pctVal, valueToDateClaimed: derived } : l
          )
        )
        pendingChanges.current.set(`${line.id}-qtyOrPctClaimed`, { lineId: line.id, field: "qtyOrPctClaimed", oldValue, newValue })
        pendingChanges.current.set(`${line.id}-valueToDateClaimed`, { lineId: line.id, field: "valueToDateClaimed", oldValue: Number(line.valueToDateClaimed), newValue: derived })
        scheduleSave()
        return
      } else if (col === COL_VALUE_CLAIMED) {
        field = "valueToDateClaimed"
        oldValue = Number(line.valueToDateClaimed)
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
    [lines, autoSumLines, scheduleSave]
  )

  return (
    <div className="space-y-4">
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

      <div className="rounded-lg border p-3 bg-indigo-50 border-indigo-200 max-w-xs">
        <p className="text-xs text-slate-500 mb-1">Total claimed</p>
        <p className="text-base font-bold text-indigo-700">£{fmt(total)}</p>
      </div>

      <div className="text-xs text-slate-400">
        {saving && <span className="animate-pulse">Saving…</span>}
        {!saving && lastSaved && (
          <span>Last saved {lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
        )}
      </div>
    </div>
  )
}
