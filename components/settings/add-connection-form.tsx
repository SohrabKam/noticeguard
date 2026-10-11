"use client"

import { useState } from "react"
import { createConnection, testConnection } from "@/lib/actions/connections"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const PROVIDERS = [{ value: "IPLICIT", label: "iplicit" }]

export function AddConnectionForm() {
  const [open, setOpen] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ ok?: boolean; error?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleTest(formData: FormData) {
    setTesting(true)
    setTestResult(null)
    try {
      const r = await testConnection(formData)
      setTestResult(r)
    } finally {
      setTesting(false)
    }
  }

  async function handleSave(formData: FormData) {
    setSaving(true)
    setError(null)
    try {
      const r = await createConnection(formData)
      if (r.error) setError(r.error)
      else {
        setOpen(false)
        setTestResult(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-900">Add connection</h2>
        {!open && (
          <Button variant="link" size="xs" onClick={() => setOpen(true)}>
            + Add
          </Button>
        )}
      </div>

      {open && (
        <form action={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <select
              name="provider"
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-label">Label</Label>
            <Input id="conn-label" name="label" placeholder="Our iplicit account" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-domain">Domain</Label>
            <Input id="conn-domain" name="domain" placeholder="sandbox.demo" required />
            <p className="text-[0.7rem] text-slate-400">Your iplicit environment domain (e.g. sandbox.demo)</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-username">Username</Label>
            <Input id="conn-username" name="username" placeholder="api_user" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conn-apikey">API Key</Label>
            <Input id="conn-apikey" name="userApiKey" type="password" placeholder="••••••••" required />
          </div>

          {testResult && (
            <div className={`text-xs px-3 py-2 rounded ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.ok ? "Connection successful" : testResult.error}
            </div>
          )}
          {error && <div className="text-xs px-3 py-2 rounded bg-red-50 text-red-700">{error}</div>}

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="xs" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="outline" size="xs" formAction={handleTest} disabled={testing}>
              {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button type="submit" size="xs" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}