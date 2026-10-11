type Props = { status: string }

export function SyncStatusBadge({ status }: Props) {
  const styles: Record<string, string> = {
    NEVER_RUN: "bg-slate-100 text-slate-600",
    RUNNING: "bg-blue-100 text-blue-700",
    SUCCEEDED: "bg-green-100 text-green-700",
    FAILED: "bg-red-100 text-red-700",
  }
  const labels: Record<string, string> = {
    NEVER_RUN: "Never run",
    RUNNING: "Running",
    SUCCEEDED: "Synced",
    FAILED: "Failed",
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] ?? styles.NEVER_RUN}`}>
      {labels[status] ?? status}
    </span>
  )
}