# NoticeGuard — AI Feature Build Plan

*Synthesised from: ROADMAP.md, ai-research-evidence-review.md, Final Research (61 sources, independent validation).*

## Principles (locked)

1. **Rules first, LLM second.** Every feature ships deterministic first. LLMs are layered on only where they genuinely reduce friction, and always with human verification.
2. **Human-in-the-loop is not a fallback — it's the design.** No AI output drives a Payment Notice without a QS sign-off. Every AI-influenced assessment is logged in the audit trail with the named surveyor's decision recorded.
3. **RICS compliance is productised, not retrofitted.** The AI register, risk register, dip-sampling, and client disclosure are features our ICP *needs* — not bolt-ons.
4. **Ship small, demo often.** Each deliverable is 1–3 days. Each phase ends with a demo-ready checkpoint a QS would understand in 60 seconds.

---

## Phase 0 — RICS foundation (build first, before any AI ships)

> *"Firms must keep a written register of every AI system with material impact." — RICS standard, mandatory 9 March 2026*

This phase ships zero AI. It ships the compliance scaffold that makes every subsequent AI feature defensible. Without it, every AI feature is a liability. With it, every AI feature is a differentiator.

### M0.1 — AI systems register (1 day)

**What:** A new page at `/settings/ai-register` showing a table of all AI-influenced systems in use, pre-populated from the features we build.

**Deliverables:**
- `app/(app)/settings/ai-register/page.tsx` — server component listing systems
- `lib/ai-register.ts` — static registry of known systems (each feature registers itself)
- Each entry: name, purpose, first-used date, next review date, material-impact determination, named surveyor

**Acceptance criteria:**
- [x] Page renders at `/settings/ai-register`
- [x] Shows 0 systems when no AI features are enabled
- [x] Each system row shows: name, purpose, first-use, next review (auto-calculated)
- [x] RAG status per system (green = reviewed this quarter, amber = due this month, red = overdue)
- [x] Export as PDF/CSV (RICS auditor wants it offline)

### M0.2 — Risk register (1 day)

**What:** Same page, second tab. Risk register with RAG ratings, reviewed quarterly.

**Deliverables:**
- `components/settings/risk-register.tsx`
- Pre-populated template risks (hallucinated figures, stale training data, supplier compliance)
- Per-risk: description, likelihood, impact, RAG, mitigation, last review date

**Acceptance criteria:**
- [x] Tab renders "Risk register" alongside "AI systems"
- [x] 3–5 template risks pre-populated per org
- [x] Each risk has RAG rating + mitigation text
- [x] "Last reviewed" date tracks per risk

### M0.3 — Dip-sampling tool (1 day)

**What:** When assessment flags are triggered (Phase 1), a random sample of flagged assessments is surfaced for review. The named surveyor confirms or overrides each flag.

**Deliverables:**
- `app/(app)/settings/dip-sampling/page.tsx`
- Random sampling logic (configurable % — default 10%)
- Review UI: shows assessment, flags triggered, QS confirms/dismisses each
- Logs every review decision to audit trail

**Acceptance criteria:**
- [x] Page shows N randomly selected flagged assessments
- [x] QS can review each flag and select: "Confirmed — valid flag" / "Dismissed — false positive"
- [x] Decision logged to audit trail with named surveyor
- [x] Sample size configurable (5% / 10% / 20%)

### Phase 0 milestone: RICS-ready scaffold

> **Demo:** "Here's your AI systems register, your risk register, and your dip-sampling dashboard. Everything the RICS standard requires, pre-built. When we add AI features in Phase 1, they auto-register here."

---

## Phase 1 — Deterministic intelligence (no ML, high impact)

> *"Start with deterministic/statistical anomaly detection — this is low-hallucination-risk and explainable." — Final Research*

Every feature in this phase is pure math over existing data. No model training, no API calls, no hallucination risk. Just rules that a QS can inspect, understand, and override.

### M1.1 — Assessment anomaly flags (2 days) ⭐ highest demo value

**What:** When a QS opens an assessment, the system checks every line against 5 deterministic rules and surfaces flags as a dismissible banner.

**Rules:**

| # | Flag | Trigger | Severity |
|---|---|---|---|
| 1 | **Deviation from prior** | `valueToDate` changed >30% from last certified cycle | ⚠️ Amber |
| 2 | **Exceeds contract rate** | Claimed `valueToDateClaimed` > `contractValue` for this line | 🔴 Red |
| 3 | **Implausible % jump** | Site reported ≤40% but subbie claimed ≥80% on same line | 🔴 Red |
| 4 | **Duplicate claim** | Same `itemRef` claimed with near-identical `valueToDate` in consecutive cycles | ⚠️ Amber |
| 5 | **Uncertified variation** | Line marked `isVariation=true` but linked variation is not AGREED | 🟡 Yellow |

For each flag: a deterministic plain-English sentence (template, not LLM). Example: *"Line B.2 — Bulk excavation: certified value jumped from £18,000 to £32,000 (78% increase) from Cycle #3. Site reported 40% complete. Review before certifying."*

**Deliverables:**
- `lib/assessment-flags.ts` — pure function: `(assessment, priorAssessment, siteReport, application) → Flag[]`
- `components/cycles/assessment-flags-banner.tsx` — dismissible banner above the assessment grid
- Server action `dismissFlag(flagId, reason)` — logs to audit trail
- Integration into assessment workspace loader

**Acceptance criteria:**
- [x] Opening a cycle with triggered flags shows a banner: "3 assessment flags — review before certifying"
- [x] Each flag shows: rule name, severity colour, plain-English explanation, line reference
- [x] Flags auto-refresh when the grid is edited
- [x] QS can dismiss each flag with a reason: "Noted — certified as-is" / "Adjusted — see notes"
- [x] Dismissals logged to audit trail
- [x] Auto-registers in the AI systems register (Phase 0) on first deployment: "Assessment anomaly flags — deterministic rules engine"
- [x] Works with our existing 63-test suite (adds `lib/assessment-flags.test.ts`)

### M1.2 — Photo evidence integrity (1 day)

**What:** Extends the existing site report photo upload with integrity checks. The timestamp burning (already built) proves *when*. This adds *where* and *is it a duplicate*.

**Deliverables:**
- `lib/photo-integrity.ts` — EXIF GPS extraction, perceptual hash for duplicates
- On photo upload: extract GPS from EXIF, compute pHash, check against existing photos
- Flag if: GPS missing, GPS outside site geofence, or photo is a near-duplicate of another
- Add a "Integrity" badge to each photo: green checkmark or amber warning with tooltip

**Acceptance criteria:**
- [x] Photos uploaded to site reports show an integrity badge
- [x] GPS-present photos show "📍 Location verified" tooltip
- [x] GPS-missing photos show "⚠️ No location data" (amber, not blocking)
- [x] Near-duplicate photos flagged: "⚠️ Similar to photo uploaded at [time]"
- [x] Zero dependency on external AI APIs — pure EXIF parsing + image hashing

### M1.3 — Forecast profiles (1 day)

**What:** Extends the drawdown engine with trade/programme-linked profile templates. Research says learned per-sub curves need more data than any SME contractor has — so use standard profiles the QS picks at subcontract setup.

**Deliverables:**
- Add profile field to `PaymentSchedule`: `forecastProfile` enum (EVEN, FRONT_LOADED, S_CURVE, BACK_LOADED)
- `lib/drawdown.ts` — add profile redistribution logic (already has Tier-1 even; this is Tier-2)
- Profile selector in subcontract setup wizard
- Profile label on the drawdown tab (e.g. "S-Curve profile")
- Track forecast-vs-actual MAPE on the drawdown tab

**Acceptance criteria:**
- [x] New subcontract setup includes "Forecast profile" selector
- [x] Drawdown tab shows profile name + MAPE since last certified cycle
- [x] Even (default), Front-loaded, S-curve, and Back-loaded all produce different distributions
- [x] Changing profile recalculates forecast immediately
- [x] Unit tests for all 4 profile distributions

### Phase 1 milestone: intelligence without AI

> **Demo:** Open an assessment. The banner says "2 flags found." One line jumped 78% from last month. Site reported 40% but subbie claimed 95%. The QS adjusts and dismisses both flags. The dip-sampling tool will randomly pull this assessment for review next quarter. Every decision is logged. **No AI was used. No hallucination risk. Pure rules over live data.**

---

## Phase 2 — LLM-assisted workflows (human-verified, targeted)

> *"The places where an LLM genuinely earns its keep are at the edges: inbound email triage, reading compliance documents, contract setup with verification." — Final Research*

### M2.1 — Inbound email/attachment triage (3 days) 🥇 highest-value AI feature

**What:** When a subcontractor emails an application or compliance document to the inbound address, an LLM classifies it to the correct subcontract + cycle, extracts key fields as suggestions, and logs receipt time. A human always confirms before anything is filed.

**Why this is #1:** *"A missed application is the main smash-and-grab trigger."* If an application arrives by email and the QS doesn't notice, the clock keeps ticking toward a breached deadline with no application logged.

**Deliverables:**
- `lib/ai/email-triage.ts` — calls LLM with email body + attachment summary, returns structured classification
- `app/api/inbound/route.ts` — enhance existing inbound handler with triage step
- Dashboard banner: "1 unclassified inbound email — review"
- Triage review UI: shows email, suggested classification, QS confirms or corrects
- Logs receipt time immediately (before classification — the clock matters)

**LLM prompt design:**
```
Given this email from a subcontractor and the list of active subcontracts
for this organisation, classify:
1. Which subcontract reference does this relate to? (or null if unclear)
2. Is this an application for payment, a compliance document, or other?
3. If an application, which cycle number does it reference? (or null)
4. Confidence: HIGH / MEDIUM / LOW
5. Brief reasoning (one sentence)

Only return JSON. If confidence is LOW, the human must review.
```

**Acceptance criteria:**
- [x] Inbound email is received → receipt timestamp logged immediately
- [x] LLM classification runs async (Inngest job)
- [x] Dashboard shows "1 email awaiting classification" or "1 email classified — review"
- [x] QS sees: email preview, suggested subcontract + cycle, confidence level, LLM reasoning
- [x] QS can confirm ("File under Cycle #3") or correct ("No, this is Cycle #4")
- [x] On confirm: application is logged or compliance doc is attached
- [x] Classification decision logged to audit trail
- [x] Auto-registers in AI systems register: "Inbound email triage — LLM classification, human-verified"
- [x] Fails gracefully if LLM API is unavailable (falls back to manual triage, logs receipt time)

### M2.2 — Compliance document reading (2 days)

**What:** When a compliance document (insurance certificate, CIS confirmation, H&S policy) is uploaded, an LLM reads it and extracts: document type, insured party, expiry date, policy number. The QS confirms or corrects. Reduces the manual data-entry step and catches imminent expiries earlier.

**Deliverables:**
- `lib/ai/compliance-reader.ts` — LLM extraction from PDF/image compliance docs
- Integration into existing `UpsertDocSheet` component
- Pre-fills: document type, issue date, expiry date, insured party
- QS reviews pre-filled fields, edits if needed, confirms

**Acceptance criteria:**
- [x] Uploading an insurance certificate auto-fills: type="Employers Liability", expiry="01/03/2027"
- [x] QS can override any auto-filled field before saving
- [x] Extraction failures show "Could not read document — enter manually" (not an error)
- [x] Confidence shown next to each extracted field (HIGH/MEDIUM/LOW)
- [x] Auto-registers in AI systems register

### M2.3 — Payment notice basis of calculation (1 day)

**What:** When a Payment Notice or Pay Less Notice is about to be served, generate the "basis of calculation" text from the assessment grid data. Boilerplate paragraphs explaining how the sum was reached. QS reviews, edits if needed, signs off.

**Deliverables:**
- `lib/ai/basis-of-calculation.ts` — template engine (deterministic fill-in-the-gaps from assessment data)
- Optional LLM polish pass: "make this sentence more professional" (not changing figures)
- Integration into notice panel
- Preview + edit before serve

**Acceptance criteria:**
- [x] "Serve notice" screen shows pre-generated basis text
- [x] Text references actual figures from the assessment (gross, retention, net, cycle number)
- [x] QS can edit before serving
- [x] Served notice includes the final text in the frozen PDF/send
- [x] Template is deterministic; LLM polish is optional and marked as such

### Phase 2 milestone: AI as an assistant, not a decision-maker

> **Demo:** A subcontractor emails an application. The dashboard shows "1 email classified — Cycle #4, Apex Groundworks, HIGH confidence." The QS clicks, confirms, and the application is logged — receipt time already recorded, clock stopped. Later, they upload an insurance certificate — the expiry date auto-fills. They serve a Pay Less Notice and the basis-of-calculation paragraph is pre-written from the grid. **Every AI action has a human confirm step. Every decision is logged.**

---

## Phase 3 — Advanced (later, after pilot data)

### M3.1 — Contract clause extraction (3 days, needs test data)

LLM reads JCT/NEC/subcontract PDFs, extracts: payment mechanism, due dates, notice windows, retention %, CIS status. Human verifies. Flags non-standard clauses (pay-when-paid, onerous retention). Listed as #9 in research priority — lower urgency because it's one-off per subcontract.

### M3.2 — Natural-language portfolio query (2 days)

Read-only text-to-SQL: "Which subcontractors have overdue compliance docs?" → generates and shows the query + results. Research says this is low-risk because it's read-only and the query is shown to the user.

### M3.3 — PDF application extraction (3 days, needs real UK application samples)

Extract line items from subbie PDF applications. Research says accuracy on handwritten is unproven and our ~70% figure is from one vendor blog. **Only build if** you can validate against real UK subcontractor submissions and the accuracy is ≥85% after tuning. Listed as #10 — portal-first approach is preferred.

---

## Summary — build order

| Phase | When | Deliverables | Days | AI? |
|---|---|---|---|---|
| **0** | Now | RICS register, risk register, dip-sampling | 3 | No |
| **1** | Now | Anomaly flags, photo integrity, forecast profiles | 4 | No |
| **2** | After 0+1 | Email triage, compliance reader, basis-of-calculation | 6 | Yes (LLM, verified) |
| **3** | Later | Contract extraction, NL query, PDF extraction | 8 | Yes |

**Total: 21 days of build across 3 phases. First demo-ready checkpoint at Phase 0 + M1.1 (5 days).**

---

## Open questions for Sohrab

1. **LLM provider:** ~~Which LLM should we use for Phase 2?~~ → **Decided: OpenRouter gateway.** DeepSeek (cost-efficient, for dev/triage/classification), OpenAI GPT-4o (for production-critical: compliance doc reading, contract extraction). Model per feature configured via env var — swappable without code changes. Sohrab has an OpenRouter API key.

2. **Data consent:** ~~Do we need a consent checkbox?~~ → **Decided: yes.** Per-org consent toggle in Settings. Before any Phase 2 feature is enabled, the org admin must explicitly opt in with a checkbox confirming: "I consent to uploading subcontractor documents and application data to AI systems for classification and extraction. I understand that AI outputs are advisory and must be reviewed by a qualified surveyor before any figure drives a statutory notice."

3. **Companies House integration:** ~~Build now or defer?~~ → **Decided: build now in Phase 1.** Add M1.4 — Companies House insolvency watch. Deterministic API call to Companies House public register. Flag subcontractors with: active dissolution, overdue accounts, CCJs, or director disqualifications. Shown on subcontract detail page and dashboard alerts. Added to Phase 1 deliverables below.

## Phase 1 — updated with M1.4

### M1.4 — Companies House insolvency watch (1 day)

**What:** When a subcontractor is added or viewed, the system checks Companies House for risk indicators. Shown as a banner on the subcontract detail page and surfaced in the dashboard RAG view.

**Deliverables:**
- `lib/companies-house.ts` — calls Companies House public API (free, rate-limited to 600 req/5min)
- Stores: company status, last accounts date, any active CCJs or dissolution notices
- Cached for 24 hours (Companies House data doesn't change minute-to-minute)
- Subcontract detail page shows a banner: "⚠️ This subcontractor has overdue accounts" or "✅ Active — no warnings"

**Acceptance criteria:**
- [x] Adding a subcontractor with a valid company number fetches Companies House status
- [x] Subcontract detail page shows status banner (green/amber/red)
- [x] Dashboard includes "Subcontractor risk" in RAG summary
- [x] Cached — doesn't re-fetch on every page load
- [x] Graceful failure: if API is down, shows "Status unavailable" not an error