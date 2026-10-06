// OpenRouter LLM client — provider-agnostic via OpenRouter gateway.
// Supports DeepSeek (dev/cost-efficient), GPT-4o (production-critical),
// Claude, and any other model available through OpenRouter.
// Single API key, swappable per feature via env var.
//
// Auto-registers in the AI systems register on first use.

export type LlmModel = string // e.g. "deepseek/deepseek-chat" or "openai/gpt-4o"

export interface LlmMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface LlmResponse {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number }
  durationMs: number
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

function getApiKey(): string {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error("OPENROUTER_API_KEY is not configured")
  return key
}

function getModel(feature: string): LlmModel {
  const fallback = process.env.LLM_MODEL_DEFAULT ?? "deepseek/deepseek-chat"
  switch (feature) {
    case "triage":
      return process.env.LLM_MODEL_TRIAGE ?? fallback
    case "compliance":
      return process.env.LLM_MODEL_COMPLIANCE ?? fallback
    case "basis-of-calculation":
      return process.env.LLM_MODEL_BASIS ?? fallback
    case "extraction":
      return process.env.LLM_MODEL_EXTRACTION ?? "openai/gpt-4o"
    default:
      return fallback
  }
}

/**
 * Send a prompt to the LLM and get a response. Non-streaming.
 * Timeout at 30s. Returns structured response with token usage.
 */
export async function llmComplete(
  feature: string,
  messages: LlmMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<LlmResponse> {
  const key = getApiKey()
  const model = getModel(feature)
  const start = Date.now()

  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://builder-ops.vercel.app",
      "X-Title": "NoticeGuard",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts?.temperature ?? 0.1,
      max_tokens: opts?.maxTokens ?? 1024,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error")
    throw new Error(`LLM error (${res.status}): ${err.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>
    model: string
    usage?: { prompt_tokens: number; completion_tokens: number }
  }

  return {
    content: data.choices[0]?.message?.content ?? "",
    model: data.model ?? model,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
    },
    durationMs: Date.now() - start,
  }
}

/**
 * Send a prompt with a JSON schema expectation. Parses the response
 * as JSON, falling back to null on parse failure.
 */
export async function llmJson<T>(
  feature: string,
  messages: LlmMessage[],
  opts?: { temperature?: number; maxTokens?: number },
): Promise<{ data: T | null; response: LlmResponse }> {
  const response = await llmComplete(feature, messages, opts)

  // Try to extract JSON from the content (may be wrapped in markdown code blocks)
  let json = response.content.trim()
  const codeBlock = json.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (codeBlock) json = codeBlock[1]

  try {
    return { data: JSON.parse(json) as T, response }
  } catch {
    return { data: null, response }
  }
}

/**
 * Quick health check — validates the API key and model access.
 */
export async function llmHealthCheck(): Promise<{ ok: boolean; model: string; error?: string }> {
  try {
    const res = await llmComplete("default", [
      { role: "user", content: "Reply with just the word 'ok'." },
    ], { maxTokens: 10 })
    return { ok: true, model: res.model }
  } catch (err) {
    return { ok: false, model: "unknown", error: String(err) }
  }
}