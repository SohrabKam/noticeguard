# NoticeGuard — Honest Product & Market Assessment

*October 2026 · Prepared for Sohrab Kamkar*

## 1. The product — honest review

### What works (genuinely impressive for this stage)

**Core workflow is complete.** A QS can set up a subcontract, generate payment cycles with bank-holiday-adjusted deadlines, log and certify applications line-by-line, serve statutory notices, and view a full audit trail. This isn't a demo — it's functional.

**The site report feature is the differentiator.** No competitor has a zero-login, mobile-first, photo-timestamped site-to-office progress pipeline. A QS generates a link, the site manager opens it on their phone, taps %, takes photos. The QS sees site-reported progress alongside the subbie's claim. This maps directly to the pain point you described from your day job.

**The RICS compliance scaffold is a genuine moat.** Nobody in this competitive set ships an AI systems register, risk register, dip-sampling tool, and data consent toggle. The RICS standard (mandatory 9 March 2026) makes this a legal requirement for MRICS-regulated firms. You can lead every sales conversation with this.

**Cash forecast with profiles works.** Even/front-loaded/S-curve/back-loaded with auto-redistribution. The portfolio grid auto-detects schedule spans. Not revolutionary, but functional and demo-ready.

**AI features are designed conservatively — correctly.** Deterministic flags over LLM guesses. Human-in-the-loop everywhere. No hallucinated figures near statutory notices. The research validates this approach.

**Test coverage is decent for pre-launch.** 76 tests covering date engine, assessment totals, anomaly flags, drawdown, roles, compliance. Build passes. TypeScript strict.

### What's missing (honest gaps)

**Phase 2 AI features are libraries, not products.** The email triage, compliance reader, and basis-of-calculation generator exist as functions but aren't wired into any UI. No page or button calls them. They're technical assets, not usable features.

**Companies House integration is a library with no UI.** The code works but nothing in the app displays insolvency warnings.

**No real users have tested this.** Zero. Every bug, usability issue, and workflow gap is undiscovered. The first QS who opens it will find things you didn't anticipate.

**Self-serve onboarding is incomplete.** A new org sees an empty dashboard. The "Load sample data" button exists, but:
- New orgs need you to manually create a Clerk organisation and invite the user
- No self-serve signup flow
- Waitlist form isn't wired (needs your Web3Forms key)

**Mobile site report hasn't been tested by a site manager.** We designed it for gloves-friendly use, but a real site manager in a hard hat hasn't touched it.

**No pricing.** You need a number for pilot conversations. "Free for pilots, founding rate locked at £X/org/month."

**Key integrations are code-only:**
- Email triage isn't hooked into the inbound email endpoint
- Compliance reader isn't integrated into the document upload flow
- Basis-of-calculation isn't wired into the notice panel

**Team page may still have issues.** We added OrganizationSwitcher but haven't verified the fix on the deployed build.

### The build is ahead of most founder-led startups at this stage.

It is also a black box that no customer has opened.

---

## 2. The market — UK & Ireland house builders

### ICP (per your strategy docs, locked)

**Commercial Directors / Heads of Commercial at UK main contractors £10m–£250m turnover.** Regional house builders' contracting arms, general building contractors, large specialist subs acting as mains. Not Tier-1 nationals (ERP-locked, long sales cycles). Not subbie-only firms.

### Market structure

**UK house building:**
- ~2,500 active house builders in the UK (NHBC-registered)
- Top 10 build ~50% of homes (Barratt, Taylor Wimpey, Persimmon, Berkeley, Bellway, Redrow, Vistry, Keepmoat, Cala, Miller)
- Hundreds of regional builders (£10m–£250m) — your ICP sweet spot
- All use subcontractors extensively (groundworks, steel frame, M&E, cladding, roofing, plastering, etc.)
- The HGCRA payment regime applies to all of them

**Ireland:**
- Growing market, acute housing shortage (target: 50,000 homes/year)
- Similar legal framework (Construction Contracts Act 2013 — modelled on UK HGCRA)
- Smaller market but less competitive — fewer software vendors targeting it
- Major builders: Cairn Homes, Glenveagh, Ballymore, Ardstone

**What they all have in common:**
- Subcontractor payment applications arrive in inconsistent formats (PDFs, spreadsheets, emails)
- Payment notice deadlines are tracked in spreadsheets, Outlook, and memory
- Site-to-office progress communication is informal (WhatsApp, phone calls, site meetings)
- CVR packs consume 2–4 days/month
- Retention tracking is manual
- Nobody has a good answer to "did we serve that notice on time?"

### Why the timing might be right

1. **RICS AI standard (mandatory 9 March 2026)** — every MRICS-regulated firm now needs an AI register, risk register, and dip-sampling. You ship this pre-built. Nobody else does.

2. **Building Safety Act / regulatory pressure** — post-Grenfell, compliance documentation scrutiny is increasing. Subcontractor insurance, CIS status, and H&S policies need tracking. You ship this.

3. **Commercial Payments Bill** — currently in Parliament. If passed, it bans retentions and caps payment periods at 60 days. This directly impacts how main contractors manage subcontractor cash flow. Your drawdown forecast becomes essential.

4. **Economic pressure on house builders** — higher interest rates mean cash flow management is critical. The FD who sees a live cash-out forecast across all subcontracts is getting something their current spreadsheet can't provide.

### Why the timing might be wrong

1. **UK housing starts are declining** — planning delays, nutrient neutrality rules, and interest rates are suppressing new builds. Builders are cost-cutting, not buying new software.

2. **Construction software is notoriously slow to adopt** — RICS 2026 data shows embedded workflow AI is rare, and UK buyers are the most conservative region. The "spreadsheet works fine" objection is real.

3. **Incumbents have deep relationships** — COINS, Eque2, Causeway have been selling to this market for decades. They have integrations, references, and inertia on their side.

---

## 3. Should you push to get this out?

### Short answer: Yes, but the priority is pilots, not features.

You have enough product to show to a QS. The next 4 weeks should be about getting it in front of 3–5 real commercial people, watching them use it, and fixing what breaks. Not building Phase 3.

### The argument for going now

1. **The product is ahead of "I have an idea."** You have a working app with a real tech stack, test coverage, and a deployed instance. That's more than most founder pitches.

2. **The site report feature is genuinely unique.** It addresses a pain point you personally experienced. It's a 30-second demo: "QS generates a link, site manager taps % on their phone, QS sees it alongside the claim."

3. **The RICS angle is time-sensitive.** The standard took effect 9 March 2026. Every MRICS firm is now in breach if they use AI without a register. Your product solves this — and nobody markets it.

4. **The quiet pilot outreach strategy is the right one.** Warm DMs to ex-colleagues and industry contacts. Not cold LinkedIn posting. This is how B2B SaaS for a conservative industry gets first customers.

5. **AI makes you faster at building, not obsolete.** The product is deterministic where it matters (deadlines, figures, notices). AI enhances the edges (classification, extraction, explanation). That's the right architecture.

### The argument for waiting

1. **No user validation.** You haven't watched a QS use it. The first 30 minutes of real usage will surface bugs and workflow gaps you can't predict.

2. **Phase 2 features need wiring.** Email triage, compliance reader, and Companies House are code without UI. They're the features that would most impress a demo audience, but they're not demo-able yet.

3. **The landing page doesn't sell.** It's a placeholder. A Commercial Director who visits your site today sees nothing that makes them want to book a demo.

4. **You don't have a price.** Pilot conversations stall without a number. Even a rough one: "Founding rate £X/org/month, locked for life."

### Recommended next 4 weeks

| Week | Focus |
|---|---|
| **1** | Wire Phase 2 features into UI (email triage on dashboard, Companies House on subcontract page). Set up a proper demo environment with realistic data. Finalise a pricing number. |
| **2** | Get the product in front of 1–2 friendly QSs from your network. Silent observation — don't pitch, just watch them use it. Fix everything they trip over. |
| **3** | Iterate on feedback. Add a self-serve signup flow (or at minimum, a "Request access" button that emails you). Start the quiet DM outreach from `docs/quiet-pilot-outreach.md`. |
| **4** | Onboard 1–2 pilot customers with white-glove setup. Run the first real payment cycle end-to-end with a live subcontract. Document everything. |

---

## 4. SaaS viability in the "AI and death of SaaS" era

### The narrative

"AI agents will generate software on demand. Why pay £200/month for a SaaS tool when Claude can build a custom one in 20 minutes? Vertical SaaS is dead." — Every AI influencer, 2025–2026.

### Why this doesn't apply to NoticeGuard (yet)

**1. Statutory compliance requires determinism.** You cannot use an LLM to calculate a Pay Less Notice deadline. You cannot store audit trails in a chatbot's context window. AI agents are probabilistic — regulation is not.

**2. Multi-tenant data isolation is hard.** An AI-generated tool doesn't solve organization-scoped databases, Clerk auth, role enforcement, and audit-trail append-only writes. These are engineering problems, not prompt-engineering problems.

**3. Regulated industries move slowly.** The RICS standard requires a named accountable surveyor, written risk registers, supplier due diligence, and dip-sampling. An AI-generated tool has none of this. A QS who certifies a payment using an un-auditable, un-registered AI tool is in breach of their professional obligations.

**4. The data moat is real.** Once a contractor has 50 payment cycles, 10 subcontract orders, and 200 audit events in the system, the switching cost is enormous. The data IS the product. AI can replicate features; it cannot replicate 6 months of certified payment history.

**5. AI makes the product better, not obsolete.** The AI features you've built (anomaly flags, email triage, compliance reading) make the product more valuable — but they're enhancements to a deterministic core, not replacements for it.

### The real risk (honest)

The risk isn't "AI replaces my product." The risk is:

1. **Incumbents add AI features faster than you can sell.** Payapps (Autodesk, ~$390m acquisition), Causeway, and COINS have existing customer bases and engineering teams. If they add anomaly flags and RICS compliance, your differentiator shrinks.

2. **A horizontal AI agent gets good enough.** Not today, but 12–18 months out. If Claude/GPT can reliably: read a subcontract, extract payment terms, generate cycles, process applications, and serve notices — all with an audit trail — then a QS could theoretically replace their payment workflow with a prompt.

   Mitigation: the RICS standard won't let them. A named surveyor must sign off on AI outputs. The audit trail must be append-only and independently verifiable. A chatbot session is neither. But if AI agents become regulated-auditable, the risk is real.

3. **Commoditisation of features.** Every SaaS feature you build (drawdown grid, anomaly flags, site reports) is now replicable by a competitor with an LLM in hours instead of weeks. Your only durable advantages are: data moat, regulatory compliance, customer relationships, and domain depth.

### Your positioning against this

Lead every conversation with: *"We're not an AI tool. We're a compliance platform that uses AI at the edges. Every figure is deterministic. Every deadline is calculated, not generated. Every AI output is human-verified. And we're RICS-compliant by design."*

This is the opposite of the "AI-first" pitch that every competitor is making. In construction, caution IS the selling point.

---

## 5. Competitive landscape snapshot

| Competitor | What they do | Your edge |
|---|---|---|
| **Payapps (Autodesk)** | Application standardisation, self-assessment | UK-focused, RICS compliance, site-to-office, line-by-line detail |
| **Site Samurai** | Payment notices as a feature among many (£99–£699/mo) | Pure-play depth on payment compliance |
| **Construction AI** | Application tracking (~£130/mo) | Audit trail, deadline engine, forecast profiles |
| **Causeway** | AP fraud/anomaly flagging, ERP | You're faster, cheaper, focused on subcontract payments specifically |
| **COINS/Eque2** | Full ERP for Tier-1 contractors | You're for the mid-market that can't afford/doesn't want an ERP |
| **Spreadsheets** | Your real competitor | Ease of use, habit, zero cost → counter with: "Spreadsheets don't alert you when a deadline passes" |

---

## 6. Prompt for a research agent

If you want to validate this externally, give this to a research agent:

> **Prompt:** I'm building NoticeGuard, a SaaS platform for UK main contractors (£10m–£250m turnover, including regional house builders) that tracks subcontract payment cycles, statutory notices, and compliance documentation under the HGCRA 1996. Features include: line-by-line assessment grid, site-to-office progress reports (mobile, no-login), drawdown cash forecast with profiles, RICS-compliant AI governance (register, risk register, dip-sampling), and deterministic anomaly flags. I plan to target regional house builders in the UK and Ireland as my first customer base.
>
> I need an honest assessment of:
> 1. Is there genuine demand for subcontract payment compliance software among regional house builders, or do they already have this covered by ERP/existing tools?
> 2. How are UK house builders currently tracking HGCRA payment notice deadlines? Spreadsheets? ERP modules? Memory? What's the actual pain level?
> 3. Is the "site-to-office progress reporting" gap real? Do site managers and QSs actually want a mobile tool for this, or is the current informal process (WhatsApp, site meetings) considered adequate?
> 4. How does the Irish market compare? Is there a similar pain point under the Construction Contracts Act 2013?
> 5. What's the realistic price point for this kind of software in the UK construction market? What do Payapps, Site Samurai, and Construction AI actually charge?
> 6. In the current "AI and death of SaaS" narrative, is a vertical SaaS tool for construction payment compliance viable, or is this market about to be eaten by AI agents and horizontal platforms?
> 7. What are the top 3 objections I'll hear from Commercial Directors when I pitch this, and what's the best counter?
>
> Be brutally honest. Cite sources where possible. No vendor marketing claims without verification.

---

## Summary

**The product is ready to show to a QS. It is not ready to sell.**

Your next 2 weeks should be: wire the Phase 2 features into the UI, get a pricing number, put the product in front of 3–5 real commercial people from your network, and fix what they complain about.

**The SaaS death narrative is overblown for regulated industries.** Construction payment compliance sits at the intersection of regulation (RICS, HGCRA), liability (PI insurance, adjudication risk), and audit requirements — exactly where AI agents are weakest and deterministic platforms are strongest.

**Push to get this out. But push for pilots, not for launch.**