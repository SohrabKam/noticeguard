// Shared totals logic for an assessment's line items. Section/item rows
// (indentLevel 0/1 that have children) are "parent" rows whose displayed
// value is the sum of their direct children, not their own stored
// `valueToDate` — that stored value is only ever set once at assessment
// creation and never updated when a child line is edited, so parent rows
// must be excluded from any sum over stored values, and use the live
// auto-summed figure instead. Lines must be pre-sorted by sortOrder — the
// parent/child relationship is derived purely from adjacency + indentLevel.

export type TotalLine = {
  indentLevel: number
  valueToDate: number
  previouslyCertified: number
}

export function isParentRow<T extends { indentLevel: number }>(lines: T[], index: number): boolean {
  const current = lines[index]
  if (!current) return false
  const next = lines[index + 1]
  return !!next && next.indentLevel > current.indentLevel
}

// Returns the auto-summed valueToDate for parent rows; leaf rows return
// their own stored value.
export function computeAutoSums<T extends { indentLevel: number; valueToDate: number }>(lines: T[]): number[] {
  const result = lines.map((l) => l.valueToDate)
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!isParentRow(lines, i)) continue
    const parentLevel = lines[i].indentLevel
    let sum = 0
    for (let j = i + 1; j < lines.length; j++) {
      const childLevel = lines[j].indentLevel
      if (childLevel <= parentLevel) break
      if (childLevel === parentLevel + 1) sum += result[j]
    }
    result[i] = sum
  }
  return result
}

export function computeAssessmentTotals(
  lines: TotalLine[],
  retentionPct: number
): { gross: number; retention: number; prev: number; net: number } {
  const autoSums = computeAutoSums(lines)
  const gross = lines.reduce((sum, l, i) => (isParentRow(lines, i) ? sum : sum + autoSums[i]), 0)
  const prev = lines.reduce((sum, l, i) => (isParentRow(lines, i) ? sum : sum + l.previouslyCertified), 0)
  const retention = gross * retentionPct
  const net = gross - retention - prev
  return { gross, retention, prev, net }
}

export type ApplicationTotalLine = {
  indentLevel: number
  valueToDateClaimed: number
}

// Same bottom-up parent/child summing as computeAssessmentTotals, but for an
// application's claimed figures — no retention/previously-certified/net
// concept at the claim stage, just the gross value claimed.
export function computeApplicationTotal(lines: ApplicationTotalLine[]): number {
  const asValueToDate = lines.map((l) => ({ indentLevel: l.indentLevel, valueToDate: l.valueToDateClaimed }))
  const autoSums = computeAutoSums(asValueToDate)
  return lines.reduce((sum, _l, i) => (isParentRow(asValueToDate, i) ? sum : sum + autoSums[i]), 0)
}
