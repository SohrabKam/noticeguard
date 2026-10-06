// Inbound email triage — LLM classification of subcontractor emails
// and attachments to the correct subcontract + cycle. Human must confirm.
// Uses the OpenRouter LLM client; model configured via LLM_MODEL_TRIAGE env.

import { llmJson, type LlmMessage } from "@/lib/ai/llm-client"

export interface TriageResult {
  subcontractRef: string | null
  cycleNumber: number | null
  documentType: "application" | "compliance_doc" | "variation" | "other"
  confidence: "HIGH" | "MEDIUM" | "LOW"
  reasoning: string
}

const TRIAGE_PROMPT: LlmMessage = {
  role: "system",
  content: `You are an email classifier for a UK construction payment platform called NoticeGuard.
Your job is to analyse an inbound email from a subcontractor and classify it.

Rules:
- subcontractRef: the subcontract reference number (e.g. "DEMO-SC-001") mentioned in the email, or null if unclear
- cycleNumber: the payment cycle number referenced, or null if unclear
- documentType: one of "application" (payment application/claim), "compliance_doc" (insurance, H&S, CIS), "variation" (change/variation), or "other"
- confidence: HIGH if clearly identifiable, MEDIUM if some ambiguity, LOW if very unclear
- reasoning: one sentence explaining your classification

Only return valid JSON. Do not include markdown code blocks or extra text.`,
}

export async function classifyInboundEmail(
  subject: string,
  body: string,
  attachmentFilenames: string[],
  activeSubcontracts: Array<{ reference: string; subcontractorName: string }>,
): Promise<TriageResult> {
  const userMessage: LlmMessage = {
    role: "user",
    content: `Subject: ${subject}

Body:
${body.slice(0, 3000)}

${attachmentFilenames.length > 0 ? `Attachments: ${attachmentFilenames.join(", ")}` : "No attachments"}

Active subcontracts for this organisation:
${activeSubcontracts.map((s) => `- ${s.reference}: ${s.subcontractorName}`).join("\n")}`,
  }

  const { data } = await llmJson<TriageResult>("triage", [TRIAGE_PROMPT, userMessage], {
    temperature: 0.1,
    maxTokens: 500,
  })

  return data ?? {
    subcontractRef: null,
    cycleNumber: null,
    documentType: "other",
    confidence: "LOW",
    reasoning: "LLM response could not be parsed — manual review required.",
  }
}