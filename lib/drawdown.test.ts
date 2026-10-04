import { describe, it, expect } from "vitest"
import { computeDrawdown } from "./drawdown"
import type { DrawdownParams } from "./drawdown"

function makeCycle(
  n: number,
  status: string,
  assessment?: { isLocked: boolean; gross: number; retention: number; net: number },
): DrawdownParams["cycles"][number] {
  return {
    id: `cycle-${n}`,
    cycleNumber: n,
    status,
    finalDateForPayment: new Date(`2026-0${n}-15`),
    assessment: assessment
      ? {
          isLocked: assessment.isLocked,
          grossValuation: assessment.gross as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
          retentionAmount: assessment.retention as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
          netThisCycle: assessment.net as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
        }
      : null,
  }
}

const params: DrawdownParams = {
  packageValue: 500000,
  retentionPct: 5,
  cycles: [
    makeCycle(1, "PAID", { isLocked: true, gross: 25000, retention: 1250, net: 23750 }),
    makeCycle(2, "NOTICE_SERVED", { isLocked: true, gross: 25000, retention: 1250, net: 23750 }),
    makeCycle(3, "UNDER_ASSESSMENT"),
    makeCycle(4, "AWAITING_APPLICATION"),
    makeCycle(5, "AWAITING_APPLICATION"),
    makeCycle(6, "AWAITING_APPLICATION"),
  ],
  retention: {
    totalHeld: 2500 as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
    pcReleaseDate: new Date("2027-01-01"),
    pcReleaseAmount: 12500 as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
    pcReleasedAt: null,
    mcdReleaseDate: new Date("2028-01-01"),
    mcdReleaseAmount: 12500 as unknown as import("@/lib/generated/prisma/client").Prisma.Decimal,
    mcdReleasedAt: null,
  },
}

describe("computeDrawdown", () => {
  it("correctly separates actual (locked) from forecast cycles", () => {
    const { rows } = computeDrawdown(params)
    const actual = rows.filter((r) => r.isActual && r.cycleNumber > 0)
    expect(actual).toHaveLength(2)
    expect(actual[0].cycleNumber).toBe(1)
    expect(actual[1].cycleNumber).toBe(2)
  })

  it("computes certified-to-date from locked assessments", () => {
    const { summary } = computeDrawdown(params)
    // 23750 + 23750 = 47500
    expect(summary.certifiedToDate).toBe(47500)
  })

  it("evenly distributes remaining commitment across forecast cycles", () => {
    const { rows, summary } = computeDrawdown(params)
    // 500000 - 47500 = 452500 remaining / 4 forecast cycles = 113125 per cycle
    expect(summary.remainingCommitment).toBe(452500)
    expect(summary.remainingCycles).toBe(4)

    const fc = rows.filter((r) => !r.isActual && r.cycleNumber > 0)
    expect(fc).toHaveLength(4)
    fc.forEach((row) => {
      // 113125 gross - 5% retention (5656.25) = 107468.75 net
      expect(row.forecastGross).toBe(113125)
      expect(row.forecastRetention).toBe(5656.25)
      expect(row.forecastNet).toBe(107468.75)
    })
  })

  it("actual rows use the real assessment figures", () => {
    const { rows } = computeDrawdown(params)
    const c1 = rows.find((r) => r.cycleNumber === 1)
    expect(c1?.actualGross).toBe(25000)
    expect(c1?.actualRetention).toBe(1250)
    expect(c1?.actualNet).toBe(23750)
    // forecast mirrors actual on locked cycles
    expect(c1?.forecastGross).toBe(25000)
  })

  it("computes running cumulative net correctly", () => {
    const { rows } = computeDrawdown(params)
    // cycle 1: 23750
    // cycle 2: 23750 → cumulative 47500
    // cycle 3: 107468.75 → cumulative 154968.75
    const c3 = rows.find((r) => r.cycleNumber === 3)
    expect(c3?.cumulativeNet).toBeCloseTo(154968.75, 1)

    // last forecast cycle
    const c6 = rows.find((r) => r.cycleNumber === 6)
    // 4 forecast cycles × 107468.75 + 2 actual × 23750 = 477375
    expect(c6?.cumulativeNet).toBeCloseTo(477375, 1)

    // After PC release (-12500): 477375 - 12500 = 464875
    const pc = rows.find((r) => r.status === "RETENTION_PC")
    expect(pc?.cumulativeNet).toBeCloseTo(464875, 1)
    expect(pc?.forecastNet).toBe(-12500)

    // After MCD release (-12500): 464875 - 12500 = 452375
    const mcd = rows.find((r) => r.status === "RETENTION_MCD")
    expect(mcd?.cumulativeNet).toBeCloseTo(452375, 1)
  })

  it("handles subcontract with zero cycles gracefully", () => {
    const { rows, summary } = computeDrawdown({
      packageValue: 100000,
      retentionPct: 5,
      cycles: [],
      retention: null,
    })
    expect(rows).toHaveLength(0)
    expect(summary.packageValue).toBe(100000)
    expect(summary.certifiedToDate).toBe(0)
    expect(summary.remainingCycles).toBe(0)
  })

  it("handles fully certified subcontract (no forecast cycles)", () => {
    const { rows, summary } = computeDrawdown({
      packageValue: 100000,
      retentionPct: 3,
      cycles: [
        makeCycle(1, "PAID", { isLocked: true, gross: 50000, retention: 1500, net: 48500 }),
        makeCycle(2, "PAID", { isLocked: true, gross: 50000, retention: 1500, net: 48500 }),
      ],
      retention: null,
    })
    expect(summary.certifiedToDate).toBe(97000)
    expect(summary.remainingCycles).toBe(0)
    expect(summary.remainingCommitment).toBe(3000)
    const nonRetentionRows = rows.filter((r) => r.cycleNumber > 0)
    expect(nonRetentionRows).toHaveLength(2)
    nonRetentionRows.forEach((r) => expect(r.isActual).toBe(true))
  })

  it("returns 0 forecast for expired/closed cycles", () => {
    const { rows } = computeDrawdown({
      packageValue: 200000,
      retentionPct: 5,
      cycles: [
        makeCycle(1, "PAID", { isLocked: true, gross: 25000, retention: 1250, net: 23750 }),
        makeCycle(2, "CLOSED"), // CLOSED is not in CYCLE_STATES_THAT_COUNT
        makeCycle(3, "AWAITING_APPLICATION"),
      ],
      retention: null,
    })
    // 200000 - 23750 = 176250 remaining / 1 forecast cycle = 176250
    const fc = rows.filter((r) => !r.isActual && r.cycleNumber > 0 && r.forecastGross > 0)
    expect(fc).toHaveLength(1)
    expect(fc[0].cycleNumber).toBe(3)
    expect(fc[0].forecastGross).toBe(176250)
    // Cycle 2 (CLOSED) should still appear as a row but with £0 forecast
    const c2 = rows.find((r) => r.cycleNumber === 2)
    expect(c2).toBeDefined()
    expect(c2?.forecastGross).toBe(0)
  })
})