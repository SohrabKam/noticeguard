// AI systems register — static registry of every AI-influenced system
// in the product. Each Phase 1/2 feature registers itself here with
// a name, purpose, and first-use date. The RICS standard (mandatory
// 9 March 2026) requires a written register of every AI system with
// material impact, including its purpose, first-use date, and next
// review date.

export interface AiSystem {
  /** Stable identifier — used as the key in the register */
  id: string
  /** Human name shown in the register table */
  name: string
  /** What it does, in one sentence */
  purpose: string
  /** Whether it has "material impact" under the RICS standard */
  hasMaterialImpact: boolean
  /** When this feature first shipped (ISO date). The next-review date
   *  is auto-calculated as firstUsed + 3 months, resetting each time
   *  the named surveyor reviews it. */
  firstUsed: string
  /** Category for grouping in the register */
  category: "deterministic" | "llm-assisted" | "extraction"
  /** Which Phase introduced it */
  phase: string
  /** Has the named surveyor reviewed this system? */
  reviewed: boolean
  /** ISO date of last review (null if never reviewed) */
  lastReviewedAt: string | null
}

export const AI_SYSTEMS: AiSystem[] = [
  {
    id: "assessment-flags",
    name: "Assessment anomaly flags",
    purpose:
      "Deterministic rules that compare assessment lines against prior cycles, site-reported progress, contract rates, and variation status to flag potential anomalies before certification.",
    hasMaterialImpact: true,
    firstUsed: "2026-10-07",
    category: "deterministic",
    phase: "1",
    reviewed: false,
    lastReviewedAt: null,
  },
  {
    id: "photo-integrity",
    name: "Photo evidence integrity checks",
    purpose:
      "EXIF GPS extraction, perceptual hashing for duplicate detection, and timestamp validation on site progress photos to verify they were taken on site at the claimed time.",
    hasMaterialImpact: false,
    firstUsed: "2026-10-07",
    category: "deterministic",
    phase: "1",
    reviewed: false,
    lastReviewedAt: null,
  },
  {
    id: "forecast-profiles",
    name: "Drawdown forecast profiles",
    purpose:
      "Cash-out forecast profiles (even, front-loaded, S-curve, back-loaded) that predict remaining subcontract drawdown across future payment cycles. Tracks MAPE vs actual certified values.",
    hasMaterialImpact: false,
    firstUsed: "2026-10-07",
    category: "deterministic",
    phase: "1",
    reviewed: false,
    lastReviewedAt: null,
  },
  {
    id: "companies-house",
    name: "Companies House insolvency watch",
    purpose:
      "Checks the Companies House public register for dissolution notices, overdue accounts, CCJs, and director disqualifications for each subcontractor. Cached for 24 hours.",
    hasMaterialImpact: false,
    firstUsed: "2026-10-07",
    category: "deterministic",
    phase: "1",
    reviewed: false,
    lastReviewedAt: null,
  },
  // Phase 2 systems — register now, activate later
  {
    id: "email-triage",
    name: "Inbound email triage",
    purpose:
      "LLM classification of inbound subcontractor emails and attachments to the correct subcontract and payment cycle. Human must confirm before any application is logged.",
    hasMaterialImpact: true,
    firstUsed: "2026-10-07",
    category: "llm-assisted",
    phase: "2",
    reviewed: false,
    lastReviewedAt: null,
  },
  {
    id: "compliance-reader",
    name: "Compliance document reader",
    purpose:
      "LLM extraction of insurance certificate fields (document type, insured party, expiry date, policy number) to pre-fill compliance document records. Human must verify before saving.",
    hasMaterialImpact: true,
    firstUsed: "2026-10-07",
    category: "llm-assisted",
    phase: "2",
    reviewed: false,
    lastReviewedAt: null,
  },
  {
    id: "basis-of-calculation",
    name: "Payment notice basis of calculation",
    purpose:
      "Template-based generation of the 'basis of calculation' paragraph for statutory Payment and Pay Less Notices, populated from the assessment grid figures. Optional LLM polish pass for wording only.",
    hasMaterialImpact: true,
    firstUsed: "2026-10-07",
    category: "llm-assisted",
    phase: "2",
    reviewed: false,
    lastReviewedAt: null,
  },
]

/** Pre-populated risk register entries for the RICS standard. */
export interface AiRisk {
  id: string
  description: string
  likelihood: "LOW" | "MEDIUM" | "HIGH"
  impact: "LOW" | "MEDIUM" | "HIGH"
  mitigation: string
  lastReviewed: string | null
}

export const AI_RISKS: AiRisk[] = [
  {
    id: "hallucinated-figures",
    description: "LLM produces a plausible but fabricated figure that enters a statutory notice (Payment Notice or Pay Less Notice), causing over- or under-certification and potential smash-and-grab exposure.",
    likelihood: "LOW",
    impact: "HIGH",
    mitigation: "All AI-extracted figures require human verification before any statutory notice is served. Deterministic rules engine for calculations — no LLM produces a number, date, or sum. Per-field confidence scores route low-confidence extractions to mandatory review queues. Full audit trail.",
    lastReviewed: null,
  },
  {
    id: "stale-training-data",
    description: "LLM provider updates their model, silently changing extraction behaviour for previously-reliable document types. A field that was extracted correctly stops being extracted.",
    likelihood: "MEDIUM",
    impact: "MEDIUM",
    mitigation: "Golden document regression test set — a fixed set of anonymised documents run against the model after every provider update. Any field divergence triggers manual review before the new model processes live documents. Provider changelog monitoring.",
    lastReviewed: null,
  },
  {
    id: "supplier-compliance",
    description: "AI provider (OpenRouter/OpenAI) fails to meet RICS supplier due-diligence requirements for data handling, environmental impact reporting, or liability provisions.",
    likelihood: "LOW",
    impact: "MEDIUM",
    mitigation: "Written due-diligence request sent to provider covering: data processing location, training data provenance, GDPR compliance, environmental impact reporting, liability provisions. Reviewed annually. Provider SOC 2 / ISO 27001 certification tracked.",
    lastReviewed: null,
  },
  {
    id: "data-confidentiality",
    description: "Subcontractor applications and subcontracts contain commercially confidential data (rates, quantities, trade secrets). Uploading them to an AI provider without express consent violates the RICS standard's data governance requirement.",
    likelihood: "LOW",
    impact: "HIGH",
    mitigation: "Per-organisation AI data consent toggle (off by default). Admin must explicitly opt in with written confirmation. Data minimisation: only the specific fields needed for extraction are sent to the model, not entire documents where avoidable. All data sent via encrypted transport.",
    lastReviewed: null,
  },
  {
    id: "automation-bias",
    description: "QSs over-rely on AI-suggested classifications or extractions and stop independently verifying outputs, leading to undetected errors over time. Well-documented in aviation/medical literature (automation bias, complacency).",
    likelihood: "MEDIUM",
    impact: "HIGH",
    mitigation: "Mandatory human-in-the-loop for every AI output with material impact. Dip-sampling: random 10% of AI-assisted decisions reviewed by named surveyor quarterly. All AI suggestions are presented as 'suggested' not 'determined'. QS must actively confirm each one.",
    lastReviewed: null,
  },
]