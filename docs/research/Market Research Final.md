# NoticeGuard: An Honest Market Assessment for UK and Irish Subcontract Payment-Compliance Software (October 2026)

The pain is real, but it is narrower than the internal assessment assumes. Missed and invalid payment notices are the most common type of UK adjudication, so contractors do lose money this way. What the evidence does not support is regional house builders as the first segment, Ireland at launch, or RICS compliance as a sales lever. The best first segment is UK general building, fit-out and specialist contractors acting as mains, which run application-based JCT/NEC subcontracts on mid-market finance systems such as Sage, iplicit and Xero. Ireland should come later.

## TL;DR

- **Demand is real but contested.** Smash-and-grab (technical payment) adjudications were the most common claim type, cited by 63% of respondents to the 2024 King's College London / Adjudication Society survey, in a record year of 2,264 referrals. But Payapps (Autodesk), Eque2, COINS, Causeway, Site Samurai and Construction AI already sell notice-deadline tracking. You are entering a contested category, not an empty one.
- **Wrong beachhead, wrong timing for Ireland.** House builders mostly pay trades on house builder-led plot-stage measures, often via self-billing. Eque2 Housebuilding already ships a mobile plot-progress app linked to subcontractor payments.\[1\]\[2\] Ireland's statute doesn't spell out a default-payment consequence, and its adjudication volume is a small fraction of the UK's. Start with UK general contractors and specialists acting as mains. Ireland is Phase 2.
- **Price and risk.** Charge a founding pilot fee of about £250 per organisation per month, locked for 24 months. Standard pricing should be tiered by active subcontracts, at about £450–£1,500 per month with unlimited users. The biggest risks are a solo, part-time founder selling a deadline-critical tool, fast-moving incumbents and AI-built rivals, and over-reliance on RICS and retention features that won't drive purchases.

## Executive summary

**(i) Is demand real?** Yes, in the sense that the failure mode is common and expensive. The latest King's College London / Adjudication Society report (2024, described as the third and final in its series) recorded a record 2,264 referrals to participating nominating bodies between May 2023 and April 2024. The most common claim value was £125,000–£500,000. Smash-and-grab claims were the category respondents cited most often (63%). Half of respondents (50%) named inadequate contract administration as a leading cause of disputes.\[3\] What is not proven is that buyers will pay for a standalone tool rather than use the module already in their ERP or Payapps. Your one live prospect is encouraging, but it is a single data point. They also asked for variations, onboarding and cash-flow forecasting, which suggests notice deadlines alone may not be enough to justify a purchase.

**(ii) Right first segment?** No. Regional house builders are a weaker beachhead than general building, fit-out and M&E/civils/façade contractors acting as mains. The reasons are set out under F.

**(iii) Ireland now or later?** Later. The earlier "Phase 2" call was right and the newer "UK and Ireland first" proposal is wrong. Northern Ireland, which has its own HGCRA-equivalent Order that the new Bill also amends, is the sensible first step beyond Great Britain.

**(iv) Price.** Charge about £250 per month for the first 3–5 founding pilots, locked for 24 months, with white-glove onboarding. Then move to standard tiers by active subcontracts, roughly £450, £900 and £1,500 per month, with unlimited users and no charge to subcontractors.

**(v) Biggest risks.**
- **Founder capacity.** A part-time founder supporting a tool whose whole promise is "never miss a deadline".
- **Incumbent overlap.** Payapps, Eque2 and Causeway already sell much of this.
- **Collapsing build costs.** A single construction professional built a 22-module SME platform including payment applications in months using Claude Code.\[4\]
- **Regulatory churn.** Retention features will lose relevance as the retention ban phases in.

**(vi) Claims in the internal assessment that are wrong or overstated:**
- **A (RICS):** overstated to wrong.
- **B (Commercial Payments Bill):** broadly right on substance, but missing the stage and timing. It is not yet law, and the retention ban would bite only after a two-year transition.
- **C (market size):** outdated and partly wrong. The 2,500 figure is old SME data, and Redrow no longer exists as a separate builder.
- **D (housing starts):** wrong for 2025–26. Starts are rising from a low base.\[5\]
- **E (Ireland):** "modelled on HGCRA" overstates the similarity, and the default-payment consequence is materially weaker.
- **F (house builders as best segment):** overstated.
- **G ("no competitor has mobile site-to-office progress"):** wrong.
- **H (incumbents could add AI later):** understated. Causeway is already shipping AI in construction finance workflows.\[6\]\[7\]

## 1. Is there genuine demand among regional house builders?

There is genuine demand for payment-notice compliance among main contractors. Among regional house builders it is weaker, and partly covered already. The general case is strong. Payment-notice disputes dominate UK adjudication, and the courts keep punishing defective Pay Less Notices. In Advance JV v Enisca (TCC, 2022), an adjudicator ordered Advance to pay £2,717,992.88 because it did not issue a valid pay less notice against an interim application.\[8\] Cases like this make a Commercial Director sit up.

The house builder case is weaker for three reasons:
- **Payment model.** Many house builders pay trades on their own plot-stage valuations rather than on subcontractor applications. That shrinks the window for a default notice.
- **Existing tools.** House builder-specific ERPs already cover the workflow. Eque2's Housebuilding software targets builders of "50 units or more annually". Its Build module and Mobile Tick Sheets app let "surveyors and site managers … track on-site progress in real-time", providing "greater control of subcontractor payments".\[1\] Its Evision Housebuilding product runs separate subcontractor ledgers inside Microsoft Dynamics 365 Business Central.\[9\]
- **Buying mood.** The sector is cautious (see D).

My inference: a regional house builder already running COINS or Eque2 Housebuilding will see NoticeGuard as duplication unless it does something the ERP visibly does badly.

## 2. How are UK house builders tracking HGCRA deadlines today, and how painful is it?

There is no robust public dataset on this. Anyone who tells you otherwise is guessing. What can be said with evidence:
- **ERP modules.** These are mainstream at the larger end. Eque2's Evaluate "project valuation centre" tracks "valuations, applications, payment notices, payment due dates and pay less dates", and can issue a pay less notice from the system.\[10\] Construct for Sage captures "agreed payment terms against all contracts".\[11\] Payapps sells built-in reminders for "payment notice and pay less deadlines".\[12\]
- **Spreadsheets and calendars.** These remain common at smaller firms. Vendors keep framing their pitch as "Stop chasing payment notice deadlines on spreadsheets" (Site Samurai).\[13\] That is marketing, not measurement, but it is consistent with what practitioners say.
- **The underlying cause is administrative.** Half of the KCL respondents (50%) blamed inadequate contract administration for disputes, and 42% blamed a lack of competence among contract participants.\[3\]

I did not find usable first-hand forum evidence (Reddit, RICS community) on how house builders track deadlines. That gap matters. **Before writing more code, run 15–20 structured discovery calls.** Ask how notices were served on the last three valuation cycles, who owns the diary, and whether the firm has received a smash-and-grab claim in the last three years. Pain levels will be highest at firms that have recently lost an adjudication. Find those firms through construction solicitors and adjudicators in your network.

## 3. Is the site-to-office progress-reporting gap real?

The gap exists, but the claim that nobody fills it is false. Eque2's Mobile Tick Sheets app was built for exactly this. It lets on-site staff "track the progress of construction stages for each building plot" and update the back office directly. It has been marketed since at least 2018.\[2\] Construction AI sells dictated site diaries and inspections.\[14\] Site management apps such as Fieldwire and PlanRadar are widely used. I did not verify each tool on the brief's list (Procore, Sablono, Buildots, Contilio, Disperse, Zutec, Clixifix), so treat their coverage as unverified rather than absent.

What may be distinctive is the zero-login link that puts site-reported percentage complete next to the subcontractor's claim, line by line. That is a nice feature but a weak moat: it is easy to copy. It will also draw IT objections, because unauthenticated links handling commercial data are exactly what security questionnaires probe. Site managers' appetite for yet another tool is unproven. Expect adoption to depend on whether the QS can make it a 90-second task, not on the technology.

## 4. Ireland: is the pain comparable under the Construction Contracts Act 2013?

It is materially weaker today.
- **The statute.** Under section 4(3), the payer must respond to a payment claim notice within 21 days of the payment claim date.\[15\] As Irish commentators note, "in contrast to the UK adjudication regime, the Act does not set out the consequences of failing to deliver a response within the specified time period, nor does it say that in the absence of a response the amount set out in the payment claim notice is payable by default."\[16\]
- **Aakon Construction v Pure Fitout [2021] IEHC 562.** The High Court enforced an adjudicator's decision awarding a default payment for failure to respond. But the court said it was not concerned with whether that interpretation of the law was correct. It decided only whether skipping a "true value" assessment breached fair procedures.\[17\] The judgment also notes that the Irish payment-claim provisions "are materially different to those under the UK legislation".\[18\] So the smash-and-grab consequence in Ireland is an adjudicator-led practice that the court has tolerated, not settled law.
- **Later decisions.** In 2025 the High Court refused to enforce adjudicators' decisions for the first time, in Tenderbids v Electrical Waste Management [2025] IEHC 139 and Connaughton v Timber Frame Projects [2025] IEHC 469.\[19\] Enforcement is no longer a formality.
- **Volume.** The Eighth Annual Report of the adjudication panel chair (year to July 2024) recorded 101 applications and 93 appointments, with a total disputed value of €42.2m.\[20\] The official Ninth Annual Report by the chair, Bernard Gogarty (DETE, covering 26 July 2024 to 25 July 2025), records 85 applications, 79 adjudicator appointments and €31.5m in dispute. That is a fall of about 16% in applications, though the report notes it is still the second-highest year since the Act commenced in 2016. Compare 85–101 applications a year in Ireland, and a five-year disputed total of €223.7m, with 2,264 UK referrals in a single year. In Year 9, the most common pairing was a subcontractor in dispute with a main contractor: 26 of 59 adjudicator returns, about 44%.
- **Relevant Contracts Tax (RCT).** This is a separate, mandatory workflow. The principal contractor notifies Revenue of each payment through eRCT before paying and applies the deduction rate Revenue specifies. A product built around UK CIS assumptions will need real rework.

Verdict: the Irish pain point is genuine but smaller, less legally certain and operationally different. Ireland is Phase 2.

## 5. Realistic price points, and what competitors actually charge

| Product | What it is | Verified pricing | Source quality |
|---|---|---|---|
| Payapps (Autodesk) | Application-for-payment and certification platform; reminders for payment notice and pay less deadlines; compliance documents; UK and Ireland\[21\] | Main contractors: custom plan, "a fixed annual fee… add users at no extra cost". Subcontractors: £32/month (1 contract), £85 (5), £140 (10), £270 (unlimited), or £35 per application\[22\]\[23\] | Official pricing pages |
| Site Samurai | UK SME all-in-one: applications for payment, s.111 pay less notices, CIS, RAMS, fleet\[24\]\[25\] | £99 / £199 / £699 per month (or £83 / £166 per month billed annually), unlimited users, 14-day trial\[26\] | Official pricing page; customer base unverified |
| Construction AI (constructionai.io) | SME back-office platform built by an MCIOB contractor using Claude Code: tenders, programmes, RAMS, payment applications and notices, CVR, AI agent\[4\]\[14\] | Conflicting: "£100 a month per seat" (Construction Management interview) vs "starts at £130/month" (vendor blog)\[4\]\[27\] | Trade press plus vendor; nearly 20 customers about two months after launch\[4\] |
| COINS (Access) | Construction ERP | "Priced per user" on quote; not published\[28\] | Second-hand, via competitor comparison |

The internal figures for Site Samurai (£99–£699) are accurate. The ~£130 for Construction AI is partly accurate, because the vendor's own figures conflict. Construction AI is not a payment-compliance specialist. It is a broad SME suite, and its significance is how it was built (see 10), not its price. Software Advice reviewers of Payapps say that charging subcontractors is "always an awkward conversation".\[29\] Avoid that model.

## 6. Will AI agents and horizontal platforms eat this market?

Not imminently. But the threat to you comes less from agents than from cheap AI-built rivals and incumbents bundling the feature. The full argument is under 10.

## 7. Top three Commercial Director objections

See 12.

## Fact-checks A–H

### A. RICS AI standard: overstated to wrong as a sales lever

**Accurate:** RICS's professional standard "Responsible use of artificial intelligence in surveying practice" took effect on 9 March 2026.\[30\]\[31\] RICS's page gives a published date of 17 November 2025, and the PDF is dated September 2025. It is addressed to "RICS members and regulated firms". It covers baseline knowledge, practice management (data governance, system governance, risk management), procurement and due diligence, output reliability and assurance, client transparency, and the development of AI.\[31\]\[32\] Requirements reported by commentators and RICS include:
- a written register of AI systems that materially affect service delivery;\[33\]
- a risk register;\[30\]
- due diligence on AI suppliers;\[34\]
- written client disclosure in terms of engagement, including any opt-out;\[30\]\[33\]
- reliability decisions made by or under the supervision of "an appropriately qualified and named surveyor".\[32\]

**Wrong or overstated:**
- **Scope.** The standard applies only to AI use with a "material impact on the delivery of surveying services".\[31\] RICS's own FAQ says drafting emails or booking rooms is unlikely to qualify, and that it is "for the Regulatory Tribunal to determine" whether a use was material.\[32\]
- **"MRICS firm."** No such category exists. Firm-level obligations bind RICS-regulated firms. Most house builders and main contractors are not regulated firms. Their in-house MRICS QSs are bound individually, but the organisation has no direct duty to keep a register.
- **"Every MRICS firm is now in breach."** This is unsupported.
- **"Dip-sampling."** This is not a named requirement. The standard expects documented reliability assurance, and RICS notes that firms remain "accountable for every output, even if there isn't scrutiny of each one".\[32\] That supports a sampling approach but does not mandate one.
- **Enforcement.** I found no evidence of RICS enforcement action under the standard since March 2026.
- **Vendors.** Much of the "compliance guide" content online comes from surveying firms' SEO blogs, not vendors. I did not find a construction payment vendor marketing RICS AI compliance as a feature.

**Sales-lever strength:** weak for contractor-side buyers and moderate for consultancy (PQS) buyers, who are regulated firms with client-disclosure duties. There is a further irony. NoticeGuard's AI only flags lines, and the QS certifies. An honest reading may conclude that its AI does not have a "material impact" at all. Keep the governance features as a trust signal, but don't lead with them.

### B. Commercial Payments Bill: substance broadly accurate, status needs correcting

- **Name.** The government bill is the Commercial Payments Bill [HL]. The government's press release called it the Small Business Protections Bill.\[35\] Construction News refers to it as the Small Business Protections (Late Payments) Bill.\[36\]
- **Timeline.** Introduced in the Lords on 19 May 2026, following the government's March 2026 consultation response.\[35\]\[37\] Second reading 9 June, committee 21 July (30 government amendments agreed), report stage from 15 September 2026.\[38\]\[39\] The current print is "HL Bill 55 (as amended on Report)".\[40\] Commons stages and Royal Assent are still to come.\[39\]
- **What it does:**
  - Bans retention clauses in construction contracts outright, through new sections 113A–113F of the Construction Act.\[41\] This is a ban, not ring-fencing.
  - Imposes a fixed sum for unauthorised deductions from retention payments.\[42\]
  - Caps the final date for payment at 30 days after the due date where the purchaser is a public authority, and 60 days otherwise.\[41\]
  - Makes statutory interest of 8% above base rate mandatory on late payments.\[42\]
  - Lets suppliers recover a fixed sum for disputes raised late or without enough information.\[42\]
  - Gives the Small Business Commissioner stronger powers.\[43\]
  - Construction News reports a penalty of 50% of the retention debt for prohibited retention arrangements.\[36\]
- **Timing.** The retention ban carries a two-year transition from commencement of section 113B.\[41\] Construction News reports that some observers expect Royal Assent only in 2027, which would push the full effect to about 2029. Wording may still change.\[36\]

**Implications.** Retention tracking has a shelf life of a few years for new contracts. It still matters for legacy retentions, which run through defects periods, and for managing the transition to bonds and sureties. The Bill is a tailwind for the core product: shorter maximum terms, mandatory interest and penalties for late disputes all raise the cost of sloppy payment administration. Use it in your content now, with "if enacted" caveats.

### C. Market size: outdated and partly wrong

- **"About 2,500 active house builders."** This traces to NHBC data cited in HBF's 2017 SME report: "around 2,500 companies" that were small builders, and 2,527 active builders of all sizes registered with NHBC in 2015.\[44\] It is ten years old. Most of those firms are far below £10m turnover.
- **Top 10.** Barratt and Redrow merged in 2024, so "Redrow" is no longer a separate builder.\[45\] I could not verify the "50% of homes" share.
- **Top 50 housebuilders.** Building's Top 50 Housebuilders 2025 gives combined revenue of £35.1bn and 104,054 completions. The 50th-placed firm turned over just £31.2m, and roughly ranks 24–50 (about 27 firms) sit below £250m.\[46\]
- **Contractors.** The CN100 entry threshold was about £160m in 2024 (Seddon was 100th at £160.7m).\[47\]

**Sourced inference on serviceable market:** perhaps 80–200 UK house builders turn over £10m–£250m. Perhaps 1,000–2,000 general and specialist contractors in that band regularly act as main contractor. ONS counts 370,770 VAT/PAYE-registered construction firms in Great Britain,\[48\] but most are micro firms. The ONS size-band tables would tighten this estimate and should be checked by hand.

**Revenue implication:** at an average of about £8,000 a year per customer, 5% penetration of 1,500 firms is 75 customers and about £600k ARR. That can support a good lifestyle business or a small seed-funded company. It will not get you to a venture-scale outcome without moving upmarket, adding more modules or expanding geographically.

### D. Housing starts and buying mood: "starts are declining" is wrong for 2025–26

- **Starts are rising.** England recorded 35,910 seasonally adjusted new-build starts in Q2 2026, up 6% on the quarter and 20% year on year.\[5\]\[49\] Starts in the year to March 2026 were 130,170, up 15%.\[50\] MHCLG warns that part of the rise reflects a step-change in Building Safety Regulator reporting.\[51\]\[52\]
- **Completions are flat.** Completions in the year to June 2026 were 143,770, effectively unchanged.\[52\] Net additions since July 2024 total 437,900, well off the 1.5 million pace.\[51\]
- **NHBC.** 2025 registrations were 115,350 (up 11%) and completions 122,012 (down 2%).\[53\]
- **Insolvencies.** Construction had 3,866 insolvencies in England and Wales in the 12 months to August 2026, down 2% but still the highest of any industry.\[54\] EY-Parthenon reports that five of the 12 construction profit warnings in the year to Q1 2026 came from housebuilders.\[55\]

**Mood:** cautious and cost-focused, not frozen. Tools that protect cash and avoid losses can be sold. Tools that are merely "nice visibility" cannot.

### E. Ireland: partly accurate

- **"Modelled on HGCRA."** Loosely true at most. The payment-claim mechanics and the default consequence differ (see 4).
- **"50,000 homes a year."** Partly accurate as a needs figure. Ireland completed 36,284 homes in 2025, up 20.4%, and 7,856 in Q1 2026.\[56\]\[57\] RTÉ, reporting the CSO data, noted that observers put need at 50,000–60,000 a year. The ESRI's July 2024 estimate of structural demand was lower, at around 44,000 a year for 2023–2030, within a range of 35,000–53,000.
- **Builders.** Cairn Homes and Glenveagh are listed builders. Ballymore and Ardstone are private developers.
- **"Fewer software vendors."** Unverifiable. Payapps explicitly serves "the UK and Ireland".\[21\]

### F. Does HGCRA bite on house builders' subcontracts? Legally yes; in practice less

Developer–trade subcontracts are construction contracts. The residential-occupier exclusion covers homeowners, not developers. Labour-only work is still "construction operations". So the payment-notice regime applies. In practice, trades are commonly paid on house builder-led stage measures (for example foundations to DPC, DPC to first floor, first floor to wall plate), often through self-billing statements.\[58\]\[59\] Exposure still exists, because under section 110B a payee can serve its own notice if the payer fails to.\[60\] But the trigger is less often a large subcontractor application, sums per trade are smaller, and small trades who depend on repeat work adjudicate less often.

I found no published breakdown of adjudications by sector or party type. The KCL reports don't provide one. The claim that house builders are frequently smash-and-grabbed is therefore unverified.

**Recommendation:** lead with general building, refurbishment and fit-out contractors, plus M&E, civils and façade specialists acting as mains. These firms run application-based JCT/NEC subcontracts with BoQ/activity schedules, which is exactly what your line-by-line grid models. Many sit on Sage, iplicit or Xero rather than COINS. Treat house builders' contracting arms as a second segment.

### G. Competitors: the "no competitor" claim is wrong

- **Payapps.** Autodesk bought it for total consideration of $387m in cash ($381m purchase consideration). The deal was announced on 24 January 2024 and completed on 20 February 2024 (Autodesk 10-Q).\[61\]\[62\] Payapps handles notice-deadline reminders, variations, retentions and compliance documents.\[12\] Main contractors pay a fixed annual fee; subcontractors pay their own plans.\[22\]\[23\]
- **Eque2.** Claims more than 3,000 construction businesses.\[63\]\[64\] It offers PLN generation in Evaluate, payment-term capture in Construct for Sage (integrating with Sage 50/200/Intacct and Xero), Housebuilding with Mobile Tick Sheets, and a new subcontractor portal.\[2\]\[10\]\[64\]
- **Site Samurai and Construction AI.** Both market statutory deadline tracking to SMEs.\[65\]\[66\]

I did not verify user satisfaction with ERP notice modules. I also did not independently verify COINS, MRI, Contour, IFS, Access ConQuest/EasyBuild, Procore, Chalkstring, Gather, Kojo, Archdesk or Buildertrend in this research. Treat claims about them as open. The zero-login link may be unique, but "no competitor has a mobile site-to-office progress tool" is false.

### H. Incumbent AI: understated

Causeway describes CausewayOne as "AI-first". It ran a public session on 15 July 2026 showing AI capabilities that it said "are now live" in CausewayOne Trading, flagging margin and payment risk in AP/AR workflows.\[6\] It is also publishing on the 60-day cap and pay-less notices, and it achieved Cyber Essentials Plus in April 2026.\[67\]\[68\] Construction AI ships an AI agent with "120+ tools".\[14\] I did not confirm specific 2025–26 AI payment features from Payapps/Autodesk, COINS, Eque2, Procore or Access. The direction is clear, though: the anomaly-flag idea is not a durable lead.

## 8. Evidence on demand and pain

- **Volume and value.** The KCL / Adjudication Society report of 2024 is the latest in the series and was billed as the final one, so there is no 2025 or 2026 edition. It recorded 2,264 referrals (May 2023 to April 2024), a record and up 9% on the year. The most common claim value was £125k–£500k. Almost 20% of referrals used low-value or fast-track procedures.\[3\]\[69\]\[70\]
- **Claim types.** Smash-and-grab was cited by 63% of respondents, ahead of true-value final accounts (38%), true-value interim payments (35%), and loss and expense or delay (35%).\[3\]\[71\] Note that this is the share of respondents naming each category, not the share of all adjudications.
- **Gaps.** There is no sector split, and I found no credible first-hand forum evidence. Vendor testimonials, such as a Payapps customer saying assessing payments and issuing notices was "cut by around 50%", are marketing.\[23\]

## 9. Pricing recommendation

- **Founding pilot:** £250 per organisation per month, or £2,500 a year paid up front. Lock it for 24 months in exchange for a case study, a reference call and monthly feedback. Don't run free pilots, because free pilots in this sector rarely convert.
- **Standard pricing, per organisation per month, tiered by active subcontracts:**
  - up to 25 active subcontracts: £450;
  - up to 100: £900;
  - unlimited, plus forecasting and multi-entity: £1,500.
  - Unlimited users on every tier. Never charge subcontractors.
- **Reasoning.** This sits above SME suites (£99–£699) because you are selling loss avoidance on claims typically worth £125k–£500k. It sits below ERP projects, and it scales with the value at risk rather than with seats, which also sidesteps the per-seat pressure behind the "death of SaaS" narrative. I could not verify typical point-solution budgets at £10m–£250m contractors, so test these tiers in discovery.

## 10. "AI and the death of SaaS": both sides, and how durable your moats are

**The bear case.** In early February 2026, Anthropic's Cowork plugins set off what Bloomberg (3 February 2026) described as "a $285 billion rout in stocks across the software, financial services and asset management sectors". That figure covers more than software alone. Some estimates put the January–February software sector loss at about $2 trillion.\[72\]\[73\] Oliver Wyman (April 2026) reports that "safe" segments fell less but were not spared.\[74\] The more relevant evidence for you is Construction AI: one MCIOB contractor with no coding background used Claude Code to build "more than 700,000 lines of code, 186 database tables… and 60-plus AI-powered tools spanning 22 modules", and signed nearly 20 customers within about two months.\[4\] The cost of building your feature set is collapsing.

**The bull case.** Speaking at a UBS conference on 10 February 2026, Goldman Sachs CEO David Solomon said, as reported by Bloomberg: "I think the narrative over the last week has been a little bit too broad... There'll be winners and losers — plenty of companies will pivot and do just fine." Systems of record that carry legal consequences, such as served notices and audit trails used in adjudication, are where buyers want determinism and accountability, not autonomous agents. Most commentary on the selloff comes from blogs of mixed quality. I did not verify 2025–26 construction-tech funding data.

**Moat-by-moat:**
- **Statutory date engine:** low. Site Samurai gives a calculator away free.\[75\]
- **Immutable audit trail:** low to moderate. It is table stakes, though valuable as evidence.
- **RICS governance:** low. It is a weak lever and cheap to copy.
- **Data and switching costs:** moderate, but only once you hold several cycles of history across dozens of live subcontracts.
- **Domain depth, trust and distribution:** your real moat, and the one most limited by being part-time.

The internal assessment is too optimistic on the first three.

## 11. Go-to-market reality check

Expect long, relationship-led cycles. Plan for an FD/MD co-signature and a security questionnaire covering:
- Cyber Essentials, with Cyber Essentials Plus increasingly expected (Causeway holds it);\[68\]
- a UK GDPR data processing agreement and a list of sub-processors, including any LLM provider;
- data residency;
- SSO;
- PI and cyber insurance;
- limitation of liability, which is critical when a missed deadline could cost a client six figures.

Integration demands will be modest at first: CSV import and export to iplicit, Xero and Sage, then APIs. COINS and Eque2 sites will ask why they need you at all.

Pilots convert when there is a named owner, a fixed end date, agreed success metrics (notices served on time, hours saved per cycle, a near-miss log) and a price agreed before the pilot starts. Get your first customers the way niche UK construction SaaS founders typically do: warm introductions from former colleagues, construction solicitors and adjudicators, plus useful content. This is inference, not a verified case study. Being part-time is the critical constraint. Have a deadline-day support commitment and an independent backup alert, such as an email or calendar export of every statutory date.

## 12. Objections and counters

**Commercial Directors:**
1. *"Our ERP or Payapps already does this, and we've never been smash-and-grabbed."* Counter: offer a free retrospective audit of the last 12 months' notices to surface near misses and weak Pay Less Notices. Position NoticeGuard as an overlay that reads from the existing system rather than replacing it.
2. *"You're one part-time person. What happens if you disappear, or a deadline is missed?"* Counter: be open about it. Offer escrowed exports and scheduled full data dumps, independent calendar alerts, and a written SLA. Make the founding price low enough to be a low-risk bet.
3. *"My QSs and site managers won't use another system."* Counter: no double entry (import from the ERP), a 90-second site link, and the subcontractor's claim shown side by side with site-reported progress.

**FDs:** "Prove the ROI and the cash-forecast accuracy." Show avoided-loss maths and reconcile the forecast to actual payment runs.

**IT:** "Unauthenticated links, data leakage to AI providers, no certifications." Answer with expiring, scoped, tokenised links, a no-training data policy, Cyber Essentials and a DPA.

## Caveats

- Several sources are vendor or SEO content, flagged where used.
- The Bill is still in Parliament as of October 2026.
- The market-size figures are inferences from partial data.
- No first-hand practitioner survey was available.
- Several named competitors were not independently verified.

## Sources

1. [Eque2 Housebuilding Sofware - manage the full house bulding lifecycle](https://www.eque2.co.uk/housebuilding-software/)
2. [A Clear View from Site with Housebuilding Software - Eque2 Housebuilding](https://www.eque2-housebuilding.co.uk/industry-news/a-clear-view-with-house-building-software/)
3. [Legal developments in construction law: December 2024- Third King's construction adjudication report published - Lexology](https://www.lexology.com/library/detail.aspx?g=7c9d1d59-e603-4725-9c76-84cd249623c5)
4. [MCIOB develops own AI software for SMEs using AI - Construction Management](https://constructionmanagement.co.uk/mciob-develops-own-ai-software-for-smes-using-ai/)
5. [Housing supply: indicators of new supply, England: April to June 2026 - GOV.UK](https://www.gov.uk/government/statistics/housing-supply-indicators-of-new-supply-england-april-to-june-2026/housing-supply-indicators-of-new-supply-england-april-to-june-2026)
6. [Register](https://campaign.causeway.com/ai-for-causwayone-trading)
7. [AI in construction finance: what problems does it solve?](https://www.causeway.com/blog/why-ai-is-redefining-construction-finance)
8. [Advance JV v Enisca Limited](https://caselaw.nationalarchives.gov.uk/ewhc/tcc/2022/1152)
9. [Evision Housebuilding](https://www.eque2.com/products/housebuilding)
10. [Construction Estimating Software](https://www.eque2.com/solution/construction-estimating-software)
11. [Construction Accounting Software for Sage/Xero](https://www.eque2-construction.co.uk/construction-software/medium-contractor/)
12. [Payapps Software Features](https://www.payapps.com/uk/features/)
13. [Payment Notice & Pay Less Notice Templates (UK Construction Act)](https://www.sitesamurai.co.uk/resources/get-paid-on-time/payment-notices)
14. [Construction AI](https://www.constructionai.io/)
15. [Irish Construction Adjudication: Recent High Court Decisions - Lexology](https://www.lexology.com/library/detail.aspx?g=3851bc34-9c43-418f-ba51-4a3f489a0722)
16. [‘No Time to Argue’ - Lexology](https://www.lexology.com/library/detail.aspx?g=4e9b16eb-2250-41b9-b916-3b41a5d2603c)
17. [Construction Law Update: Court elaborates principles that apply in Ireland to Enforcement of Adjudication Decisions - Lexology](https://www.lexology.com/library/detail.aspx?g=95b5e6b7-2a98-4af3-87f3-05103d104acd)
18. [Aakon Construction Services LTD v Pure Fitout Associated LTD (Approved) \[2021\] IEHC 562 (13 September 2021)](https://www.bailii.org/ie/cases/IEHC/2021/2021IEHC562.html)
19. [Construction Contracts Statutory Adjudication: 2025 Trends - Philip Lee LLP](https://www.philiplee.ie/construction-contracts-statutory-adjudication-2025-trends/)
20. [Construction Update: Upward trend in Adjudications](https://www.arthurcox.com/insights/construction-update-upward-trend-in-adjudications/)
21. [Payapps](https://www.payapps.com/uk/)
22. [Subcontractor Pricing Plans](https://www.payapps.com/uk/pricing-subcontractors/)
23. [Contractor Plans Pricing](https://www.payapps.com/uk/pricing-main-contractors/)
24. [Site Samurai — Construction Management Software for UK Contractors](https://www.sitesamurai.co.uk/)
25. [Site Samurai vs Procore (2026)](https://www.sitesamurai.co.uk/compare/site-samurai-vs-procore)
26. [Pricing](https://www.sitesamurai.co.uk/pricing)
27. [Best Procore Alternatives for UK Small Contractors (2026)](https://www.constructionai.io/blog/best-procore-alternatives-uk)
28. [Site Samurai vs COINS (2026)](https://www.sitesamurai.co.uk/compare/coins-alternative)
29. [Payapps](https://www.softwareadvice.co.uk/software/341687/payapps)
30. [RICS AI Guidance: Responsible use of artificial intelligence in surveying practice - 4 New Square Chambers](https://www.4newsquare.com/rics-ai-guidance-article/)
31. [AI for Surveyors: RICS Rules, Uses & Risks (2026)](https://www.aiworkforce.co.uk/blogs/ai-for-surveyors-rics-ai-powered-tools)
32. [Responsible use of artificial intelligence in surveying practice](https://www.rics.org/profession-standards/rics-standards-and-guidance/conduct-competence/responsible-use-of-ai)
33. [RICS sets the standard: responsible AI use becomes mandatory in surveying](https://beale-law.com/article/rics-sets-the-standard-responsible-ai-use-becomes-mandatory-in-surveying/)
34. [Responsible AI in Chartered Surveyor Valuations: RICS 2026 Standards](https://princesurveyors.co.uk/blog/responsible-ai-in-chartered-surveyor-valuations-rics-2026-standards-for-geopolitical-risk-and-market-uncertainty/)
35. [Dentons - The proposed retention ban and other new payment legislation (UK construction focus)](https://www.dentons.com/en/insights/articles/2026/june/2/the-proposed-retention-ban-and-other-new-payment-legislation)
36. [Retentions ban: no holding back](https://www.constructionnews.co.uk/legal/retentions-ban-no-holding-back-26-05-2026/)
37. [The reshaping of retentions: what’s next for retentions in construction contracts?](https://www.hilldickinson.com/our-view/articles/the-reshaping-of-retentions-what-s-next-for-retentions-in-construction-contracts/)
38. [Commercial Payments Bill \[HL\]: Progress in the Lords - House of Lords Library](https://lordslibrary.parliament.uk/research-briefings/lln-2026-0049/)
39. [Streamlinefeed](https://streamlinefeed.co.ke/news/commercial-payments-bill-reaches-lords-report-stage)
40. [Commercial Payments Bill \[HL\] - Parliamentary Bills - UK Parliament](https://bills.parliament.uk/bills/4128)
41. [Commercial Payments Bill: What it means for the construction industry](https://www.boyesturner.com/insights/commercial-payments-bill-and-the-construction-industry)
42. [Late Payment Bill Second Reading - Lord Leong Opening Speech - Small Business Commissioner](https://www.smallbusinesscommissioner.gov.uk/late-payment-bill-second-reading-lord-leong-opening-speech/)
43. [Commercial Payments Bill \[HL\]: HL Bill 4 of 2026–27 - House of Lords Library](https://lordslibrary.parliament.uk/research-briefings/lln-2026-0028/)
44. [Reversing the decline of small housebuilders:](https://www.hbf.co.uk/documents/6879/HBF_SME_Report_2017_Web.pdf)
45. [Top 50 Housebuilders 2025](https://www.building.co.uk/data/top-50-housebuilders-2025/5139664.article)
46. <https://www.building.co.uk/focus/top-50-housebuilders-searching-for-signs-of-hope/5139553.article>
47. [Seddon warns of training trouble](https://www.constructionnews.co.uk/sections/long-reads/interviews/seddon-warns-of-training-trouble-10-03-2025/)
48. [1\. Main points](https://www.ons.gov.uk/businessindustryandtrade/constructionindustry/articles/constructionstatistics/latest)
49. [Housing market: Economic indicators - House of Commons Library](https://commonslibrary.parliament.uk/research-briefings/sn02820/)
50. [Housing supply: indicators of new supply, England: January to March 2026 - GOV.UK](https://www.gov.uk/government/statistics/housing-supply-indicators-of-new-supply-england-january-to-march-2026/housing-supply-indicators-of-new-supply-england-january-to-march-2026)
51. [England housebuilding: what does the latest data show about the 1.5 million homes target?](https://www.bcis.co.uk/news/england-housebuilding-what-does-the-latest-data-show-about-the-1-5-million-homes-target/)
52. [Housebuilding starts jump 20%, but BSR reporting clouds the recovery](https://www.planninggeek.co.uk/2026/housebuilding-starts-bsr-reporting/)
53. [New home registrations up 11% according to NHBC figures](https://todaysconveyancer.co.uk/new-home-registrations-11-according-nhbc-figures/)
54. [Construction tops insolvency table with 3,866 failures](https://scaffmag.com/scaffolding-news/construction-insolvencies-august-2026/)
55. [New data highlights another upturn in construction insolvencies](https://specificationonline.co.uk/articles/2026-06-02/bcis/new-data-highlights-another-upturn-in-construction-insolvencies)
56. [Over 36,000 new homes completed in 2025 - CSO](https://www.rte.ie/news/business/2026/0129/1555752-cso-housing-completions/)
57. [Press Statement](https://www.cso.ie/en/csolatestnews/pressreleases/2026pressreleases/pressstatementhighlightsfromthehousinghubmay2026/)
58. [Brickwork Sub-Contractor: Take-Off to Stage Invoice](https://zigaflow.com/industry-resources/take-off-materials-stage-invoicing-brickwork-masonry-contractors)
59. [Bricklayer Invoice Template: Free Guide and Examples](https://aviy.ai/blog/bricklayer-invoice-template)
60. [Managing the construction payment process: Applications for Payment, Payment Notices and the Construction Act.](https://uk.payapps.com/2019/05/21/managing-the-construction-payment-process-applications-for-payment-payment-notices-and-the-construction-act/)
61. [Autodesk, Inc. - Form 10-Q - FY2024](https://www.sec.gov/Archives/edgar/data/769397/000076939724000091/adsk-20240430.htm)
62. [Autodesk acquires Payapps - 2024-01-24 - Crunchbase Acquisition Profile](https://www.crunchbase.com/acquisition/autodesk-acquires-payapps--f54355d3)
63. [Software for Commercial Fit-Out Contractors](https://www.eque2.com/industry/commercial-fit-out)
64. [Construction Management Software](https://www.eque2.com/)
65. [Payment Applications Under the Construction Act: A Practical Guide](https://www.constructionai.io/blog/payment-applications-construction-act)
66. [Best Subcontractor Management Software UK (2026 Guide)](https://www.sitesamurai.co.uk/compare/best-subcontractor-management-software-uk)
67. [Causeway construction and maintenance management software](https://www.causeway.com/)
68. [Causeway - 2026 Company Profile, Team, Funding, Competitors & Financials - Tracxn](https://tracxn.com/d/companies/causeway/__Z7tNp7q0bivdWP-Fv_oUCdoxdem9Qp9E2v6RqShY-os)
69. [King's publishes third construction adjudication report focusing on key trends](https://www.kcl.ac.uk/news/kings-publishes-third-construction-adjudication-report-focusing-on-key-trends)
70. [Construction Dispute Statistics UK 2026](https://www.gatherinsights.com/en/construction-dispute-statistics-uk)
71. [Construction Adjudication In The UK: Insights and Trends - Stephensons Solicitors LLP](https://www.stephensons.co.uk/site/blog/consumer-law-blog/construction-adjudication-in-the-uk-insights-and-trends)
72. [The SaaSpocalypse: AI Agents Disrupting Software Industry](https://www.digitalapplied.com/blog/saaspocalypse-ai-agents-software-industry-analysis)
73. [AI Agents Wiped \$2T Off Software Stocks. Why?](https://www.albis.news/perspectives/saaspocalypse-ai-agents-wiped-2-trillion-from-software-stocks-2026)
74. [How AI is reshaping SaaS valuations: a guide for investors](https://www.oliverwyman.com/our-expertise/insights/2026/apr/how-agentic-ai-reshaping-saas-valuations.html)
75. [Construction Payment Deadline Calculator (UK)](https://www.sitesamurai.co.uk/resources/get-paid-on-time/payment-deadline-calculator)
