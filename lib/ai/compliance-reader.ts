// Compliance document reader — LLM extraction of certificate fields
// (type, insured party, expiry date, policy number) from uploaded
// insurance certs, H&S policies, and CIS confirmations.
// Human must verify before saving. Uses LLM_MODEL_COMPLIANCE.

import { llmJson, type LlmMessage } from "@/lib/ai/llm-client"

export interface ComplianceExtraction {
  documentType: string | null // "Employers Liability", "Public Liability", "CIS", etc.
  insuredParty: string | null
  policyNumber: string | null
  issueDate: string | null // ISO date
  expiryDate: string | null // ISO date
  confidence: "HIGH" | "MEDIUM" | "LOW"
  reasoning: string
}

const COMPLIANCE_PROMPT: LlmMessage = {
  role: "system",
  content: `You read insurance certificates, H&S policies, and CIS confirmation documents for UK construction.
Extract the following fields from the document text. Return only valid JSON.

Fields (all nullable):
- documentType: "Employers Liability", "Public Liability", "Professional Indemnity", "CIS Confirmation", "H&S Policy", or "Other"
- insuredParty: the named insured company/person
- policyNumber: the certificate or policy reference number
- issueDate: ISO date (YYYY-MM-DD) the certificate was issued
- expiryDate: ISO date the coverage expires
- confidence: HIGH if all key fields found, MEDIUM if some missing, LOW if document is unclear
- reasoning: one sentence

If the document is not a compliance document, set documentType to "Other" and confidence to LOW.
Only return valid JSON. No markdown.`,
}

export async function extractComplianceFields(
  documentText: string,
): Promise<ComplianceExtraction> {
  const userMessage: LlmMessage = {
    role: "user",
    content: documentText.slice(0, 4000),
  }

  const { data } = await llmJson<ComplianceExtraction>(
    "compliance",
    [COMPLIANCE_PROMPT, userMessage],
    { temperature: 0.1, maxTokens: 500 },
  )

  return data ?? {
    documentType: null,
    insuredParty: null,
    policyNumber: null,
    issueDate: null,
    expiryDate: null,
    confidence: "LOW",
    reasoning: "Extraction failed — manual entry required.",
  }
}