import { describe, it, expect } from "vitest"
import { computeAssessmentTotals, computeAutoSums, computeApplicationTotal } from "./assessment-totals"

describe("computeAssessmentTotals", () => {
  it("excludes parent (section) rows from the sum, using auto-summed children instead", () => {
    // A section row (level 0) whose stored valueToDate is stale (left over
    // from assessment creation), with two child leaf rows (level 1) that
    // have since been edited to their real, current values.
    const lines = [
      { indentLevel: 0, valueToDate: 999, previouslyCertified: 0 }, // stale parent value — must be ignored
      { indentLevel: 1, valueToDate: 100, previouslyCertified: 20 },
      { indentLevel: 1, valueToDate: 150, previouslyCertified: 30 },
    ]
    const totals = computeAssessmentTotals(lines, 0.05)
    // Naively summing all rows (the bug) would give 999+100+150 = 1249.
    // Correct: only leaf rows, 100+150 = 250.
    expect(totals.gross).toBe(250)
    expect(totals.prev).toBe(50)
    expect(totals.retention).toBeCloseTo(12.5)
    expect(totals.net).toBeCloseTo(250 - 12.5 - 50)
  })

  it("handles a flat list with no parent rows", () => {
    const lines = [
      { indentLevel: 0, valueToDate: 100, previouslyCertified: 0 },
      { indentLevel: 0, valueToDate: 200, previouslyCertified: 0 },
    ]
    const totals = computeAssessmentTotals(lines, 0.05)
    expect(totals.gross).toBe(300)
  })

  it("auto-sums nested section/item/sub-item rows correctly", () => {
    const lines = [
      { indentLevel: 0, valueToDate: 0, previouslyCertified: 0 }, // section — auto-summed
      { indentLevel: 1, valueToDate: 0, previouslyCertified: 0 }, // item — auto-summed from sub-items
      { indentLevel: 2, valueToDate: 40, previouslyCertified: 0 },
      { indentLevel: 2, valueToDate: 60, previouslyCertified: 0 },
    ]
    const sums = computeAutoSums(lines)
    expect(sums[1]).toBe(100) // item = sum of its two sub-items
    expect(sums[0]).toBe(100) // section = sum of its one item (which is itself a sum)
    const totals = computeAssessmentTotals(lines, 0)
    expect(totals.gross).toBe(100) // only the two leaf sub-items counted
  })
})

describe("computeApplicationTotal", () => {
  it("excludes parent rows, same adjacency-sum rule as computeAssessmentTotals", () => {
    const lines = [
      { indentLevel: 0, valueToDateClaimed: 999 }, // stale/unused parent value — must be ignored
      { indentLevel: 1, valueToDateClaimed: 100 },
      { indentLevel: 1, valueToDateClaimed: 150 },
    ]
    expect(computeApplicationTotal(lines)).toBe(250)
  })

  it("returns 0 for an all-parent or empty line set", () => {
    expect(computeApplicationTotal([])).toBe(0)
  })
})
