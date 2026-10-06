// Drawdown (cash forecast) — pure calculation functions.
// Tier 1: even drawdown — remaining contract value ÷ remaining cycles.
// After each real assessment, the remaining forecast redistributes automatically.

import type { Assessment, RetentionLedger } from "@/lib/generated/prisma/client"

/** One row of the drawdown table — represents a single payment cycle's
 *  forecast or actual cash position. */
export interface DrawdownRow {
  cycleNumber: number
  /** When the payment is forecast or actually due */
  finalDateForPayment: Date
  /** Forecast gross for this cycle (before certification) */
  forecastGross: number
  /** Actual certified gross (null until assessment exists and is locked) */
  actualGross: number | null
  /** Forecast retention withheld this cycle */
  forecastRetention: number
  /** Actual retention withheld (null until assessment exists and is locked) */
  actualRetention: number | null
  /** Net cash that goes out: actual if locked, forecast otherwise */
  forecastNet: number
  actualNet: number | null
  /** Running cumulative net cash out (always computed, forecast + actual) */
  cumulativeNet: number
  /** Is this cycle already certified (assessment locked)? */
  isActual: boolean
  /** Cycle status for context */
  status: string
  /** Link to the cycle workspace */
  cycleId: string
}

/** Parameters for the drawdown calculation. */
export interface DrawdownParams {
  /** Total package (contract) value — sum of BOQ line totals */
  packageValue: number
  /** Retention percentage (e.g. 5 for 5%) */
  retentionPct: number
  /** Forecast profile for distribution */
  profile?: string // EVEN, FRONT_LOADED, S_CURVE, BACK_LOADED
  /** All payment cycles for this subcontract, ordered by cycle number,
   *  with their assessments (if any). */
  cycles: Array<{
    id: string
    cycleNumber: number
    status: string
    finalDateForPayment: Date
    assessment: Pick<Assessment, "isLocked" | "grossValuation" | "retentionAmount" | "netThisCycle"> | null
  }>
  /** Retention ledger for this subcontract (PC/MCD release dates + amounts) */
  retention: Pick<
    RetentionLedger,
    "totalHeld" | "pcReleaseDate" | "pcReleaseAmount" | "pcReleasedAt" | "mcdReleaseDate" | "mcdReleaseAmount" | "mcdReleasedAt"
  > | null
}

export interface DrawdownResult {
  rows: DrawdownRow[]
  summary: {
    packageValue: number
    certifiedToDate: number
    retentionHeld: number
    remainingCommitment: number
    remainingCycles: number
    pcReleaseDate: Date | null
    pcReleaseAmount: number | null
    mcdReleaseDate: Date | null
    mcdReleaseAmount: number | null
  }
}

const CYCLE_STATES_THAT_COUNT: ReadonlySet<string> = new Set([
  "AWAITING_APPLICATION",
  "APPLICATION_RECEIVED",
  "UNDER_ASSESSMENT",
  "NOTICE_SERVED",
  "PAY_LESS_SERVED",
  "PAID",
])

/**
 * Compute the per-cycle drawdown forecast for a subcontract.
 *
 * Tier-1 even drawdown: remaining package value ÷ remaining cycles.
 * Each locked assessment overrides its row with actual figures; after
 * each real assessment, the remaining forecast redistributes.
 */
export function computeDrawdown(params: DrawdownParams): DrawdownResult {
  const { packageValue, retentionPct, cycles, retention } = params

  // 1) Partition cycles: actual (locked assessment) vs forecast
  const actualCycles = cycles
    .filter((c) => c.assessment?.isLocked)
    .sort((a, b) => a.cycleNumber - b.cycleNumber)

  const forecastCycles = cycles
    .filter((c) => !c.assessment?.isLocked && CYCLE_STATES_THAT_COUNT.has(c.status))
    .sort((a, b) => a.cycleNumber - b.cycleNumber)

  // 2) Sum certified-to-date from locked assessments
  const certifiedToDate = actualCycles.reduce(
    (sum, c) => sum + Number(c.assessment!.netThisCycle),
    0,
  )

  // 3) Compute forecast per remaining cycle using the selected profile
  const remainingCommitment = Math.max(0, packageValue - certifiedToDate)
  const remainingCycles = forecastCycles.length
  const weights = profileWeights(params.profile ?? "EVEN", remainingCycles)
  const totalWeight = weights.reduce((s, w) => s + w, 0)
  const forecastValues = weights.map((w) =>
    remainingCycles > 0 ? (w / totalWeight) * remainingCommitment : 0,
  )

  // 4) Build rows — interleave actual and forecast in cycle-number order
  const allCycles = [...cycles].sort((a, b) => a.cycleNumber - b.cycleNumber)

  let cumulative = 0
  let forecastIdx = 0
  const rows: DrawdownRow[] = allCycles.map((c) => {
    const isActual = !!c.assessment?.isLocked
    const isForecast = !isActual && CYCLE_STATES_THAT_COUNT.has(c.status)
    const actualGross = isActual ? Number(c.assessment!.grossValuation) : null
    const actualRetention = isActual ? Number(c.assessment!.retentionAmount) : null
    const actualNet = isActual ? Number(c.assessment!.netThisCycle) : null

    const fv = isForecast ? forecastValues[forecastIdx++] ?? 0 : 0
    const forecastGross = isActual ? actualGross! : isForecast ? fv : 0
    const forecastRetention = isActual
      ? actualRetention!
      : isForecast ? fv * (retentionPct / 100) : 0
    const forecastNet = forecastGross - forecastRetention

    cumulative += isActual ? actualNet! : forecastNet

    return {
      cycleNumber: c.cycleNumber,
      finalDateForPayment: c.finalDateForPayment,
      forecastGross: round2(forecastGross),
      actualGross,
      forecastRetention: round2(forecastRetention),
      actualRetention,
      forecastNet: round2(forecastNet),
      actualNet,
      cumulativeNet: round2(cumulative),
      isActual,
      status: c.status,
      cycleId: c.id,
    }
  })

  // 5) Add retention release rows at the end
  const retentionHeld = retention ? Number(retention.totalHeld) : 0
  if (retention?.pcReleaseAmount && Number(retention.pcReleaseAmount) > 0) {
    const amt = Number(retention.pcReleaseAmount)
    cumulative -= amt
    rows.push({
      cycleNumber: -1, // sentinel: retention row
      finalDateForPayment: retention.pcReleaseDate!,
      forecastGross: -amt,
      actualGross: null,
      forecastRetention: 0,
      actualRetention: null,
      forecastNet: -amt,
      actualNet: null,
      cumulativeNet: round2(cumulative),
      isActual: !!retention.pcReleasedAt,
      status: "RETENTION_PC",
      cycleId: "",
    })
  }
  if (retention?.mcdReleaseAmount && Number(retention.mcdReleaseAmount) > 0) {
    const amt = Number(retention.mcdReleaseAmount)
    cumulative -= amt
    rows.push({
      cycleNumber: -2, // sentinel
      finalDateForPayment: retention.mcdReleaseDate!,
      forecastGross: -amt,
      actualGross: null,
      forecastRetention: 0,
      actualRetention: null,
      forecastNet: -amt,
      actualNet: null,
      cumulativeNet: round2(cumulative),
      isActual: !!retention.mcdReleasedAt,
      status: "RETENTION_MCD",
      cycleId: "",
    })
  }

  return {
    rows,
    summary: {
      packageValue: round2(packageValue),
      certifiedToDate: round2(certifiedToDate),
      retentionHeld: round2(retentionHeld),
      remainingCommitment: round2(remainingCommitment),
      remainingCycles,
      pcReleaseDate: retention?.pcReleaseDate ?? null,
      pcReleaseAmount: retention?.pcReleaseAmount ? Number(retention.pcReleaseAmount) : null,
      mcdReleaseDate: retention?.mcdReleaseDate ?? null,
      mcdReleaseAmount: retention?.mcdReleaseAmount ? Number(retention.mcdReleaseAmount) : null,
    },
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Generate weight distribution for N cycles based on forecast profile. */
export function profileWeights(profile: string, count: number): number[] {
  if (count <= 0) return []
  const weights: number[] = new Array(count).fill(1)

  switch (profile) {
    case "EVEN":
      return weights // all 1s → equal shares

    case "FRONT_LOADED": {
      // First third gets 50% of weight, decaying linearly
      for (let i = 0; i < count; i++) {
        const pos = i / count
        weights[i] = pos < 0.33 ? 2 - pos * 3 : Math.max(0.2, 1 - pos)
      }
      break
    }

    case "S_CURVE": {
      // Logistic S-curve: slow start, peak in middle, tail off
      for (let i = 0; i < count; i++) {
        const x = (i / (count - 1 || 1) - 0.5) * 8 // scale to [-4, 4]
        weights[i] = 1 / (1 + Math.exp(-x)) * (1 - 1 / (1 + Math.exp(-(x - 2)))) + 0.1
      }
      break
    }

    case "BACK_LOADED": {
      // Last third gets 50% of weight, increasing linearly
      for (let i = 0; i < count; i++) {
        const pos = i / count
        weights[i] = pos > 0.67 ? 0.5 + (pos - 0.67) * 4 : Math.max(0.2, pos + 0.2)
      }
      break
    }
  }

  return weights
}