"use client"

import { useState } from "react"
import { pushSubcontractToProvider } from "@/lib/actions/connections"
import { Button } from "@/components/ui/button"

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
      <Button
        type="button"
        variant="outline"
        size="xs"
        onClick={handlePush}
        disabled={pushing || result?.ok === true}
      >
        {pushing ? "Pushing…" : result?.ok === true ? `✓ Pushed (${result.iplicitDocNo})` : "Push to iplicit →"}
      </Button>
      {result?.error && (
        <span className="text-xs text-red-500">{result.error}</span>
      )}
    </div>
  )
}