"use client"

import { useState } from "react"
import { pushSubcontractToProvider } from "@/lib/actions/connections"

type Props = { orderId: string }

export function PushToIplicitButton({ orderId }: Props) {
  const [pushing, setPushing] = useState(false)
  const [result, setResult] = useState<{ ok?: boolean; error?: string; iplicitDocNo?: string } | null>(null)

  async function handlePush() {
    if (!confirm("Push this subcontract to iplicit as a Purchase Order?")) return
    setPushing(true)
    setResult(null)
    try {
      const r = await pushSubcontractToProvider(orderId)
      setResult(r as { ok?: boolean; error?: string; iplicitDocNo?: string })
    } finally {
      setPushing(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handlePush}
        disabled={pushing || result?.ok}
        className="text-xs font-medium px-3 py-1.5 rounded-md border border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50 disabled:opacity-50 transition-colors"
      >
        {pushing ? "Pushing…" : result?.ok ? `✓ Pushed (${result.iplicitDocNo})` : "Push to iplicit →"}
      </button>
      {result?.error && (
        <span className="text-xs text-red-500">{result.error}</span>
      )}
    </div>
  )
}