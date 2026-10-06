import { describe, it, expect } from "vitest"
import { computeAssessmentFlags, type FlagLine, type PriorCycleLines } from "./assessment-flags"

function makeLine(overrides: Partial<FlagLine> = {}): FlagLine {
  return {
    itemRef: "B.2",
    description: "Bulk excavation",
    contractValue: 35000,
    valueToDate: 25000,
    claimedValueToDate: 28000,
    isVariation: false,
    variationId: null,
    indentLevel: 2,
    ...overrides,
  }
}

describe("computeAssessmentFlags", () => {
  describe("Rule 1 — Deviation from prior cycle", () => {
    it("flags when certified value deviates >30%", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ valueToDate: 35000 })],
        priorCycle: {
          cycleNumber: 3,
          lines: [makeLine({ valueToDate: 20000 })],
        },
      })
      expect(flags).toHaveLength(1)
      expect(flags[0].rule).toBe("deviation_from_prior")
      expect(flags[0].severity).toBe("amber")
      expect(flags[0].message).toContain("75% change")
    })

    it("does not flag when change is <=30%", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ valueToDate: 25000 })],
        priorCycle: {
          cycleNumber: 3,
          lines: [makeLine({ valueToDate: 20000 })],
        },
      })
      expect(flags).toHaveLength(0)
    })

    it("skips lines with zero prior value", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ valueToDate: 35000 })],
        priorCycle: {
          cycleNumber: 3,
          lines: [makeLine({ valueToDate: 0 })],
        },
      })
      expect(flags).toHaveLength(0)
    })
  })

  describe("Rule 2 — Exceeds contract rate", () => {
    it("flags when claimed exceeds contract value", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ contractValue: 35000 })],
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 42000 },
        ],
      })
      expect(flags).toHaveLength(1)
      expect(flags[0].rule).toBe("exceeds_contract_rate")
      expect(flags[0].severity).toBe("red")
      expect(flags[0].message).toContain("£7,000")
    })

    it("does not flag when claimed is within contract value", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ contractValue: 35000 })],
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 32000 },
        ],
      })
      expect(flags).toHaveLength(0)
    })
  })

  describe("Rule 3 — Implausible % jump (site vs claim)", () => {
    it("flags when site reports ≤40% but subbie claims ≥80%", () => {
      const flags = computeAssessmentFlags({
        lines: [
          makeLine({
            contractValue: 35000,
            claimedValueToDate: 31500, // 90% of contract
          }),
        ],
        siteReportLines: [
          { itemRef: "B.2", pctComplete: 30 },
        ],
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 31500 },
        ],
      })
      expect(flags).toHaveLength(1)
      expect(flags[0].rule).toBe("implausible_pct_jump")
      expect(flags[0].severity).toBe("red")
    })

    it("does not flag when site and claim are aligned", () => {
      const flags = computeAssessmentFlags({
        lines: [
          makeLine({
            contractValue: 35000,
            claimedValueToDate: 31500, // 90%
          }),
        ],
        siteReportLines: [
          { itemRef: "B.2", pctComplete: 85 },
        ],
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 31500 },
        ],
      })
      expect(flags).toHaveLength(0)
    })
  })

  describe("Rule 4 — Duplicate claim", () => {
    it("flags when claimed is nearly identical to prior certified", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ valueToDate: 25000 })],
        priorCycle: {
          cycleNumber: 3,
          lines: [makeLine({ valueToDate: 24800 })],
        },
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 24800 },
        ],
      })
      expect(flags).toHaveLength(1)
      expect(flags[0].rule).toBe("duplicate_claim")
    })

    it("does not flag when claimed is substantially different", () => {
      const flags = computeAssessmentFlags({
        lines: [makeLine({ valueToDate: 25000 })],
        priorCycle: {
          cycleNumber: 3,
          lines: [makeLine({ valueToDate: 24800 })],
        },
        applicationLines: [
          { itemRef: "B.2", valueToDateClaimed: 32000 },
        ],
      })
      const duplicateFlags = flags.filter((f) => f.rule === "duplicate_claim")
      expect(duplicateFlags).toHaveLength(0)
    })
  })

  describe("Rule 5 — Uncertified variation", () => {
    it("flags variation lines that are not AGREED", () => {
      const flags = computeAssessmentFlags({
        lines: [
          makeLine({
            itemRef: "VAR-001",
            description: "Additional drainage",
            isVariation: true,
            variationId: "var-1",
          }),
        ],
        variationStatuses: new Map([["var-1", "INSTRUCTED"]]),
      })
      expect(flags).toHaveLength(1)
      expect(flags[0].rule).toBe("uncertified_variation")
      expect(flags[0].severity).toBe("yellow")
      expect(flags[0].message).toContain("instructed")
    })

    it("does not flag AGREED variations", () => {
      const flags = computeAssessmentFlags({
        lines: [
          makeLine({
            itemRef: "VAR-001",
            description: "Additional drainage",
            isVariation: true,
            variationId: "var-1",
          }),
        ],
        variationStatuses: new Map([["var-1", "AGREED"]]),
      })
      expect(flags).toHaveLength(0)
    })
  })

  it("skips parent/section rows (indentLevel <= 1)", () => {
    const flags = computeAssessmentFlags({
      lines: [
        makeLine({ itemRef: "B", indentLevel: 0, valueToDate: 100000 }),
      ],
      priorCycle: {
        cycleNumber: 3,
        lines: [makeLine({ itemRef: "B", indentLevel: 0, valueToDate: 50000 })],
      },
    })
    expect(flags).toHaveLength(0)
  })

  it("can produce multiple flags on the same line", () => {
    const flags = computeAssessmentFlags({
      lines: [
        makeLine({
          contractValue: 35000,
          valueToDate: 32000,
          claimedValueToDate: 32000,
        }),
      ],
      priorCycle: {
        cycleNumber: 3,
        lines: [makeLine({ valueToDate: 20000 })],
      },
      applicationLines: [{ itemRef: "B.2", valueToDateClaimed: 42000 }],
    })
    // Should get both deviation (60% jump) and exceeds contract rate
    expect(flags.length).toBeGreaterThanOrEqual(2)
  })
})