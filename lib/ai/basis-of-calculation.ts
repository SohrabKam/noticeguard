// Payment notice basis-of-calculation generator.
// Template-driven (deterministic fill-in-the-gaps from assessment data)
// with optional LLM polish pass for wording only — never changes figures.
// Uses LLM_MODEL_BASIS for the polish step.

import { llmComplete, type LlmMessage } from "@/lib/ai/llm-client"

export interface BasisInput {
  subcontractorName: string
  projectName: string
  cycleNumber: number
  grossValuation: number
  retentionAmount: number
  retentionPct: number
  previouslyCertified: number
  netThisCycle: number
  contractSum: number
  linesReported: number
  linesTotal: number
}

/**
 * Generate the basis-of-calculation text from assessment data.
 * Always returns a deterministic template; optional LLM polish
 * improves wording without changing figures.
 */
export function generateBasisText(input: BasisInput): string {
  return `Payment Notice served under section 110A of the Housing Grants, Construction and Regeneration Act 1996 (as amended).

Subcontract: ${input.subcontractorName}
Project: ${input.projectName}
Cycle number: ${input.cycleNumber}

The sum due is calculated as follows:

Gross valuation to date: £${input.grossValuation.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
Less retention at ${input.retentionPct}%: £${input.retentionAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
Less previously certified: £${input.previouslyCertified.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
Net due this cycle: £${input.netThisCycle.toLocaleString("en-GB", { minimumFractionDigits: 2 })}

The gross valuation is based on assessment of ${input.linesReported} out of ${input.linesTotal} activity schedule lines against the subcontractor's application for payment.

Contract sum: £${input.contractSum.toLocaleString("en-GB", { minimumFractionDigits: 2 })}.`
}

/**
 * Polish the basis text with an LLM for improved wording.
 * The LLM is instructed to NEVER change figures, dates, or names —
 * only improve sentence flow and professional tone.
 */
export async function polishBasisText(
  templateText: string,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are polishing the "basis of calculation" text for a UK construction Payment Notice under the HGCRA 1996.
This is a statutory document. You MUST NOT change any:
- Figures, amounts, or currency values
- Dates
- Names (subcontractor, project)
- Percentages
- Legal references (section numbers, Act names)

You MAY:
- Improve sentence flow and professional tone
- Fix grammar and punctuation
- Adjust paragraph breaks for readability

Return only the polished text. No commentary, no markdown.`,
    },
    { role: "user", content: templateText },
  ]

  try {
    const res = await llmComplete("basis-of-calculation", messages, {
      temperature: 0.3,
      maxTokens: 1024,
    })
    return res.content.trim()
  } catch {
    // If LLM is unavailable, return the deterministic template as-is
    return templateText
  }
}