# Feature Spec — Subbie Drawdown (Cash Forecast)
*Status: draft for review · Feeds: product + pilot pitch + LinkedIn content*

## 1. What it is, in one paragraph

A forward-looking cash view of every subcontract the contractor is committed to. For each subcontract: the total package value, how it's drawn down across the forecast payment cycles, how much has been certified to date, how much retention is being held and when each tranche releases. Rolled up: a portfolio cash-out forecast — "across all projects, here's what we owe subbies, month by month, for the next 12 months."

**Why it matters (the pitch line):** the compliance wedge stops catastrophic loss; the drawdown view is what the commercial team and FD open every Monday. Compliance gets them in the door; cash forecasting is why they stay.

## 2. The worked example (your £500k package)

A £500,000 subcontract order, 20 monthly payment cycles, 5% retention (2.5% released at PC, 2.5% at end of defects period):

| Cycle | Forecast date | Forecast gross | Retention held | Net cash out | Cumulative drawn |
|-------|--------------|----------------|----------------|--------------|------------------|
| 1 | Mar 2026 | £25,000 | £1,250 | £23,750 | £25,000 |
| 2 | Apr 2026 | £25,000 | £1,250 | £23,750 | £50,000 |
| … | … | … | … | … | … |
| 20 | Oct 2027 | £25,000 | £1,250 | £23,750 | £500,000 |
| — | PC release | — | −£12,500 (2.5%) | +£12,500 in | — |
| — | Defects release | — | −£12,500 (2.5%) | +£12,500 in | — |

Three questions the view answers at a glance: **when** are the applications/valuations forecast, **how much** cash goes out each month, and **when does retention come back**.

## 3. What the data model already gives us (the good news)

| Needed | Source | Status |
|---|---|---|
| Package value (commitment) | `SubcontractOrder` + `ActivityScheduleLine` totals | ✅ exists |
| Cycle dates (application, due, final payment) | `PaymentCycle.applicationExpectedDate / dueDate / finalDateForPayment` | ✅ exists — already bank-holiday-adjusted |
| Assessed values per cycle | `Assessment.grossValuation / retentionAmount / netThisCycle` | ✅ exists |
| Retention held + release dates/amounts | `RetentionLedger.totalHeld / pcReleaseDate / pcReleaseAmount / mcdReleaseDate / mcdReleaseAmount` | ✅ exists |
| Cycle status (forecast vs actual) | `PaymentCycle.status` | ✅ exists |

**The single real gap:** there is no *forecast* value for future cycles. Cycles have dates, but no predicted amount until an application/assessment exists. Everything else is arithmetic over existing tables.

## 4. The forecasting model (how future cycle values are predicted)

Three tiers, in order of preference — and the spec deliberately starts with the simplest:

**Tier 1 — even drawdown (v1, ship this):** remaining contract value ÷ remaining cycles. After each real assessment, the remaining forecast redistributes automatically. Self-correcting: if cycle 1 certifies £30k of a £25k-even forecast, cycles 2–20 re-forecast to £24,736 each. Zero user input, always sane.

**Tier 2 — S-curve profile (v1.5):** construction spend follows an S-curve (slow start, peak mid-project, tail-off). Offer standard profiles (even / front-loaded / standard S / back-loaded) chosen at subcontract setup, or a % per cycle the user can edit. This is how commercial teams actually forecast internally — and it matches what your ICP does in Excel today.

**Tier 3 — AI-refined (later, informed by the deep-research report):** learn each subcontractor's actual drawdown pattern vs. forecast and adjust; flag cycles likely to over/under-claim based on history. **Do not build this first** — it needs the Tiers 1–2 data to exist before it has anything to learn from.

**Design rule for any AI layer:** forecast suggests, human adjusts, every override logged. Same line as the rest of the product.

## 5. The screens

**Screen A — Subcontract drawdown (per subcontract order).** Lives on the subcontract detail page as a new tab.
- Header: package value · certified to date · remaining commitment · retention held (with PC/defects release dates).
- Table (the example in §2): one row per cycle — forecast date, forecast gross, retention, net cash, cumulative; rows for actual cycles show real assessed figures and highlight variance vs. forecast.
- A simple bar/area chart: monthly cash-out over the contract duration, actual vs. forecast shading.

**Screen B — Portfolio cash forecast.** New top-level nav item ("Cash forecast" — this is the FD view).
- Month-by-month grid: rows = subcontracts (grouped by project), columns = months, cells = net cash out; row/column totals.
- Filter by project, subcontractor, date range. Export CSV (the FD will want it in Excel regardless — lean into that, don't fight it).
- **Excel data feed (from Sohrab's iplicit-model idea):** a per-org API key + a documented pull endpoint (and/or an official Excel add-in) so users can pull live drawdown/valuation data straight into Excel, mix it with their own budgets on a separate sheet, and build custom cash-flow models. Longer-term: a lightweight add-in (Office.js task pane, like iplicit's) rather than raw CSV. Distribution beat: "your FD's own Excel model, fed live by NoticeGuard."
- Retention releases shown as negative cash-out (money coming back) in the relevant months.
- **Auto-CVR (from pain-points research):** the month-end CVR pack QS teams spend 2–4 days assembling (Claire Hill: 3–4 days) — generate it from this same live data. Directors get a current commercial position, not three-week-old numbers.

## 6. Build order (value-per-effort)

1. **Screen A with Tier-1 even drawdown** — pure read/aggregation over existing tables + one small forecast function. Biggest demo value, smallest build.
2. **Screen B portfolio rollup** — same data, grouped. This is the pitch screenshot.
3. **Tier-2 S-curve profiles** — needs a profile field on PaymentSchedule + redistribution logic.
4. **Variance insights / AI** — after real pilot data exists.

## 7. How it feeds the pitch and the campaign

- **Pilot pitch:** "You get compliance AND a live cash-out forecast of every subcontract — the thing your FD asks for monthly, generated in one click."
- **LinkedIn (build-in-public post):** "Every commercial team I know rebuilds the same drawdown spreadsheet every month. So NoticeGuard just generates it — forecast cycles, retention held, release dates, portfolio rollup. Screenshot below. What am I missing?"
- **Competitive angle:** all-in-ones bury this in cost reports; a one-screen answer to "what do we owe subbies and when" is a 30-second demo that lands.
