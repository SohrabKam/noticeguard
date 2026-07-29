"use client"
import { useCallback, useMemo, useRef, useState } from "react"
import DataEditor, {
  type GridCell,
  type GridColumn,
  type Item,
  type DataEditorRef,
  GridCellKind,
  type EditableGridCell,
  CompactSelection,
  type GridSelection,
} from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import { toast } from "sonner"
import {
  AlignLeft,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toCsv } from "@/lib/csv"

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleLine = {
  id: string | null          // null = unsaved new row
  sortOrder: number
  itemRef: string
  description: string
  contractValue: number
  indentLevel: number        // 0 = section, 1 = item, 2 = sub-item
  isVariation: boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Bottom-up computation: returns the effective displayed value for each row.
// Parent rows show the sum of their direct children; leaf rows show their own value.
function computeDisplayValues(lines: ScheduleLine[]): number[] {
  const values = lines.map((l) => l.contractValue)
  for (let i = lines.length - 1; i >= 0; i--) {
    const level = lines[i].indentLevel
    let sum = 0
    let hasChildren = false
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].indentLevel <= level) break
      if (lines[j].indentLevel === level + 1) {
        sum += values[j]
        hasChildren = true
      }
    }
    if (hasChildren) values[i] = sum
  }
  return values
}

function isParentRow(lines: ScheduleLine[], index: number): boolean {
  const level = lines[index].indentLevel
  const next = lines[index + 1]
  return !!next && next.indentLevel > level
}

function exportCsv(lines: ScheduleLine[], displayValues: number[]) {
  const headers = ["Level", "Ref", "Description", "Contract Value (£)"]
  const rows = lines.map((l, i) => [
    l.indentLevel === 0 ? "Section" : l.indentLevel === 1 ? "Item" : "Sub-item",
    l.itemRef,
    l.description,
    displayValues[i].toFixed(2),
  ])
  const csv = toCsv([headers, ...rows])
  const blob = new Blob([csv], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `schedule-${new Date().toISOString().split("T")[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COL_REF = 0
const COL_DESC = 1
const COL_VALUE = 2
const NUM_COLS = 3

const COLUMNS: GridColumn[] = [
  { title: "Ref", width: 90, id: "itemRef" },
  { title: "Description", width: 420, id: "description" },
  { title: "Contract value", width: 150, id: "contractValue" },
]

// ─── Section / item themes ────────────────────────────────────────────────────

const SECTION_THEME = {
  bgCell: "#dde3ed",
  textDark: "#0f172a",
  baseFontStyle: "700 13px",
}

const ITEM_THEME = {
  bgCell: "#f1f5f9",
  textDark: "#1e293b",
  baseFontStyle: "600 13px",
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ScheduleEditor({
  orderId,
  lines: initialLines,
}: {
  orderId: string
  lines: ScheduleLine[]
}) {
  const [lines, setLines] = useState<ScheduleLine[]>(initialLines)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  })
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Always holds the latest lines — updated synchronously on every mutation
  const linesRef = useRef<ScheduleLine[]>(initialLines)
  const gridRef = useRef<DataEditorRef>(null)
  // Persists last selected row so indent/dedent work even after canvas blur clears selection.current
  const selectedRowRef = useRef<number>(0)

  // ── Derived state ──────────────────────────────────────────────────────────

  const displayValues = useMemo(() => computeDisplayValues(lines), [lines])

  // Sum of all level-0 display values; fallback to sum of everything when no level-0 rows
  const grandTotal = lines.reduce((s, l, i) => {
    if (l.indentLevel === 0) return s + displayValues[i]
    return s
  }, 0) || lines.reduce((s, l, i) => s + displayValues[i], 0)

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    const linesToSave = linesRef.current
    setSaving(true)
    try {
      const res = await fetch(`/api/subcontracts/${orderId}/schedule`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: linesToSave.map((l, i) => ({
            ...(l.id ? { id: l.id } : {}),
            sortOrder: i,
            itemRef: l.itemRef ?? "",
            description: l.description ?? "",
            contractValue: isNaN(Number(l.contractValue)) ? 0 : Number(l.contractValue),
            indentLevel: typeof l.indentLevel === "number" && !isNaN(l.indentLevel) ? l.indentLevel : 0,
            isVariation: !!l.isVariation,
          })),
        }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        console.error(`Schedule save failed (${res.status}):`, errText)
        throw new Error(`Save failed: ${res.status}`)
      }
      const data = await res.json()
      // Reconcile IDs: new rows get server-assigned IDs, matched by sort order
      // index against exactly what was sent (linesToSave), not whatever state
      // happens to be current when the response arrives.
      const serverLines = data.lines as { id: string; sortOrder: number }[]
      const sorted = [...serverLines].sort((a, b) => a.sortOrder - b.sortOrder)
      const reconciled = linesToSave.map((l, i) => ({ ...l, id: sorted[i]?.id ?? l.id }))
      // Update both the ref and state together — previously only state was
      // updated here, so linesRef.current stayed stale with `id: null` on
      // newly-created rows. Every mutation handler reads from the ref, so
      // the next edit would silently revert the id via commit(), and the
      // following autosave would re-POST the row as a new one, duplicating it.
      linesRef.current = reconciled
      setLines(reconciled)
      setLastSaved(new Date())
    } catch (err) {
      console.error("Schedule save error:", err)
      toast.error("Failed to save schedule")
    } finally {
      setSaving(false)
    }
  }, [orderId])

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(save, 1500)
  }, [save])

  // ── Mutation helpers ───────────────────────────────────────────────────────

  // Commit a new lines array: update ref, state, and queue a save
  const commit = useCallback(
    (updated: ScheduleLine[]) => {
      linesRef.current = updated
      setLines(updated)
      scheduleSave()
    },
    [scheduleSave]
  )

  // Force the canvas to redraw specific rows (all columns)
  function damageRows(...rowIndices: number[]) {
    const cells: { cell: Item }[] = []
    for (const row of rowIndices) {
      for (let col = 0; col < NUM_COLS; col++) {
        cells.push({ cell: [col, row] as Item })
      }
    }
    gridRef.current?.updateCells(cells)
  }

  // ── Cell content ───────────────────────────────────────────────────────────

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const line = lines[row]
      if (!line) return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }

      const isSection = line.indentLevel === 0
      const isItem = line.indentLevel === 1
      const isParent = isParentRow(lines, row)
      const theme = isSection ? SECTION_THEME : isItem ? ITEM_THEME : undefined

      switch (col) {
        case COL_REF:
          return {
            kind: GridCellKind.Text,
            data: line.itemRef,
            displayData: line.itemRef,
            allowOverlay: !line.isVariation,
            readonly: line.isVariation,
            themeOverride: theme,
          }

        case COL_DESC: {
          const descPrefix = line.indentLevel === 2 ? "└─ " : ""
          const hPad = line.indentLevel === 0 ? 10 : line.indentLevel === 1 ? 26 : 42
          return {
            kind: GridCellKind.Text,
            data: line.description,
            displayData: descPrefix + line.description,
            allowOverlay: !line.isVariation,
            readonly: line.isVariation,
            themeOverride: { ...(theme ?? {}), cellHorizontalPadding: hPad },
          }
        }

        case COL_VALUE: {
          const dv = displayValues[row]
          if (isParent) {
            return {
              kind: GridCellKind.Text,
              data: String(dv),
              displayData: `Σ £${fmt(dv)}`,
              allowOverlay: false,
              readonly: true,
              themeOverride: { ...(theme ?? {}), textDark: "#64748b" },
            }
          }
          return {
            kind: GridCellKind.Number,
            data: line.contractValue,
            displayData: `£${fmt(line.contractValue)}`,
            allowOverlay: !line.isVariation,
            readonly: line.isVariation,
            themeOverride: theme,
          }
        }

        default:
          return { kind: GridCellKind.Text, data: "", displayData: "", allowOverlay: false }
      }
    },
    [lines, displayValues]
  )

  // ── Cell edit ──────────────────────────────────────────────────────────────

  const onCellEdited = useCallback(
    ([col, row]: Item, newCell: EditableGridCell) => {
      const prev = linesRef.current
      const updated = prev.map((l, i) => {
        if (i !== row) return l
        if (col === COL_REF && newCell.kind === GridCellKind.Text) return { ...l, itemRef: newCell.data }
        if (col === COL_DESC && newCell.kind === GridCellKind.Text) return { ...l, description: newCell.data }
        if (col === COL_VALUE && newCell.kind === GridCellKind.Number) return { ...l, contractValue: newCell.data ?? 0 }
        return l
      })
      commit(updated)
    },
    [commit]
  )

  // ── Paste handler ──────────────────────────────────────────────────────────

  const onPaste = useCallback(
    (target: Item, values: readonly (readonly string[])[]): boolean => {
      const [targetCol, targetRow] = target
      const prev = linesRef.current
      const updated = [...prev]

      values.forEach((pasteRow, ri) => {
        const rowIdx = targetRow + ri
        const getCellStr = (colOffset: number) => pasteRow[colOffset]?.trim() ?? ""

        if (rowIdx < updated.length) {
          const existing = { ...updated[rowIdx] }
          if (targetCol === COL_REF) {
            if (pasteRow.length >= 3) {
              existing.itemRef = getCellStr(0)
              existing.description = getCellStr(1)
              existing.contractValue = parseFloat(getCellStr(2).replace(/[£,]/g, "")) || 0
            } else if (pasteRow.length === 2) {
              existing.itemRef = getCellStr(0)
              existing.description = getCellStr(1)
            } else {
              existing.itemRef = getCellStr(0)
            }
          } else if (targetCol === COL_DESC) {
            if (pasteRow.length >= 2) {
              existing.description = getCellStr(0)
              existing.contractValue = parseFloat(getCellStr(1).replace(/[£,]/g, "")) || 0
            } else {
              existing.description = getCellStr(0)
            }
          } else if (targetCol === COL_VALUE) {
            existing.contractValue = parseFloat(getCellStr(0).replace(/[£,]/g, "")) || 0
          }
          updated[rowIdx] = existing
        } else {
          const baseLevel = prev[prev.length - 1]?.indentLevel ?? 1
          let ref = "", desc = "", val = 0
          if (targetCol === COL_REF) {
            ref = pasteRow[0]?.trim() ?? ""
            desc = pasteRow[1]?.trim() ?? ""
            val = parseFloat((pasteRow[2] ?? "").replace(/[£,]/g, "")) || 0
          } else if (targetCol === COL_DESC) {
            desc = pasteRow[0]?.trim() ?? ""
            val = parseFloat((pasteRow[1] ?? "").replace(/[£,]/g, "")) || 0
          } else {
            val = parseFloat((pasteRow[0] ?? "").replace(/[£,]/g, "")) || 0
          }
          updated.push({
            id: null,
            sortOrder: updated.length,
            itemRef: ref,
            description: desc,
            contractValue: val,
            indentLevel: baseLevel,
            isVariation: false,
          })
        }
      })

      commit(updated)
      return true
    },
    [commit]
  )

  // ── Row operations ─────────────────────────────────────────────────────────

  function getSelectedRowIndex(): number {
    return selectedRowRef.current
  }

  const handleSelectionChange = useCallback((newSel: GridSelection) => {
    setSelection(newSel)
    if (newSel.rows.length > 0) {
      const last = newSel.rows.last()
      if (last !== undefined) selectedRowRef.current = last
    } else if (newSel.current) {
      selectedRowRef.current = newSel.current.cell[1]
    }
  }, [])

  function addRow(level: number) {
    const insertAfter = getSelectedRowIndex()
    const prev = linesRef.current
    const newLine: ScheduleLine = {
      id: null,
      sortOrder: insertAfter + 1,
      itemRef: "",
      description: "",
      contractValue: 0,
      indentLevel: level,
      isVariation: false,
    }
    commit([
      ...prev.slice(0, insertAfter + 1),
      newLine,
      ...prev.slice(insertAfter + 1),
    ])
  }

  function deleteSelectedRows() {
    if (selection.rows.length === 0 && !selection.current) {
      toast.error("Select a row first")
      return
    }
    const toDelete = new Set<number>()
    selection.rows.toArray().forEach((i) => toDelete.add(i))
    if (selection.current) toDelete.add(selection.current.cell[1])

    commit(linesRef.current.filter((l, i) => !toDelete.has(i) || l.isVariation))
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty() })
  }

  function indentRow(delta: 1 | -1) {
    const rowIdx = getSelectedRowIndex()
    const prev = linesRef.current
    const updated = prev.map((l, i) => {
      if (i !== rowIdx || l.isVariation) return l
      const newLevel = Math.max(0, Math.min(2, l.indentLevel + delta))
      return { ...l, indentLevel: newLevel }
    })
    commit(updated)
    // Explicitly damage the affected row and its neighbours so the canvas redraws
    // (indentation changes theme + auto-sum of parent rows above)
    const toDamage = new Set([rowIdx])
    if (rowIdx > 0) toDamage.add(rowIdx - 1)
    if (rowIdx < updated.length - 1) toDamage.add(rowIdx + 1)
    damageRows(...toDamage)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const gridHeight = Math.min(680, Math.max(240, lines.length * 34 + 36))

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-xs text-slate-400 font-medium mr-1">Add:</span>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addRow(0)}>
          <Plus className="w-3 h-3" />Section
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addRow(1)}>
          <Plus className="w-3 h-3" />Item
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => addRow(2)}>
          <Plus className="w-3 h-3" />Sub-item
        </Button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          onClick={() => indentRow(1)}
          title="Indent selected row"
          className="h-7 px-2 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />Indent
        </button>
        <button
          onClick={() => indentRow(-1)}
          title="Dedent selected row"
          className="h-7 px-2 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 flex items-center gap-1 text-xs transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />Dedent
        </button>

        <div className="w-px h-5 bg-slate-200 mx-1" />

        <button
          onClick={deleteSelectedRows}
          title="Delete selected row(s)"
          className="h-7 px-2 rounded border border-red-100 text-red-400 hover:text-red-600 hover:border-red-300 flex items-center gap-1 text-xs transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />Delete
        </button>

        <div className="flex-1" />

        <button
          onClick={() => exportCsv(lines, displayValues)}
          className="h-7 px-2 rounded border border-slate-200 text-slate-500 hover:text-indigo-600 flex items-center gap-1 text-xs transition-colors"
        >
          <Download className="w-3.5 h-3.5" />Export CSV
        </button>
      </div>

      {/* Grid */}
      <div className="rounded-lg border overflow-hidden shadow-sm">
        <DataEditor
          ref={gridRef}
          getCellContent={getCellContent}
          columns={COLUMNS}
          rows={lines.length}
          onCellEdited={onCellEdited}
          onPaste={onPaste}
          getCellsForSelection={true}
          width="100%"
          height={gridHeight}
          rowMarkers="clickable-number"
          gridSelection={selection}
          onGridSelectionChange={handleSelectionChange}
          freezeColumns={1}
          smoothScrollX
          smoothScrollY
          keybindings={{ downFill: true }}
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
            cellHorizontalPadding: 10,
          }}
          trailingRowOptions={{
            hint: "Add row...",
            sticky: false,
            tint: true,
          }}
          onRowAppended={() => addRow(linesRef.current[linesRef.current.length - 1]?.indentLevel ?? 1)}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          {saving && <span className="animate-pulse text-indigo-500">Saving…</span>}
          {!saving && lastSaved && (
            <span>Saved {lastSaved.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <span className="text-slate-300">
            <AlignLeft className="inline w-3 h-3 mr-1" />
            {lines.filter((l) => !l.isVariation).length} lines
          </span>
        </div>
        <div className="font-semibold text-slate-700 text-sm">
          Total: £{fmt(grandTotal)}
        </div>
      </div>

      <p className="text-xs text-slate-400">
        Paste from Excel (Ctrl+V / ⌘V). Click a row number to select it, then use Indent/Dedent to change level.
        Section headers auto-sum their children.
      </p>
    </div>
  )
}
