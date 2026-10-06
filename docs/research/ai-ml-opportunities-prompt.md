# NoticeGuard — AI/ML Opportunity Research Prompt

**Use this on:** LinkedIn (post), Reddit (`/r/ConstructionTech`, `/r/quantitysurveying`, `/r/MachineLearning`), UK construction forums, RICS Communities, CIOB forums. DMs to people building construction AI products.

---

## Title: Where would AI actually help in construction payment workflows? (Not the hype — the real thing)

I'm building a product that tracks subcontract payment cycles for UK main contractors — applications, certifications, statutory notices, drawdown forecasts, compliance docs. The core workflow is deterministic by design (dates, numbers, audit trails — you don't want an LLM guessing at a Pay Less Notice deadline).

But I keep running into places where the smart application of ML/AI feels like it would genuinely reduce the QS/commercial team's workload, and I want to separate what's real from what's vendor marketing.

**What the software already does (deterministically):**
- Tracks every subcontract payment cycle with bank-holiday-adjusted statutory deadlines
- Line-by-line assessment grid: subbie's claimed % vs. QS's certified %
- Site progress reports: site managers tap % complete per BOQ line from their phone, with timestamped photos
- Drawdown forecast: even-distribution with auto-redistribution after each certification
- Portfolio cash forecast: month-by-month rollup across all subcontracts
- Compliance doc tracking with expiry sweeps
- Append-only audit trail of every action

**Where I think AI/ML might fit (I want your honest take):**

**A — Assessment anomaly flags**
The QS certifies line-by-line against the subbie's claim. We already have: what the subbie claimed, what site reported, the prior cycle's certified figure, and the contract rate. Would a model that flags deviations — "line B.2 went from 60% to 95% in one cycle" or "this line exceeds the contract rate" — actually save a QS time, or would they notice those anyway? And would you trust an LLM-written explanation of *why* it flagged, or does that feel gimmicky?

**B — Cash forecast refinement**
Right now we do even-distribution: remaining contract value ÷ remaining cycles. It's simple and self-correcting. But construction spend follows S-curves — slow start, peak mid-project, tail-off. Would a model that learns each subcontractor's actual drawdown pattern and adjusts the forecast (or even just suggests an S-curve profile at setup) add value? Or is even-distribution "good enough" and the extra complexity isn't worth it?

**C — Subbie application extraction**
Subcontractors email in PDF applications. Some are clean valuation forms; many are handwritten, annotated, inconsistent. The research says extraction accuracy drops to ~70% on the handwritten mix. For a product where you CANNOT get a figure wrong (it goes into a statutory notice), is AI extraction "assistive with human review" actually useful, or does it just move the bottleneck from data entry to data checking?

**D — Contract clause extraction at setup**
When a QS sets up a new subcontract, they type in the payment terms: application due day, due date offset, notice windows, retention %. Could an LLM read the JCT/NEC/subcontract and extract those fields reliably? Would you trust it to also flag non-standard clauses — "this says pay-when-paid" or "retention is 0% below £100k then 3% after"? Or is extract-then-human-verify still the only safe path?

**E — Site photo analysis**
Site managers already submit progress photos with timestamps. Could computer vision say "this photo shows steel frame at ~70% erection" and cross-check against the claimed %? Or is that still OpenSpace/Buildots territory (360° capture + BIM) and unrealistic for a lightweight mobile tool?

**F — Smart deadline prediction**
We sweep all live cycles hourly and flag breached/approaching deadlines. Could a model predict *which* subcontractors are most likely to submit late, or which cycles are at highest risk of going to adjudication, based on historical patterns? Or is that solving a problem that doesn't exist because the deadline sweep already catches everything?

**G — What am I missing?**
Seriously — what repetitive, data-heavy, pattern-recognition task in the subbie payment workflow would you happily hand to an AI if it was provably reliable? And what would you NEVER hand over, no matter how good the model was?

---

**Ground rules for responses:**
- I'm not looking for "AI is the future" — I want war stories, specific workflows, and honest "that wouldn't help" signals
- If you've used a tool that claims AI in this space (Payapps, Causeway, C-Link, Buildots) and it was good/bad — name it
- DMs open if you'd rather talk privately

---

**Context — what I already know (so you don't waste time repeating it):**
- Document extraction: 95-99% on clean forms, ~70% on handwritten mix (construction-specific tests)
- Assessment AI in UK is nascent — most "AI" claims are automation/standardisation
- Forecasting: ML beats S-curve baselines in academic papers, but no UK construction-payment-specific validation
- Contract-review LLMs (Luminance, Robin AI, Spellbook) can extract payment terms, but all vendors say "first pass only"
- RICS AI standard is mandatory since March 2026 — named accountable surveyor, AI register, dip-sampling, client disclosure
- 45% of UK construction orgs report zero AI use; 1% have scaled it (RICS 2025)