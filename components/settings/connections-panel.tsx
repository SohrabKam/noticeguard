"use client"

import type { Connection, SyncLog } from "@/lib/generated/prisma/client"
import { AddConnectionForm } from "./add-connection-form"
import { SyncStatusBadge } from "./sync-status-badge"
import { useState } from "react"

const PROVIDER_NAMES: Record<string, string> = {
  IPLICIT: "iplicit",
  SAGE: "Sage",
  XERO: "Xero",
  QUICKBOOKS: "QuickBooks",
}

type Props = { connections: (Connection & { syncLogs: SyncLog[] })[] }

export function ConnectionsPanel({ connections }: Props) {
  const [busy, setBusy] = useState<string | null>(null)

  async function handleSync(formData: FormData) {
    const id = formData.get("id") as string
    setBusy(id)
    try {
      const { triggerManualSync } = await import("@/lib/actions/connections")
      await triggerManualSync(formData)
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(formData: FormData) {
    const id = formData.get("id") as string
    const conn = connections.find((c) => c.id === id)
    if (!conn || !confirm(`Remove connection "${conn.label}"?`)) return
    setBusy(id)
    try {
      const { deleteConnection } = await import("@/lib/actions/connections")
      await deleteConnection(formData)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <AddConnectionForm />
      {connections.length === 0 ? (
        <div className="rounded-lg border bg-white p-6 text-center text-slate-400 text-sm">
          No accounting systems connected yet. Add one above to start syncing data.
        </div>
      ) : (
        connections.map((conn) => {
          const lastLog = conn.syncLogs[0]
          const isBusy = busy === conn.id
          return (
            <div key={conn.id} className="rounded-lg border bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{conn.label}</h3>
                  <p className="text-xs text-slate-400">
                    {PROVIDER_NAMES[conn.provider] ?? conn.provider}
                  </p>
                </div>
                <SyncStatusBadge status={lastLog?.status ?? "NEVER_RUN"} />
              </div>

              {lastLog ? (
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>Last sync: {new Date(lastLog.startedAt).toLocaleString("en-GB")}</p>
                  {lastLog.status === "SUCCEEDED" && (
                    <p>{lastLog.recordsRead} read, {lastLog.recordsUpserted} upserted</p>
                  )}
                  {lastLog.status === "FAILED" && (
                    <p className="text-red-500">{lastLog.errorMessage}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">Never synced</p>
              )}

              <div className="flex gap-3">
                <form action={handleSync}>
                  <input type="hidden" name="id" value={conn.id} />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50"
                  >
                    Sync now
                  </button>
                </form>
                <form action={handleDelete}>
                  <input type="hidden" name="id" value={conn.id} />
                  <button
                    type="submit"
                    disabled={isBusy}
                    className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                  >
                    Remove
                  </button>
                </form>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}