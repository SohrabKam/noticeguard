// Schedule lines derived from variations (isVariation: true) are owned by the
// Variations flow (lib/actions/variations.ts) — they are created, valued, and
// removed there, never through schedule editing. This module is the single
// source of that immutability rule, enforced on every schedule-editing
// surface:
//   - lib/actions/schedule.ts                      (single-line edit/delete)
//   - app/api/subcontracts/[id]/schedule/route.ts  (bulk schedule replace)

export type ScheduleLineIdentity = { id: string; isVariation: boolean }

/**
 * Throws if the line is variation-derived; no-ops otherwise. `op` only words
 * the error, keeping the messages identical to the inline checks this helper
 * replaced ("Cannot edit/delete variation lines here").
 */
export function assertEditableScheduleLine(
  line: { isVariation: boolean },
  op: "edit" | "delete"
): void {
  if (line.isVariation) throw new Error(`Cannot ${op} variation lines here`)
}

/**
 * Splits a schedule's lines into variation-derived and editable id sets. The
 * bulk-replace route uses this to leave variation-derived lines untouched:
 * never deleted, and never overwritten by incoming client payloads.
 */
export function partitionVariationIds(lines: readonly ScheduleLineIdentity[]): {
  variationIds: Set<string>
  editableIds: Set<string>
} {
  const variationIds = new Set<string>()
  const editableIds = new Set<string>()
  for (const line of lines) {
    if (line.isVariation) variationIds.add(line.id)
    else editableIds.add(line.id)
  }
  return { variationIds, editableIds }
}
