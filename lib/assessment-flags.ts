// Assessment anomaly flags — deterministic rules engine.
// Pure function: no external dependencies, no DB calls, no LLM.
// Every flag is a comparison of numbers already in the system.
// Builds on the Final Research finding: "Start with deterministic/
// statistical anomaly detection — low-hallucination-risk, explainable."

export interface FlagLine {
  itemRef: string
  description: string
  contractValue: number
  valueToDate: number
  claimedValueToDate: number | null
  isVariation: boolean
  variationId: string | null
  indentLevel: number
}

/** One cycle's worth of assessment lines (for prior-cycle comparison). */
export interface PriorCycleLines {
  cycleNumber: number
  lines: FlagLine[]
}

export interface SiteReportLineSnapshot {
  itemRef: string
  pctComplete: number | null
}

export interface ApplicationLineSnapshot {
  itemRef: string
  valueToDateClaimed: number
}

export type FlagSeverity = "red" | "amber" | "yellow"

export interface AssessmentFlag {
  /** Stable identifier for this flag instance (line + rule combo) */
  id: string
  /** Which rule triggered */
  rule: "deviation_from_prior" | "exceeds_contract_rate" | "implausible_pct_jump" | "duplicate_claim" | "uncertified_variation"
  /** Human-readable rule name */
  ruleName: string
  severity: FlagSeverity
  /** The itemRef that triggered */
  itemRef: string
  /** The line description for context */
  description: string
  /** Deterministic plain-English explanation (template, not LLM) */
  message: string
  /** Indent level of the flagged line (for display context) */
  indentLevel: number
}

export interface FlagInput {
  /** Current assessment lines */
  lines: FlagLine[]
  /** Prior cycle's assessment (null if first cycle or no prior data) */
  priorCycle?: PriorCycleLines
  /** Site report lines for this cycle (null if no report submitted) */
  siteReportLines?: SiteReportLineSnapshot[]
  /** Application lines (what the subbie claimed) */
  applicationLines?: ApplicationLineSnapshot[]
  /** variationId → status map (for uncertified variation check) */
  variationStatuses?: Map<string, string>
}

const DEVIATION_THRESHOLD = 0.30
const IMPLAUSIBLE_SITE_MAX = 40
const IMPLAUSIBLE_CLAIM_MIN = 80
const DUPLICATE_TOLERANCE = 0.02 // within 2% of same value

/** Run all 5 rules against the assessment and return flagged lines. */
export function computeAssessmentFlags(input: FlagInput): AssessmentFlag[] {
  const flags: AssessmentFlag[] = []

  // Build lookup maps
  const priorMap = input.priorCycle
    ? new Map(input.priorCycle.lines.map((l) => [l.itemRef, l]))
    : null
  const siteMap = input.siteReportLines
    ? new Map(input.siteReportLines.map((l) => [l.itemRef, l]))
    : null
  const claimMap = input.applicationLines
    ? new Map(input.applicationLines.map((l) => [l.itemRef, l]))
    : null
  const variationStatuses = input.variationStatuses ?? new Map()

  for (const line of input.lines) {
    // Skip parent/section rows — only flag leaf items
    if (line.indentLevel <= 1) continue

    const ref = line.itemRef
    const id = (rule: string) => `${ref}-${rule}`

    // Rule 1 — Deviation from prior cycle
    const prior = priorMap?.get(ref)
    if (prior && prior.valueToDate > 0) {
      const change = Math.abs(line.valueToDate - prior.valueToDate) / prior.valueToDate
      if (change > DEVIATION_THRESHOLD) {
        const pctChange = Math.round(change * 100)
        const direction = line.valueToDate > prior.valueToDate ? "increased" : "decreased"
        flags.push({
          id: id("deviation_from_prior"),
          rule: "deviation_from_prior",
          ruleName: "Deviation from prior cycle",
          severity: "amber",
          itemRef: ref,
          description: line.description,
          message: `Line ${ref} — ${line.description}: certified value ${direction} from £${prior.valueToDate.toLocaleString("en-GB")} to £${line.valueToDate.toLocaleString("en-GB")} (${pctChange}% change from Cycle #${input.priorCycle!.cycleNumber}). Review before certifying.`,
          indentLevel: line.indentLevel,
        })
      }
    }

    // Rule 2 — Exceeds contract rate
    const claimed = claimMap?.get(ref)
    if (claimed && claimed.valueToDateClaimed > line.contractValue) {
      const excess = claimed.valueToDateClaimed - line.contractValue
      flags.push({
        id: id("exceeds_contract_rate"),
        rule: "exceeds_contract_rate",
        ruleName: "Exceeds contract rate",
        severity: "red",
        itemRef: ref,
        description: line.description,
        message: `Line ${ref} — ${line.description}: subcontractor claimed £${claimed.valueToDateClaimed.toLocaleString("en-GB")} which exceeds the contract value of £${line.contractValue.toLocaleString("en-GB")} by £${excess.toLocaleString("en-GB")}. This may be a variation not yet agreed, or an error in the claim.`,
        indentLevel: line.indentLevel,
      })
    }

    // Rule 3 — Implausible % jump (site vs claim mismatch)
    const site = siteMap?.get(ref)
    if (site && site.pctComplete !== null && claimed) {
      const sitePct = site.pctComplete
      // We have site-reported % and claimed value — but we don't have claimed %
      // directly. If line.claimedValueToDate exists, derive claimed % from it.
      const claimedPct = line.claimedValueToDate !== null
        ? (line.claimedValueToDate / line.contractValue) * 100
        : null
      if (claimedPct !== null && sitePct <= IMPLAUSIBLE_SITE_MAX && claimedPct >= IMPLAUSIBLE_CLAIM_MIN) {
        flags.push({
          id: id("implausible_pct_jump"),
          rule: "implausible_pct_jump",
          ruleName: "Site/claim mismatch",
          severity: "red",
          itemRef: ref,
          description: line.description,
          message: `Line ${ref} — ${line.description}: site reported ${sitePct}% physically complete, but the subcontractor claimed ${claimedPct.toFixed(0)}% (£${claimed.valueToDateClaimed.toLocaleString("en-GB")}). Investigate before certifying — this is a potential over-claim.`,
          indentLevel: line.indentLevel,
        })
      }
    }

    // Rule 4 — Duplicate claim
    if (prior && claimed && priorMap) {
      const priorClaimed = input.applicationLines?.find(l => l.itemRef === ref)
      // This is comparing current claimed vs prior claimed (not certified)
      // We don't have prior application lines directly in FlagInput, so
      // compare current claimed vs prior certified as a proxy
      if (prior.valueToDate > 0 && claimed.valueToDateClaimed > 0) {
        const ratio = Math.abs(claimed.valueToDateClaimed - prior.valueToDate) / prior.valueToDate
        if (ratio <= DUPLICATE_TOLERANCE) {
          flags.push({
            id: id("duplicate_claim"),
            rule: "duplicate_claim",
            ruleName: "Potential duplicate claim",
            severity: "amber",
            itemRef: ref,
            description: line.description,
            message: `Line ${ref} — ${line.description}: claimed value of £${claimed.valueToDateClaimed.toLocaleString("en-GB")} is nearly identical to the certified value from Cycle #${input.priorCycle!.cycleNumber} (£${prior.valueToDate.toLocaleString("en-GB")}). This may be a duplicate claim for work already certified.`,
            indentLevel: line.indentLevel,
          })
        }
      }
    }

    // Rule 5 — Uncertified variation
    if (line.isVariation && line.variationId) {
      const varStatus = variationStatuses.get(line.variationId)
      if (varStatus && varStatus !== "AGREED") {
        flags.push({
          id: id("uncertified_variation"),
          rule: "uncertified_variation",
          ruleName: "Uncertified variation",
          severity: "yellow",
          itemRef: ref,
          description: line.description,
          message: `Line ${ref} — ${line.description}: this is a variation line (status: ${varStatus.toLowerCase()}) that has not been formally agreed. Verify the variation is approved before certifying its value.`,
          indentLevel: line.indentLevel,
        })
      }
    }
  }

  return flags
}