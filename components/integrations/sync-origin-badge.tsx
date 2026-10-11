const PROVIDER_LABELS: Record<string, string> = {
  IPLICIT: "iplicit",
  SAGE: "Sage",
  XERO: "Xero",
  QUICKBOOKS: "QuickBooks",
}

type Props = { id: string }

export function SyncOriginBadge({ id }: Props) {
  const match = id.match(/^ext_([A-Z]+)_/)
  if (!match) return null

  const provider = match[1]
  const label = PROVIDER_LABELS[provider] ?? provider

  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
      <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
        <path d="M5 3a1 1 0 0 0 0 2h.01a1 1 0 0 0 0-2H5ZM3 5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v.5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5Zm-2 3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V8Z" />
      </svg>
      {label}
    </span>
  )
}