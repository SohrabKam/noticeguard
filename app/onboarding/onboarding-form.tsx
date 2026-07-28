"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { completeOnboarding } from "./actions"

export function OnboardingForm({ email }: { email: string }) {
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      await completeOnboarding(fd)
      router.push("/dashboard")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Setup failed")
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border shadow-sm p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <Label>Company / organisation name</Label>
          <Input
            name="orgName"
            required
            className="mt-1"
            placeholder="Columbia Construction Ltd"
            defaultValue=""
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-1">
            Appears on payment notices and emails sent to subcontractors.
          </p>
        </div>

        <div>
          <Label>Notice sender name</Label>
          <Input
            name="fromName"
            className="mt-1"
            placeholder="Columbia Construction Ltd — Commercial Team"
            defaultValue=""
          />
          <p className="text-xs text-slate-400 mt-1">
            The display name on outgoing notice emails. Leave blank to use company name.
          </p>
        </div>

        <div>
          <Label>Notice sender email</Label>
          <Input
            name="fromEmail"
            type="email"
            className="mt-1"
            placeholder="notices@columbia.co.uk"
            defaultValue={email}
          />
          <p className="text-xs text-slate-400 mt-1">
            Must be a domain verified in Resend. Notices sent to subcontractors come from here.
          </p>
        </div>

        <div className="pt-1">
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Setting up…" : "Create organisation →"}
          </Button>
        </div>
      </form>

      <p className="text-xs text-center text-slate-400 mt-4">
        You can update these settings later from the Settings page.
      </p>
    </div>
  )
}
