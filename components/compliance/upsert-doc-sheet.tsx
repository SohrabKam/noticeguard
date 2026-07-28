"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { upsertComplianceDoc } from "@/lib/actions/compliance"
import { uploadDocument } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Plus, Pencil, Paperclip } from "lucide-react"

type ExistingDoc = {
  id: string
  documentType: string
  issueDate: Date | string | null
  expiryDate: Date | string | null
  notes: string | null
  fileUrl: string | null
}

const FALLBACK_DOC_TYPES = [
  "Employers Liability",
  "Public Liability",
  "Professional Indemnity",
  "H&S Policy",
  "CIS Confirmation",
  "RAMS",
  "ISO 9001",
  "ISO 14001",
]

export function UpsertDocSheet({
  subcontractorId,
  subcontractorName,
  existing,
  requiredDocTypes,
  prefillDocType,
}: {
  subcontractorId: string
  subcontractorName: string
  existing?: ExistingDoc
  requiredDocTypes?: string[]
  prefillDocType?: string
}) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [docType, setDocType] = useState(existing?.documentType ?? prefillDocType ?? "")
  const [fileUrl, setFileUrl] = useState(existing?.fileUrl ?? "")
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDocument(file)
      setFileUrl(url)
      toast.success("File uploaded")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      fd.set("documentType", docType)
      fd.set("fileUrl", fileUrl)
      await upsertComplianceDoc(fd)
      toast.success(existing ? "Document updated" : "Document added")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  const toDateInput = (d: Date | string | null) =>
    d ? new Date(d as string).toISOString().split("T")[0] : ""

  return (
    <>
      {existing ? (
        <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-indigo-600">
          <Pencil className="w-3.5 h-3.5" />
        </button>
      ) : prefillDocType ? (
        <button onClick={() => setOpen(true)} className="text-xs font-medium text-indigo-600 hover:underline">
          Add ↗
        </button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add document
        </Button>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{existing ? "Edit document" : `Add document — ${subcontractorName}`}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="subcontractorId" value={subcontractorId} />
            {existing && <input type="hidden" name="existingId" value={existing.id} />}

            <div>
              <Label>Document type</Label>
              <input
                list="doc-types"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                required
                placeholder="Select or type a document type"
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <datalist id="doc-types">
                {(requiredDocTypes && requiredDocTypes.length > 0 ? requiredDocTypes : FALLBACK_DOC_TYPES).map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Issue date</Label>
                <Input
                  name="issueDate"
                  type="date"
                  className="mt-1"
                  defaultValue={toDateInput(existing?.issueDate ?? null)}
                />
              </div>
              <div>
                <Label>Expiry date</Label>
                <Input
                  name="expiryDate"
                  type="date"
                  className="mt-1"
                  defaultValue={toDateInput(existing?.expiryDate ?? null)}
                />
              </div>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                name="notes"
                className="mt-1"
                defaultValue={existing?.notes ?? ""}
                placeholder="Policy number, insurer, etc."
              />
            </div>

            <div>
              <Label>Document file (optional)</Label>
              <div className="mt-1 space-y-2">
                {fileUrl ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Paperclip className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    {existing?.id && fileUrl === existing.fileUrl ? (
                      <a
                        href={`/api/compliance-documents/${existing.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline truncate flex-1"
                      >
                        Uploaded file
                      </a>
                    ) : (
                      <span className="text-slate-500 truncate flex-1">Uploaded file (save to view)</span>
                    )}
                    <button
                      type="button"
                      onClick={() => { setFileUrl(""); if (fileRef.current) fileRef.current.value = "" }}
                      className="text-slate-400 hover:text-red-500 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="text-sm text-slate-600 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                  />
                  {uploading && <span className="text-xs text-slate-400 animate-pulse">Uploading…</span>}
                </div>
                <p className="text-xs text-slate-400">PDF, image, or Word doc, max 20 MB.</p>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Status (Valid / Expiring Soon / Expired) is computed automatically from the expiry date.
            </p>

            <div className="flex gap-2 pt-1">
              <Button type="submit" disabled={submitting || uploading} className="flex-1">
                {submitting ? "Saving…" : existing ? "Save changes" : "Add document"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
