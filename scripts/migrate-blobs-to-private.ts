// One-off migration for BG-5 (private document storage): every document
// uploaded before lib/upload-client.ts switched to access:"private" is still
// a world-readable public blob. This copies each one to a private blob,
// repoints the owning DB row at the new URL, and deletes the old public
// object — closing the exposure without losing any files.
//
// Usage:
//   npx tsx scripts/migrate-blobs-to-private.ts --dry-run   # preview only
//   npx tsx scripts/migrate-blobs-to-private.ts             # apply
//
// Requires DATABASE_URL and BLOB_READ_WRITE_TOKEN in the environment (the
// same ones the app itself uses).
import { PrismaClient } from "../lib/generated/prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { copy, del } from "@vercel/blob"

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL })
const db = new PrismaClient({ adapter })

const DRY_RUN = process.argv.includes("--dry-run")

// Only touch blobs actually stored in our own Vercel Blob store — never an
// arbitrary URL a v1 API caller supplied as compliance-document evidence.
function isOwnPublicBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".public.blob.vercel-storage.com")
  } catch {
    return false
  }
}

async function migrateUrl(url: string): Promise<string> {
  const pathname = new URL(url).pathname.replace(/^\//, "")
  if (DRY_RUN) {
    console.log(`  [dry-run] would copy ${pathname} to private and delete the public original`)
    return url
  }
  const result = await copy(url, pathname, { access: "private", allowOverwrite: true })
  await del(url)
  return result.url
}

async function main() {
  console.log(DRY_RUN ? "Dry run — no changes will be made.\n" : "Migrating public blobs to private storage...\n")

  let migrated = 0

  const docs = await db.complianceDocument.findMany({ where: { fileUrl: { not: null } } })
  for (const doc of docs) {
    if (!doc.fileUrl || !isOwnPublicBlobUrl(doc.fileUrl)) continue
    console.log(`compliance_documents.${doc.id}`)
    const newUrl = await migrateUrl(doc.fileUrl)
    if (!DRY_RUN) await db.complianceDocument.update({ where: { id: doc.id }, data: { fileUrl: newUrl } })
    migrated++
  }

  const applications = await db.application.findMany({ where: { attachmentUrl: { not: null } } })
  for (const application of applications) {
    if (!application.attachmentUrl || !isOwnPublicBlobUrl(application.attachmentUrl)) continue
    console.log(`applications.${application.id}`)
    const newUrl = await migrateUrl(application.attachmentUrl)
    if (!DRY_RUN) await db.application.update({ where: { id: application.id }, data: { attachmentUrl: newUrl } })
    migrated++
  }

  const variations = await db.variation.findMany({ where: { attachmentUrls: { isEmpty: false } } })
  for (const variation of variations) {
    const ownUrls = variation.attachmentUrls.filter(isOwnPublicBlobUrl)
    if (ownUrls.length === 0) continue
    console.log(`variations.${variation.id} (${ownUrls.length} attachment(s))`)
    const newUrls = await Promise.all(
      variation.attachmentUrls.map((url) => (isOwnPublicBlobUrl(url) ? migrateUrl(url) : url))
    )
    if (!DRY_RUN) await db.variation.update({ where: { id: variation.id }, data: { attachmentUrls: newUrls } })
    migrated += ownUrls.length
  }

  console.log(`\n${DRY_RUN ? "Would migrate" : "Migrated"} ${migrated} file(s).`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
