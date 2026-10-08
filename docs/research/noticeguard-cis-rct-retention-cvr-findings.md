# NoticeGuard: CIS, RCT, retention and CVR findings

Research date: 8 October 2026. Purpose: what NoticeGuard can build on, combine or take ideas from in these four areas.

This is product research, not tax or legal advice. Confirm the CIS and retention points with an adviser before building claims around them. Check each repo's LICENSE file and recent activity before using any code.

## Summary

- There is almost no reusable open-source code for these four areas. The useful material is official specifications and a handful of repos worth reading for data models.
- Two 2026 rule changes should reorder the roadmap: CIS becomes the strongest expansion, retention the weakest.
- Suggested order: (1) CIS verification record and evidence pack, (2) subcontract CVR feed, (3) retention run-off and reporting, (4) RCT, once a pluggable tax-regime step exists.

---

## 1. CIS (Construction Industry Scheme)

### What exists to build on

HMRC publishes the technical specifications for CIS software developers under the Open Government Licence. This corrects the earlier report, which repeated one repo's claim that the schema was not publicly available.

| Resource | Link |
|---|---|
| Schema and technical specifications (landing page) | https://www.gov.uk/government/publications/construction-industry-scheme-schema-and-technical-specifications |
| CIS monthly return schema v1.2 (XSD) | https://assets.publishing.service.gov.uk/media/5a749088e5274a410efd09c4/CISreturn-v1-2.xsd |
| CIS verification request schema v1.2 (XSD) | https://assets.publishing.service.gov.uk/media/5a7e42cb40f0b62305b81d88/CISrequest-v1-2.xsd |
| CIS verification response schema v1.2 (XSD) | https://assets.publishing.service.gov.uk/media/5a7de3c740f0b62305b7f66d/CISresponse-v1-2.xsd |
| Quality standard and business validation spec v2.2 (PDF) | https://assets.publishing.service.gov.uk/media/5d53df0040f0b6098ead46c2/cis-qsbvr-v2.2.pdf |
| Monthly return response messages v1.1 (PDF) | https://assets.publishing.service.gov.uk/media/5a7ed5b8e5274a2e87db234c/monthly-return-response-messages.pdf |
| Verification request/response messages v2.1 (PDF) | https://assets.publishing.service.gov.uk/media/5a7ec01bed915d74e62263b0/verification-request-response-messages.pdf |
| Valid XML samples (ZIP) | https://assets.publishing.service.gov.uk/media/5af4477ae5274a25de493090/Valid_samples.zip |
| CIS recognition pack v1.0 (ZIP) | https://assets.publishing.service.gov.uk/media/6329656f8fa8f5779c54ab1a/CIS-Recognition-v1.0.zip |
| Support collection for CIS software developers | https://www.gov.uk/government/collections/construction-industry-scheme-online-support-for-software-developers |

Note: the landing page was last substantively updated in September 2022. Confirm with HMRC that these versions are still current before building against them.

### Repos (from the earlier report, relevant here)

| Repo | What it is | Licence | Use |
|---|---|---|---|
| https://github.com/hmrc/construction-industry-scheme | HMRC's backend for the new CIS digital service | Apache-2.0 | Read validation rules and data shapes |
| https://github.com/hmrc/cis-contractor-frontend | HMRC's contractor-facing CIS frontend | Apache-2.0 | UX reference for contractor journeys |
| https://github.com/hmrc/cis-deductions-api | CIS Deductions (MTD) API, subcontractor side | Apache-2.0 | Deduction data model |
| https://github.com/AbacusRog/CISReturn | Multi-client CIS tool: subcontractors, statements, CIS300 builder | None confirmed, ideas only | Closest working analogue |

### What accounting APIs do and don't give you

- **Xero:** read-only. Returns whether a contact is a CIS subcontractor and their deduction rate. https://rubydoc.info/gems/xero-ruby/2.8.2/XeroRuby/Accounting/CISSetting
- **Sage Accounting:** CIS settings are not exposed through the API; CIS fields on invoices are returned read-only. https://developer.sage.com/accounting/guides/concepts/construction_industry_scheme
- **FreeAgent:** has a CIS settings endpoint. https://dev.freeagent.com/docs/cis_settings
- **Odoo:** has a UK CIS module that produces the deduction report and submits monthly returns via its HMRC API module. Useful as a data-model reference. https://www.odoo.com/documentation/master/applications/finance/fiscal_localizations/united_kingdom.html

Implication: NoticeGuard would have to own subcontractor verification status itself rather than rely on the accounting system.

### The rule change that makes this the strongest expansion

From 6 April 2026:

- Contractors are liable for lost tax plus a penalty of up to 30% if they "knew or should have known" a transaction in their supply chain was connected to fraud.
- HMRC can remove Gross Payment Status immediately, with a five-year bar on reapplying.
- Penalties can attach to company officers personally.
- Nil returns are mandatory again for months with no subcontractor payments.

Sources:
- https://www.rpclegal.com/thinking/tax-take/significant-changes-to-the-construction-industry-scheme-coming-into-effect-on-6-april-2026/
- https://www.rsmuk.com/insights/tax-voice/new-cis-fraud-rules-from-april-2026-what-businesses-must-know
- https://www.charlesrussellspeechlys.com/en/insights/expert-insights/construction-engineering-and-projects/2026/sharper-teeth-more-returns--construction-industry-scheme-tax-reforms-target-fraud-prevention-and-increase-administration-for-contractors/
- https://www.saffery.com/?p=27766

### Idea for NoticeGuard

A **CIS due-diligence pack**: verification history, re-checks before payment, onboarding documents, Companies House checks, and nil-return deadline alerts (returns are due by the 19th). This is the adjudication evidence pack applied to a second statutory regime, using the same deadline engine and audit trail.

Suggested staging:
1. Verification record, deduction calculation, payment and deduction statements, CIS300 data export.
2. Direct filing to HMRC later. This needs HMRC software recognition.

---

## 2. RCT (Relevant Contracts Tax, Ireland)

### What exists

No open-source RCT code found on GitHub.

### How the process works

1. **Contract notification:** notify Revenue when entering a relevant contract with a subcontractor.
2. **Payment notification:** notify Revenue of the gross amount before each payment.
3. **Deduction authorisation:** Revenue replies with the tax to deduct, at 0%, 20% or 35%.
4. **Deduction summary / return:** Revenue builds the summary from the payment notifications.

Sources:
- Revenue, notifications for principal contractors: https://www.revenue.ie/en/self-assessment-and-self-employment/rct/notifications-principal-contractors.aspx
- Revenue Tax and Duty Manual, RCT: https://www.revenue.ie/en/tax-professionals/tdm/income-tax-capital-gains-tax-corporation-tax/part-18/18-02-04-20160928072237.pdf
- RCT Regulations 2012 (S.I. 576 of 2012): https://www.irishstatutebook.ie/eli/2012/si/576/made/en/pdf
- SAP's description of the XML web-service flow (contract registration, payment notification, rate response): https://blogs.sap.com/2014/10/29/ireland-rct-withholding-tax-changes/

### Integration route

- Revenue built web services for third-party and in-house software when the electronic system launched: https://www.charteredaccountants.ie/taxsourcetotal/taxpoint/source/2011/07/ireland/2011-07-ireland-1.html
- ROS web services require requests signed with a ROS digital certificate. Example of Revenue's REST signing approach (from a different service): https://revenue.ie:443/en/online-services/support/software-developers/documents/aeoi/api-fds-v1.3.pdf
- **Not found:** the current RCT web-service specification. Ask Revenue directly (eRCTInfo@revenue.ie is the contact given in public RCT guidance).

### Idea for NoticeGuard

RCT is a hard gate before payment, which fits the payment-cycle state machine. Make "tax withholding regime" a pluggable step in the cycle:

- CIS: verify, deduct, issue statement, monthly return.
- RCT: notify contract, notify payment, apply the authorised rate.

Build CIS first. RCT then slots in for Phase 2 without rework. Ireland also has its own payment regime under the Construction Contracts Act 2013, which was not researched here.

---

## 3. Retention

### The rule change that makes this the weakest expansion

- On 24 March 2026 the government published its late payment consultation response and confirmed it intends an outright ban on retention in construction contracts, by amending the Construction Act.
- It is not yet in force. Further consultation is on how to implement it, not whether.
- The same package includes maximum 60-day payment terms and a separate measure for construction aligned with the existing payment notice mechanism. That second point is worth tracking for the core notice engine.

Sources:
- https://www.hcrlaw.com/news-and-insights/the-uk-governments-plans-to-ban-retention-payments-in-construction-contract/
- https://www.mills-reeve.com/publications/retentions-reform-and-the-uk-new-late-payment-crackdown-what-this-means-for-construction-projects/
- https://www.osborneclarke.com/insights/uk-government-ban-construction-retentions-and-tighten-late-payment-rules
- https://gowlingwlg.com/en/insights-resources/articles/2026/uk-government-proposes-ban-on-retention-payments-in-construction-contracts
- https://www.forbessolicitors.co.uk/articles/the-end-of-retentions-a-new-era-for-construction-cash-flow

### What still has value

1. **Run-off ledger** for retention already held on live contracts, with release dates at practical completion and end of defects period.
2. **Retention as a per-contract setting** that can be zero, with room to track alternative security such as retention bonds.
3. **Reporting.** Qualifying companies must report on their retention practices for financial years starting on or after 1 April 2025: whether retention clauses are standard, the standard percentage, any contract value below which none is used, and the release process.
   - https://www.ashfords.co.uk/insights/articles/compulsory-retention-reporting-from-1-april-2025-what-are-the-key-changes-that-qualifying-companies-need-to-be-aware-of
   - https://mills-reeve.com/blogs/construction/february-2025/new-requirement-to-report-on-retention-money-held
   - https://www.hsfkramer.com/notes/construction/2024-posts/New-requirements-for-large-companies-to-report-on-construction-retentions-

### Repos for data-model ideas

| Repo | What it is | Licence | Use |
|---|---|---|---|
| https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction (retention-tracker skill) | Small Python model: held amounts by subcontractor, release schedule, releases. US-flavoured (lien waivers) | MIT | Field and state checklist |
| https://github.com/javier-llamas/construbot | Django construction system: multiple retentions per contract with separate release conditions, cumulative progress estimates, over-billing warnings. Docs: https://construbot.readthedocs.io/en/latest/user-guide/concepts/retentions.html | AGPL-3.0, 1 star | Read, don't copy |
| https://github.com/EnfonoTech/construction_management_suite | ERPNext suite with a daily retention-release check for defects-liability expiry | Not confirmed | Pattern for the release sweep |
| https://github.com/thefrappedev/buildsuite_core | Subcontractor bills with retention / advance / net-payable waterfall | Confirm on repo | Calculation waterfall |
| https://github.com/Aakvatech-Limited/ConsMS | Progress claims with retention and previous certification | Not confirmed | Cumulative vs previous vs this-period maths |
| https://github.com/OCA/account-invoicing | Odoo addons incl. `account_invoice_payment_retention` | AGPL-3.0 | Data-model reference |

### LinkedIn kit impact

Hook 9 ("The £4.5bn retention industry, and the release dates nobody tracks") is dated by the ban. The stronger angle now is the ban itself and what contractors must do about retention already held.

---

## 4. CVR (cost value reconciliation)

### What exists

No open-source CVR tool found. A full CVR needs labour, materials and plant costs, which NoticeGuard does not hold.

### Reference models

| Resource | What it offers | Link |
|---|---|---|
| Sage Intacct construction forecasting API | WIP project model: separate project manager and CFO forecasts of cost to complete and cost at completion, plus over- and underbilling | https://developer.sage.com/intacct/docs/openapi/cf/construction-forecasting.wip-project/tag/WIP-project |
| Sage Intacct WIP setup | How over/underbilling reconciliation is configured | https://developer.sage.com/intacct/docs/openapi/cf/construction-forecasting.wip-setup/tag/WIP-setups/ |
| pmev (R package) | Earned value formulas: planned value, earned value, cost variance, estimate to complete, estimate at completion | https://github.com/david-hammond/pmev |
| Odoo "Job Costing, WIP & T&M Billing" app | Committed cost, cost to complete, over/under billing. Proprietary, ideas only | https://apps.odoo.com/apps/modules/19.0/job_costing_wip_tandm |

### Idea for NoticeGuard

Build the **subcontract slice of CVR** from data already held, per package:

- Order value
- Agreed variations and anticipated variations
- Forecast final account
- Certified to date
- Applied but uncertified
- Retention held
- Cost to complete

Export this as a feed into the customer's CVR pack. Pull actual costs from iplicit or Xero later.

Borrow Sage Intacct's two-forecast idea: a QS forecast plus a logged commercial director override.

---

## 5. Variations and cash flow

The DDC skills collection (MIT, 341 stars at time of research) includes related skills:

- change-order-manager, change-order-processor, change-order-analysis
- payment-application-processor, payment-application-generator
- subcontractor-payment-tracker, subcontractor-prequalification
- cash-flow-forecaster
- warranty-tracker

Links:
- Repo: https://github.com/datadrivenconstruction/DDC_Skills_for_AI_Agents_in_Construction
- Skill index: https://www.skills.sh/datadrivenconstruction/ddc_skills_for_ai_agents_in_construction

These are prompts with Python snippets and are US-oriented. Use them as field and state checklists, not production code. The collection's cost database (CWICR) is licensed CC BY-NC, non-commercial, so avoid that part.

---

## Open items to confirm

- Whether the HMRC CIS schema versions listed above are still current, and the recognition process for direct filing.
- The current RCT web-service specification and access terms from Revenue.
- Licences on the smaller repos marked "not confirmed".
- Whether Odoo's UK CIS module is Community or Enterprise.
- Progress of the retention ban legislation and the construction-specific payment notice measure.
