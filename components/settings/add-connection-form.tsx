"use client"

import { useState } from "react"
import { createConnection, testConnection } from "@/lib/actions/connections"

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
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {open && (
        <form action={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Provider</label>
            <select name="provider" className="w-full text-sm border rounded-md px-3 py-2">
              {PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
            <input name="label" placeholder="Our iplicit account" className="w-full text-sm border rounded-md px-3 py-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Domain</label>
            <input name="domain" placeholder="sandbox.demo" className="w-full text-sm border rounded-md px-3 py-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input name="username" placeholder="api_user" className="w-full text-sm border rounded-md px-3 py-2" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">API Key</label>
            <input name="userApiKey" type="password" placeholder="••••••••" className="w-full text-sm border rounded-md px-3 py-2" required />
          </div>

          {testResult && (
            <div className={`text-xs px-3 py-2 rounded ${testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
              {testResult.ok ? "Connection successful" : testResult.error}
            </div>
          )}
          {error && <div className="text-xs px-3 py-2 rounded bg-red-50 text-red-700">{error}</div>}

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-500 hover:underline">
              Cancel
            </button>
            <button
              type="button"
              formAction={handleTest}
              disabled={testing}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}