# Landing Page — Variant Strategy & Messaging (Aug 2026)

## Which variant to run with

Four variants built in `/tmp/landing-variants/` (dark / editorial / vibrant / product-led), all using the same two screenshots (dashboard empty-state + BOQ grid).

**Recommendation: V2 (editorial) as the base**, with these reasons:
- Cleanest at carrying a second headline message (drawdown) without clutter
- Serif + whitespace reads "established professional services" to a Commercial Director, not "startup toy"
- The product-led variant (V4) becomes strong *later* once we have lit-up screenshots with real data and the drawdown screen — revisit after Stage 2 build

Keep V1 (dark) as the A/B alternative — it tests a meaningfully different mood.

## Messaging updates to apply to the winner (vs current live page)

1. **Add the second wedge above the fold or in the second section:** "…and a live cash-out forecast of every subcontract — what you owe, when, retention included." The current page is compliance-only; the drawdown doubles the buyer set (FDs care too).
2. **Comparative positioning, implied not named:** add a line like "Not a module in a bigger system — the whole product is the notice regime." (Answers "why not Site Samurai?" without naming them.)
3. **RICS-ready trust line (post-verification):** once the primary standard is read, add to the footer/features: "Built for the RICS AI-in-surveying standard (effective March 2026): audit trail, named approver, AI-use register."
4. **AI honesty line:** "AI flags what needs your attention. Your QS still certifies. Every figure traces to source." — this is a differentiator against black-box claims, not a disclaimer.
5. **Better screenshots when available:** lit-up RAG dashboard (seeded org), the drawdown screen once built. Current empty-state dashboard is a placeholder at best.

## Sequence
1. Wire waitlist endpoint (5 min, blocks everything)
2. Apply messaging updates to V2 → deploy to builder-ops.vercel.app (or noticeguard-landing.vercel.app for now)
3. A/B against V1-dark later if traffic justifies it
4. Rebuild screenshots + add drawdown section after Stage 2 ships
