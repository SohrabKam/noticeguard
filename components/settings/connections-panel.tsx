"use client"

import type { Connection, SyncLog } from "@/lib/generated/prisma/client"
import { AddConnectionForm } from "./add-connection-form"
import { SyncStatusBadge } from "./sync-status-badge"
import { useState } from "react"

type Props = { connections: (Connection & { syncLogs: SyncLog[] })[] }

export function ConnectionsPanel({ connections }: Props) {
  const [busy, setBusy] = useState<string | null>(null)

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
          return (
            <div key={conn.id} className="rounded-lg border bg-white p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{conn.label}</h3>
                  <p className="text-xs text-slate-400">{conn.provider}</p>
                </div>
                <SyncStatusBadge status={lastLog?.status ?? "NEVER_RUN"} />
              </div>
              {lastLog && (
                <div className="text-xs text-slate-500 space-y-0.5">
                  <p>Last synced: {new Date(lastLog.startedAt).toLocaleString("en-GB")}</p>
                  {lastLog.status === "SUCCEEDED" && (
                    <p>{lastLog.recordsRead} read, {lastLog.recordsUpserted} upserted</p>
                  )}
                  {lastLog.status === "FAILED" && (
                    <p className="text-red-500">{lastLog.errorMessage}</p>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}