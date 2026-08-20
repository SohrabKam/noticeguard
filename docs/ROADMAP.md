# NoticeGuard — Product Roadmap (post-AI-research, integrated)
*Working doc · Aug 2026 · Owner: Sohrab*

## Positioning (locked)

**Wedge (one sentence):** NoticeGuard stops UK main contractors losing money to missed payment-notice deadlines — one late Pay Less Notice under HGCRA forces you to pay the subbie's full claimed amount.

**Second wedge (retention):** the subbie drawdown / cash-out forecast — what you owe, when, across every package. Compliance gets them in the door; the cash view is what they open every Monday.

**ICP (locked):** Commercial Directors / Heads of Commercial at UK main contractors £10m–£250m turnover (regional housebuilders' contracting arms, general building contractors, large specialist subs acting as mains). Cheque signed by FD/MD on commercial's recommendation. NOT Tier-1 nationals (ERP-locked), NOT small builders (won't pay), NOT subbie-only firms.

**Competitive frame:** Site Samurai (£99–£699/mo) and Construction AI (~£130/mo) cover notices as a *feature among many*. Our counter: pure-play depth — the whole product is the notice regime + the cash view, not a module. Every buyer conversation includes: "have you tried Site Samurai / Construction AI? What happened?"

**AI design rule (locked, from research):** AI flags, humans certify. Deterministic logic for anything that produces a number or a date. LLMs extract and explain, never decide. Every figure traceable to source. This is now also a *legal* requirement for our buyers (see RICS below).

---

## The four stages

### STAGE 1 — Now → pilot-ready (the compliance core is BUILT)
Status: sign-in live, onboarding works, isolation clean, 58/58 tests, seed data loaded. Remaining before pilots:

- [ ] **Wire waitlist form** (5 min: Web3Forms/Formspree endpoint → paste key → redeploy landing)
- [ ] **Pick landing variant** (4 variants built in /tmp/landing-variants — deploy winner to builder-ops.vercel.app)
- [ ] **Clerk dev-vs-prod decision** — dev instance OK for friendly pilots, NOT for public launch (orange badge)
- [ ] **Support email** on site + in app
- [ ] **Site Samurai trial teardown** (2 hrs, checklist below) — mandatory before more positioning work
- [ ] Rough pricing answer for pilot conversations: "free pilot, founding-member rate ~£X/org/month at launch, locked"

Site Samurai teardown checklist: single-portfolio deadline view? bank-holiday handling visible? served notices frozen + provable + append-only? clicks from signup to first-subcontract-tracked? → write up findings as LinkedIn content either way.

### STAGE 2 — Subbie drawdown / cash forecast + subbie portal (next build)
Spec exists: `docs/feature-spec-cash-forecast.md`. Data model already holds ~90% (cycle dates, assessments, RetentionLedger). Only gap = forecast amounts for future cycles.

1. Screen A: per-subcontract drawdown tab (Tier-1 even drawdown, auto-redistributing)
2. Screen B: portfolio month-by-month rollup (the FD view) + CSV export
3. **Subbie portal (from pain-points research):** free, no-login (or low-friction), NO per-claim fees, Excel-flexible (no "interlocks" rejecting legitimate inputs) — explicitly avoids the two Payapps resentments. Applications arrive assessment-ready: line-by-line against the BOQ + required backup.
4. Tier-2 S-curve profiles at subcontract setup
5. Tier-3 (later): learn per-subbie valuation drift — only once real pilot data exists. Publish our own MAPE vs S-curve baseline.
6. **Auto-CVR:** the 2–4 days/month CVR pain (Claire Hill: 3–4 days) falls out of the drawdown data — fold CVR generation into the rollup workstream.

### STAGE 3 — Assessment assistance as FLAGS (after drawdown)
From research: UK assessment AI is nascent; extraction breaks on handwriting (~70% real-world accuracy). Winning design = deterministic anomaly flags, LLM explains:

- Flag: line deviates from prior cycle beyond threshold
- Flag: line exceeds contract rate / claimed % implausible vs prior %
- Flag: duplicate claim detection
- Each flag: deterministic trigger + plain-English LLM explanation + QS override logged
- Never auto-populate assessed figures. Extraction assistive-only until ≥90% effective accuracy on real handwritten mix.
- Later: extract payment terms from subcontracts at setup (LLM extraction → structured fields → deterministic deadline calc). Flag onerous/non-standard clauses (pay-when-paid etc.)

### STAGE 4 — RICS-compliance-by-design (the moat, continuous)
RICS *Responsible use of AI in surveying practice* — mandatory 9 March 2026 for MRICS-regulated firms (= our ICP). Nobody in our competitive set markets to this. Productise it:

- AI systems register (purpose, first-use, review dates) — generated per org
- Named-approver sign-off on AI-influenced assessments
- Dip-sampling tooling for automated outputs
- Client-facing AI-use disclosure templates
- (This rides on the audit trail we already have)
- ⚠️ Before marketing "RICS-compliant": read the primary standard clause-by-clause (our knowledge is from law-firm briefings)

---

## GTM spine (LinkedIn-led, founder-led)

Playbook: `docs/linkedin-campaign.md` (12 posts drafted). Updates needed: retarget to Commercial Directors, add RICS angle, add drawdown build-in-public post, add teardown post, arm-the-champion line for FD sign-off.

Targets: 3–5 pilot orgs + 20–50 waitlist in 90 days. Pilots = white-glove (I set up first contract with each). Pilots also generate the metrics we publish (time-per-valuation, near-misses caught) — the only independent evidence in the category.

## Owed/cleanup (non-blocking)
Rotate 2 leaked sk_live keys · delete broken Clerk prod instance · Clerk support ticket · Vercel rename builder-ops→noticeguard · RESEND_WEBHOOK_SECRET · inngest keys · v1 API isolation pass (only pre-API-launch)

## Assets inventory
- `docs/` — strategy docs (TRACKED in git): ROADMAP.md (this doc), linkedin-campaign.md (v2, 16 posts), feature-spec-cash-forecast.md, landing-strategy.md
- `marketing-wip/` — landing components + static page + export script + reference reintegration files (gitignored)
- `/tmp/landing-variants/` — 4 landing variants (dark/editorial/vibrant/product-led), undeployed
- `docs/ai-research-evidence-review.md` — AI evidence review (the source of Stages 3–4)
- Live: noticeguard-landing.vercel.app (current quiet version) · builder-ops.vercel.app (app)
