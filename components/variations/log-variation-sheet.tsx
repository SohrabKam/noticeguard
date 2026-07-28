"use client"
import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createVariation } from "@/lib/actions/variations"
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
import { Paperclip, Plus, X } from "lucide-react"

export function LogVariationSheet({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState("PROPOSED")
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadDocument(file)
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
      await createVariation(formData)
      toast.success("Variation logged")
      setOpen(false)
      setAttachmentUrls([])
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log variation")
    } finally {
      setSubmitting(false)
    }
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) setAttachmentUrls([])
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Log variation
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Log variation</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input type="hidden" name="orderId" value={orderId} />

          <div>
            <Label>Reference</Label>
            <Input name="reference" required className="mt-1" placeholder="VO-001" />
          </div>

          <div>
            <Label>Description</Label>
            <Input name="description" required className="mt-1" placeholder="Additional excavation works" />
          </div>

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
              <Input name="estimatedValue" type="number" step="0.01" className="mt-1" placeholder="0" />
            </div>
            <div>
              <Label>Agreed value (£)</Label>
              <Input name="agreedValue" type="number" step="0.01" className="mt-1" placeholder="0" />
            </div>
          </div>

          <div>
            <Label>Instructed by</Label>
            <Input name="instructedBy" className="mt-1" placeholder="Architect / Engineer name" />
          </div>

          <div>
            <Label>Instruction date</Label>
            <Input name="instructionDate" type="date" className="mt-1" />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input name="notes" className="mt-1" placeholder="Any supporting detail…" />
          </div>

          <div>
            <Label>Attachments</Label>
            <div className="mt-1 space-y-1.5">
              {attachmentUrls.map((url, i) => {
                const name = url.split("/").pop() ?? `File ${i + 1}`
                return (
                  <div key={url} className="flex items-center gap-2 text-xs bg-slate-50 rounded px-2 py-1.5 border">
                    <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="flex-1 truncate text-slate-500">{name} (save to view)</span>
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
              {submitting ? "Saving…" : "Log variation"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
