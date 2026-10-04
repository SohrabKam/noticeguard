"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export function SeedDemoButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSeed() {
    if (!confirm("This will load sample projects, subcontractors, and payment cycles into your organisation. Any existing demo data will be replaced. Continue?")) return
    setLoading(true)
    try {
      const res = await fetch("/api/org/seed-demo", { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Seed failed" }))
        throw new Error(err.error ?? "Seed failed")
      }
      const data = await res.json()
      toast.success(`${data.projects} projects, ${data.subcontractors} subcontractors, ${data.orders} subcontract orders, ${data.cycles} payment cycles loaded`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sample data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSeed}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
    >
      {loading ? "Loading…" : "📦 Load sample data"}
    </button>
  )
}