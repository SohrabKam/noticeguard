"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { initApplication, updateApplication } from "@/lib/actions/assessments"
import { uploadDocument } from "@/lib/upload-client"
import { ApplicationWorkspace } from "@/components/cycles/application-workspace"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Paperclip, Pencil, X } from "lucide-react"

type ApplicationLine = {
  id: string
  sortOrder: number
  itemRef: string
  description: string
  contractValue: number | string
  isVariation: boolean
  indentLevel: number
  qtyOrPctClaimed: number | string | null
  valueToDateClaimed: number | string
  notes: string | null
}

type Application = {
  id: string
  amountApplied: number | string
  dateReceived: Date | string
  receivedVia: string | null
  notes: string | null
  attachmentUrl: string | null
  lines: ApplicationLine[]
}

export function ApplicationPanel({
  cycleId,
  application,
}: {
  cycleId: string
  application: Application | null
}) {
  const [submitting, setSubmitting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDocument(file)
      setAttachmentUrl(url)
      toast.success("File attached")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      if (attachmentUrl) formData.set("attachmentUrl", attachmentUrl)
      await initApplication(cycleId, formData)
      toast.success("Application logged — enter claimed values per line below")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log application")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!application) return
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      const url = attachmentUrl !== null ? attachmentUrl : application.attachmentUrl
      formData.set("attachmentUrl", url ?? "")
      await updateApplication(application.id, formData)
      toast.success("Application updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setSubmitting(false)
    }
  }

  const toDateInput = (d: Date | string) =>
    new Date(d as string).toISOString().split("T")[0]

  if (application && !editing) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="rounded-lg border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Application received</h3>
            <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-indigo-600">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Total claimed</span>
              <span className="font-medium">£{Number(application.amountApplied).toLocaleString("en-GB", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Date received</span>
              <span className="font-medium">
                {new Date(application.dateReceived as string).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {application.receivedVia && (
              <div className="flex justify-between">
                <span className="text-slate-500">Received via</span>
                <span className="font-medium capitalize">{application.receivedVia}</span>
              </div>
            )}
            {application.attachmentUrl && (
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Attachment</span>
                <a
                  href={`/api/applications/${application.id}/download`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-indigo-600 hover:underline text-xs font-medium"
                >
                  <Paperclip className="w-3 h-3" />
                  View document
                </a>
              </div>
            )}
            {application.notes && (
              <div className="border-t pt-2 mt-2">
                <p className="text-slate-500 text-xs">Notes</p>
                <p className="text-slate-700 mt-1">{application.notes}</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-2">Claimed against activity schedule</h4>
          <ApplicationWorkspace applicationId={application.id} lines={application.lines} />
        </div>
      </div>
    )
  }

  if (application && editing) {
    const currentUrl = attachmentUrl !== null ? attachmentUrl : application.attachmentUrl
    return (
      <div className="rounded-lg border bg-white p-6 max-w-md">
        <h3 className="font-semibold text-slate-900 mb-4">Edit application</h3>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div>
            <Label>Date received</Label>
            <Input
              name="dateReceived"
              type="date"
              required
              className="mt-1"
              defaultValue={toDateInput(application.dateReceived)}
            />
          </div>
          <div>
            <Label>Received via</Label>
            <select
              name="receivedVia"
              defaultValue={application.receivedVia ?? "email"}
              className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              <option value="email">Email</option>
              <option value="post">Post</option>
              <option value="hand">Hand delivery</option>
              <option value="portal">Online portal</option>
              <option value="manual">Manual entry</option>
            </select>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input name="notes" className="mt-1" defaultValue={application.notes ?? ""} />
          </div>
          <div>
            <Label>Attachment</Label>
            <div className="mt-1 space-y-1.5">
              {currentUrl ? (
                <div className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1.5 border">
                  <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-indigo-600 hover:underline">
                    {currentUrl.split("/").pop()}
                  </a>
                  <button type="button" onClick={() => setAttachmentUrl("")}>
                    <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Paperclip className="w-3 h-3" />
                  {uploading ? "Uploading…" : "Attach document"}
                </button>
              )}
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={submitting || uploading} className="flex-1">
              {submitting ? "Saving…" : "Save changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-white p-6 max-w-md">
      <h3 className="font-semibold text-slate-900 mb-4">Log application for payment</h3>
      <p className="text-xs text-slate-500 mb-4">
        Records the application&rsquo;s receipt — you&rsquo;ll enter the subcontractor&rsquo;s claimed value per line item next.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Date received</Label>
          <Input
            name="dateReceived"
            type="date"
            required
            className="mt-1"
            defaultValue={new Date().toISOString().split("T")[0]}
          />
        </div>
        <div>
          <Label>Received via</Label>
          <select
            name="receivedVia"
            defaultValue="email"
            className="mt-1 block w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            <option value="email">Email</option>
            <option value="post">Post</option>
            <option value="hand">Hand delivery</option>
            <option value="portal">Online portal</option>
            <option value="manual">Manual entry</option>
          </select>
        </div>
        <div>
          <Label>Notes (optional)</Label>
          <Input name="notes" className="mt-1" placeholder="Received by email from accounts@…" />
        </div>
        <div>
          <Label>Attachment (optional)</Label>
          <div className="mt-1 space-y-1.5">
            {attachmentUrl ? (
              <div className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1.5 border">
                <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                {application?.id && attachmentUrl === application.attachmentUrl ? (
                  <a
                    href={`/api/applications/${application.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 truncate text-indigo-600 hover:underline"
                  >
                    {attachmentUrl.split("/").pop()}
                  </a>
                ) : (
                  <span className="flex-1 truncate text-slate-500">{attachmentUrl.split("/").pop()} (save to view)</span>
                )}
                <button type="button" onClick={() => setAttachmentUrl(null)}>
                  <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <Paperclip className="w-3 h-3" />
                {uploading ? "Uploading…" : "Attach document"}
              </button>
            )}
            <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
          </div>
        </div>
        <Button type="submit" disabled={submitting || uploading} className="w-full">
          {submitting ? "Logging…" : "Log application"}
        </Button>
      </form>
    </div>
  )
}
