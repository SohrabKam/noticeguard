# BuilderOps (NoticeGuard)

A multi-tenant B2B SaaS for main contractors and commercial managers to
administer subcontractor payments and statutory compliance under the UK
**Housing Grants, Construction and Regeneration Act 1996**.

It tracks subcontract order values, projects payment cycles from contract
terms, evaluates periodic application claims, and automatically enforces
critical statutory notification deadlines (Payment Notices and Pay Less
Notices) — including UK-bank-holiday-aware deadline calculation. It also
monitors subcontractor compliance documentation (insurance, CIS status,
H&S policies) and archives every legally-binding communication in an
append-only audit trail.

## What it does

- **Contract setup** — a guided wizard captures the project, subcontractor,
  payment terms and activity schedule, then generates the full run of
  payment cycles for the contract's duration.
- **Applications & valuations** — subcontractors submit payment
  applications (by email or the public API); commercial managers assess
  them line-by-line in a spreadsheet-style grid with automatic
  retention/net calculation.
- **Statutory notices** — Payment Notices and Pay Less Notices are served
  with figures frozen at serve time, emailed to subcontractors and
  recipients, and logged for delivery confirmation.
- **Automated deadline sweeps** — background jobs watch every live cycle
  for approaching/missed deadlines, expiring compliance documents,
  retention release dates, and send daily digests — all scoped per
  organisation.
- **Compliance tracking** — per-subcontractor document checklists (e.g.
  Employers Liability, Public Liability, CIS Confirmation) with
  valid/expiring/expired status.
- **Multi-tenant by design** — every record is scoped to an
  `Organisation`, mapped 1:1 to a Clerk organisation (or a personal
  workspace for solo users), with role-based access (`VIEWER` <
  `COMMERCIAL` < `ADMIN`).
- **Programmatic access** — a versioned public API (`/api/v1`) with
  API-key auth for downstream integrations, alongside inbound email
  parsing and outbound webhooks.

## Tech stack

- **Framework:** [Next.js](https://nextjs.org) 16 (App Router, Turbopack,
  `proxy.ts` middleware) + React 19
- **Language:** TypeScript
- **Database:** PostgreSQL via [Prisma](https://www.prisma.io) ORM, using
  the Neon serverless driver adapter (`@prisma/adapter-neon`) over
  HTTP/WebSocket — no query-engine binary, no connection-pool exhaustion
- **Auth & tenancy:** [Clerk](https://clerk.com) — sessions, organisation
  membership, and role sync via webhooks
- **Background jobs:** [Inngest](https://www.inngest.com) — hourly/daily
  cron sweeps for deadlines, retention, compliance expiry, and digests
- **Email:** [Resend](https://resend.com) — outbound statutory notices
  and alerts, plus inbound application parsing
- **File storage:** [Vercel Blob](https://vercel.com/storage/blob) —
  client-direct uploads for compliance documents and attachments
- **UI:** Tailwind CSS v4, Base UI / shadcn-style components,
  [Glide Data Grid](https://github.com/glideapps/glide-data-grid) for the
  assessment spreadsheet
- **Validation:** Zod
- **Webhook verification:** Svix (Clerk + Resend)
- **Testing:** Vitest

## Getting Started

Copy `.env.local.example` to `.env.local` and fill in the required
secrets (Clerk, Neon/`DATABASE_URL`, Resend, Inngest, Vercel Blob), then:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

### Other useful commands

```bash
npm test    # run the Vitest suite
npm run lint
npx prisma studio   # inspect the database
```

## Testing

- **Unit / action tests** — Vitest (`npm test`). Server actions and routes are
  tested with a seam-mock pattern: the two external seams (`@clerk/nextjs/server`
  or `@/lib/auth`, and `@/lib/db`) are mocked so each test exercises only the
  action's own logic, including cross-tenant (organisation-scoping) regression
  tests.
- **Authenticated UAT** — a Playwright script drives a real browser through the
  client-onboarding journey (sign in → `/onboarding` → create organisation →
  dashboard) against a deployed environment. Credentials are passed via env,
  never committed:

  ```bash
  UAT_EMAIL=you@example.com UAT_PASSWORD=... node scripts/uat.mjs
  # optional: UAT_BASE_URL=http://localhost:3000 UAT_SHOTS=/tmp/shots
  ```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
