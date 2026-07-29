"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { toast } from "sonner"
import { updateVariation } from "@/lib/actions/variations"
import { uploadDocument } from "@/lib/upload-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Paperclip, Pencil, X } from "lucide-react"

type Variation = {
  id: string
  orderId: string
  reference: string
  description: string
  status: string
  estimatedValue: number | string | null
  agreedValue: number | string | null
  notes: string | null
  attachmentUrls: string[]
}

export function EditVariationSheet({ variation }: { variation: Variation }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState(variation.status)
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(variation.attachmentUrls ?? [])
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { orgId, userId } = useAuth()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDocument(file, orgId ?? userId ?? "")
      setAttachmentUrls((prev) => [...prev, url])
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
      formData.set("status", status)
      formData.set("attachmentUrlsJson", JSON.stringify(attachmentUrls))
      await updateVariation(formData)
      toast.success("Variation updated")
      setOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) setAttachmentUrls(variation.attachmentUrls ?? [])
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-slate-400 hover:text-indigo-600 transition-colors"
        title="Edit variation"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit variation {variation.reference}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input type="hidden" name="variationId" value={variation.id} />
            <input type="hidden" name="orderId" value={variation.orderId} />

            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROPOSED">Proposed</SelectItem>
                  <SelectItem value="INSTRUCTED">Instructed</SelectItem>
                  <SelectItem value="AGREED">Agreed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Est. value (£)</Label>
                <Input
                  name="estimatedValue"
                  type="number"
                  step="0.01"
                  className="mt-1"
                  defaultValue={variation.estimatedValue ? Number(variation.estimatedValue) : ""}
                />
              </div>
              <div>
                <Label>Agreed value (£)</Label>
                <Input
                  name="agreedValue"
                  type="number"
                  step="0.01"
                  className="mt-1"
                  defaultValue={variation.agreedValue ? Number(variation.agreedValue) : ""}
                />
              </div>
            </div>

            <div>
              <Label>Notes</Label>
              <Input
                name="notes"
                className="mt-1"
                defaultValue={variation.notes ?? ""}
              />
            </div>

            <div>
              <Label>Attachments</Label>
              <div className="mt-1 space-y-1.5">
                {attachmentUrls.map((url, i) => {
                  const name = url.split("/").pop() ?? `File ${i + 1}`
                  // Only an attachment at its originally-saved index/value is
                  // fetchable via the download route today — anything added
                  // or reordered in this editing session isn't persisted yet.
                  const isSaved = variation.attachmentUrls[i] === url
                  return (
                    <div key={url} className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1.5 border">
                      <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                      {isSaved ? (
                        <a
                          href={`/api/variations/${variation.id}/attachments/${i}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-indigo-600 hover:underline"
                        >
                          {name}
                        </a>
                      ) : (
                        <span className="flex-1 truncate text-slate-500">{name} (save to view)</span>
                      )}
                      <button type="button" onClick={() => setAttachmentUrls((prev) => prev.filter((u) => u !== url))}>
                        <X className="w-3 h-3 text-slate-400 hover:text-red-500" />
                      </button>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  <Paperclip className="w-3 h-3" />
                  {uploading ? "Uploading…" : "Attach file"}
                </button>
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button type="submit" disabled={submitting || uploading} className="flex-1">
                {submitting ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
