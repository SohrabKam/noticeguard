# Site Report — Build Plan (Option B)

## The flow
1. QS opens a cycle → clicks "Generate site report link" → gets a shareable URL
2. Site manager opens URL on phone (no login) → sees the subcontract BOQ lines
3. Taps a % complete per line, adds notes, takes timestamped photos
4. Submits → QS sees "Site %" in the assessment grid alongside the subbie's claim

## Design decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Auth model | Unguessable token in URL, no login | Zero friction for site; link only shared with one person |
| Token expiry | Optional (default: none, but revocable) | Site managers are slow; don't expire mid-report |
| Scope | Per payment cycle (one report per assessment) | Matches "what's complete right now for this assessment" |
| Photo timestamp | Burn timestamp into image client-side + record in DB | Tamper-evident, self-evident, auditable |
| Line reference | Snapshot itemRef + description, matched to BOQ at read time | Stable even if assessment/BOQ changes |

## 1. Schema (new tables)

```
SiteReport {
  id           String   @id @default(cuid())
  paymentCycleId String  @unique          // one report per cycle
  token        String   @unique           // shareable secret
  createdById  String                     // the QS
  status       SiteReportStatus @default(OPEN)  // OPEN / SUBMITTED
  submittedAt  DateTime?
  createdAt    DateTime
}

SiteReportLine {
  id           String @id
  siteReportId String
  itemRef      String                     // snapshot of BOQ line ref
  description  String                     // snapshot
  sortOrder    Int
  indentLevel  Int
  contractValue Decimal                   // snapshot (context for site)
  pctComplete  Decimal?                   // what site reports
  note         String?
  photos       Json                       // array of {url, takenAt, exifTakenAt?}
  reportedAt   DateTime?
  updatedAt    DateTime
}
```

**No change to AssessmentLine** — site reports stay in their own tables; the QS grid reads site % by matching itemRef. Keeps the assessment engine untouched.

## 2. API endpoints

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/cycles/[id]/site-report` | Server action, COMMERCIAL | Generate token + empty report lines (snapshot BOQ) |
| `GET /api/site-report/[token]` | Public (token) | Load report + BOQ lines for the site manager |
| `POST /api/site-report/[token]` | Public (token) | Submit/update % + notes |
| `POST /api/site-report/[token]/photos` | Public (token) | Upload timestamped photo → Vercel Blob |
| `GET /api/site-report/[token]/submit` | Public (token) | Mark SUBMITTED (finalise) |

## 3. UI

### 3a. QS side — cycle page
- New "Site report" card/tab on the cycle page
- "Generate link" → shows URL + copy button + "expire/regenerate"
- Once submitted: shows site % per line, timestamped photos, submitted time

### 3b. Site manager side — `/site-report/[token]` (public, mobile-first)
- No app chrome — just a focused mobile page
- List of BOQ lines (indented, matching the assessment grid hierarchy)
- Each line: tap to set % (slider or big +/- buttons — gloves-friendly)
- Notes field per line
- Photo button → camera capture → timestamp burned in → thumbnail
- Big "Submit report" button at bottom
- After submit: confirmation screen

## 4. Photo timestamp implementation
- `input type="file" accept="image/*" capture="environment"` → native camera
- On file select: read EXIF `DateTimeOriginal` (via exifr or manual parse) → fallback `new Date()`
- Burn timestamp into bottom-right of image via `<canvas>` (draw photo + semi-transparent bar + "04 Oct 2026 14:32")
- Upload the burned image to Vercel Blob
- Record `{ url, takenAt, exifTakenAt }` in the line's photos array
- Display timestamp under each photo thumbnail in both site + QS views

## 5. Security
- Token: `crypto.randomBytes(24).toString('hex')` — 192 bits, unguessable
- Token never logged, never in client bundle beyond the page that needs it
- Report is read/write only via the token; no org data leaks through it (BOQ lines are already known to the site manager)
- Rate-limit optional later; not needed for 5 pilots

## 6. Build order
1. Prisma schema + migration
2. `lib/actions/site-report.ts` — generate, get, update, submit
3. Photo upload + timestamp-burning helper (`lib/site-photo.ts`)
4. Public `/site-report/[token]` page (mobile UI)
5. QS-side card on cycle page
6. Site % surfaced in assessment workspace (read-only column)
7. Tests (site-report actions, token auth, photo timestamp) + tsc + build

## Open questions for Sohrab
1. Photos: burn timestamp visibly into the image, or just record in metadata? (I recommend both — visible is more persuasive in a dispute)
2. Should the site manager be able to edit after submit? (I recommend: no — submitted is locked; the QS can regenerate a new link if needed)
3. One report per cycle, or a continuous rolling report per subcontract? (I recommend per-cycle for now — simpler, matches assessment cadence)
