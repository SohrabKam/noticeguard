import { requireOrg } from "@/lib/auth"
import { db } from "@/lib/db"
import { formatDate } from "@/lib/dates/uk-bank-holidays"
import { UpsertDocSheet } from "@/components/compliance/upsert-doc-sheet"

const STATUS_STYLES: Record<string, string> = {
  VALID: "bg-emerald-100 text-emerald-700",
  EXPIRING_SOON: "bg-amber-100 text-amber-700",
  EXPIRED: "bg-red-100 text-red-700",
  MISSING: "bg-slate-100 text-slate-500",
}

export default async function CompliancePage() {
  const { org } = await requireOrg()

  const [fullOrg, subcontractors] = await Promise.all([
    db.organisation.findUnique({ where: { id: org.id }, select: { requiredDocTypes: true } }),
    db.subcontractor.findMany({
      where: { organisationId: org.id },
      include: {
        complianceDocs: { orderBy: { documentType: "asc" } },
        subcontracts: { where: { isActive: true }, select: { reference: true } },
      },
      orderBy: { name: "asc" },
    }),
  ])

  const requiredDocTypes = fullOrg?.requiredDocTypes ?? []

  const all = subcontractors.flatMap((s) => s.complianceDocs)
  const expired = all.filter((d) => d.status === "EXPIRED").length
  const expiring = all.filter((d) => d.status === "EXPIRING_SOON").length

  // Count missing: required types not covered for any subcontractor
  const missing = subcontractors.reduce((sum, sub) => {
    const covered = new Set(sub.complianceDocs.map((d) => d.documentType))
    return sum + requiredDocTypes.filter((t) => !covered.has(t)).length
  }, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Compliance documents</h1>
        <p className="text-slate-500 text-sm mt-1">Insurance, H&S, and certification status for all subcontractors</p>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Expired</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{expired}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Expiring soon</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{expiring}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-slate-500">Missing (required)</p>
          <p className="text-2xl font-bold text-slate-500 mt-1">{missing}</p>
        </div>
      </div>

      {subcontractors.map((sub) => {
        const covered = new Set(sub.complianceDocs.map((d) => d.documentType))
        const missingTypes = requiredDocTypes.filter((t) => !covered.has(t))

        return (
          <div key={sub.id} className="rounded-lg border bg-white overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900">{sub.name}</span>
                {sub.subcontracts.length > 0 && (
                  <span className="ml-2 text-xs text-slate-400">
                    {sub.subcontracts.map((s) => s.reference).join(", ")}
                  </span>
                )}
              </div>
              <UpsertDocSheet
                subcontractorId={sub.id}
                subcontractorName={sub.name}
                requiredDocTypes={requiredDocTypes}
              />
            </div>

            {sub.complianceDocs.length === 0 && missingTypes.length === 0 ? (
              <div className="px-4 py-6 text-sm text-slate-400 text-center">
                No compliance documents recorded. Use &ldquo;Add document&rdquo; to get started.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Document type</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Issue date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Expiry date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">Notes</th>
                    <th className="text-left px-4 py-2.5 font-medium text-slate-600">File</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sub.complianceDocs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium">{doc.documentType}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {doc.issueDate ? formatDate(new Date(doc.issueDate)) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {doc.expiryDate ? formatDate(new Date(doc.expiryDate)) : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[doc.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {doc.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-400 text-xs max-w-xs truncate">
                        {doc.notes ?? "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        {doc.fileUrl ? (
                          <a
                            href={`/api/compliance-documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-indigo-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <UpsertDocSheet
                          subcontractorId={sub.id}
                          subcontractorName={sub.name}
                          requiredDocTypes={requiredDocTypes}
                          existing={{
                            id: doc.id,
                            documentType: doc.documentType,
                            issueDate: doc.issueDate,
                            expiryDate: doc.expiryDate,
                            notes: doc.notes,
                            fileUrl: doc.fileUrl,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                  {/* Missing required doc type placeholders */}
                  {missingTypes.map((t) => (
                    <tr key={`missing-${t}`} className="bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-400">{t}</td>
                      <td className="px-4 py-2.5 text-slate-300">—</td>
                      <td className="px-4 py-2.5 text-slate-300">—</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">
                          MISSING
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs">Required</td>
                      <td className="px-4 py-2.5 text-slate-300 text-xs">—</td>
                      <td className="px-4 py-2.5">
                        <UpsertDocSheet
                          subcontractorId={sub.id}
                          subcontractorName={sub.name}
                          requiredDocTypes={requiredDocTypes}
                          prefillDocType={t}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}

      {subcontractors.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-slate-200 py-16 text-center text-sm text-slate-400">
          No subcontractors yet. Add a subcontract to start tracking compliance documents.
        </div>
      )}
    </div>
  )
}
