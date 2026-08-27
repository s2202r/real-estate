# GetMeSpace

> A verified real-estate **inventory network** — not another listing portal.
> Customers, agents and investors collaborate around shared property passports,
> a site-visit marketplace, and a deterministic, auditable commission engine.

Built with Next.js 16 (App Router), TypeScript, Tailwind v4 and Supabase
(Postgres + Auth + Storage + RLS). Deploys to Vercel.

---

## What makes this different

A listing portal models one entity — "a property ad" — and sells the same lead
to five agents. This platform models what actually happens in a transaction.

| | Portal | This platform |
| --- | --- | --- |
| Unit of record | An advertisement | The **physical property** (`PROP-NCR-0000001`), permanently |
| History | Dies with the ad | Price, visit and verification history live on the passport |
| Duplicates | Five ads, three prices | Detected, queued, adjudicated by a human — never auto-merged |
| Agents | Compete over isolated inventory | Share inventory on recorded terms |
| Visits | "The agent will call you back" | Marketplace: nearby verified agents take the visit |
| Commission | Argued about after closing | Computed by a deterministic engine, shown to the paisa |
| Customer phone | Sold to everyone | Masked by default; every reveal is audited and visible to the customer |

### The nine differentiators, and where they live

1. **Property Passport** — `supabase/migrations/…_property_passport.sql`
2. **Verified inventory** — listing moderation + agent verification workflows
3. **Agent network** — `listing_shares`, `/agent/inventory`
4. **Demand marketplace** — `customer_requirements`, `/api/v1/requirements`
5. **Visit marketplace** — `visit_assignments`, `src/lib/actions/visits.ts`
6. **Deal attribution** — append-only `lead_events`, `visit_checkins`, `deal_events`
7. **Commission engine** — `src/lib/domain/commission.ts` (pure, 37 tests)
8. **Exclusive inventory** — `exclusive_inventory`, feature-flagged off pending legal review
9. **AI matching** — `src/lib/domain/matching.ts` (deterministic, explainable)

---

## Quick start

```bash
# 1 · Install
npm install

# 2 · Configure
cp .env.example .env.local     # then fill in your Supabase project values

# 3 · Database (requires the Supabase CLI)
supabase start
supabase db reset              # applies migrations, THEN seed data

# 4 · Run
npm run dev                    # http://localhost:3000
```

**No Supabase CLI?** Paste `supabase/schema.sql` into the Supabase SQL editor
and run it, then paste `supabase/seed.sql`. In that order — the seed only
inserts data and fails on an empty database.

Demo sign-in: `admin@demo.getmespace.test` / `DemoPassword123!`
(also `agent1..10@` and `customer1..5@` at the same domain).

Full instructions are in [SETUP.md](./SETUP.md).

### Verify

```bash
npm run verify   # typecheck + lint + unit tests
npm run build    # production build
```

Database-level security assertions (RLS, guard triggers, ledger immutability)
run separately against a live database:

```bash
psql "$DATABASE_URL" -f supabase/tests/security.test.sql
```

---

## Project layout

```text
src/
  app/
    (public)/          marketing site, search, property and agent pages
    (auth)/            sign in / register
    (customer)/        /dashboard      — customer
    (agent)/           /agent/*        — agent workspace
    (investor)/        /investor/*     — feature-flagged
    (admin)/           /admin/*        — operations console
    api/v1/            versioned REST surface for partners
  components/
    ui/                design-system primitives (owned source, Radix-based)
    shared/            PropertyCard, CommissionBreakdown, VerificationBadge…
    layout/            site and dashboard shells
  lib/
    domain/            PURE business rules — no I/O, no framework, 100% tested
    services/          use-cases: authorise → validate → persist → audit → notify
    providers/         notifications · ai · maps  (swappable)
    supabase/          client factories (browser / server / service-role)
    auth/              session + capability model
    security/          masking, rate limiting
    validation/        Zod schemas shared by forms, actions and API routes
supabase/
  migrations/          13 SQL migrations: 70 tables, 147 RLS policies
  seed.sql             demo data covering the full end-to-end scenario
  tests/               database security assertions
```

### The layering rule

`lib/domain` never imports from `lib/services`, `lib/supabase`, `lib/providers`
or `next/*`. It takes plain data and returns plain data. **This is enforced by
an ESLint rule**, not merely documented — it is what keeps commission maths
reproducible and auditable.

---

## Money

Three rules, enforced by construction:

1. Stored as `numeric(14,2)` with an explicit currency. Never `float`.
2. All arithmetic happens in **integer paise** inside `lib/domain/money.ts`.
3. Splits use the **largest-remainder method** — the parts sum *exactly* to the
   pool, to the paisa, with a stable tie-break so the result is identical on
   every run, machine and year.

`numeric` columns are typed as `string` in `src/types/database.ts` on purpose:
parsing them into a JavaScript number would reintroduce exactly the
floating-point error the money module exists to prevent.

---

## Security posture

Postgres **RLS is the authorisation boundary**; everything above it is defence
in depth. Highlights:

- The service-role key lives in one `import "server-only"` module — pulling it
  into a client bundle is a build error, not a review finding.
- Guard triggers stop an agent self-approving a listing, self-granting a badge,
  approving their own inventory-share request, or qualifying their own visit.
- `audit_logs`, `lead_events`, `visit_checkins` and `deal_events` have `UPDATE`
  and `DELETE` **revoked**, not merely unpolicied.
- A `PAID` ledger row cannot be reverted or re-priced — enforced by trigger.
- Exclusive-inventory agreements cannot reach `ACTIVE` without a recorded human
  legal review — a `CHECK` constraint, not a convention.

24 assertions in `supabase/tests/security.test.sql` verify these against a real
database with the application out of the loop. See [SECURITY.md](./SECURITY.md).

---

## Documentation

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Domain model, layering, risks, delivery phases |
| [DATABASE.md](./DATABASE.md) | Schema, relationships, RLS strategy, indexes |
| [COMMISSION_ENGINE.md](./COMMISSION_ENGINE.md) | The algorithm, models, worked example |
| [API.md](./API.md) | `/api/v1` reference |
| [SECURITY.md](./SECURITY.md) | Trust model and controls |
| [SETUP.md](./SETUP.md) | Local development |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Vercel + Supabase deployment |
| [docs/LEGAL_REVIEW.md](./docs/LEGAL_REVIEW.md) | **Ten open regulatory items** |

---

## Before production

`ENABLE_INVESTOR_MODULE` ships **`false`** and must stay that way until item L1
of [docs/LEGAL_REVIEW.md](./docs/LEGAL_REVIEW.md) is signed off by qualified
Indian counsel. A structure in which capital is placed against a property to
capture an exit spread can be characterised as an unregistered collective
investment scheme, an agreement to sell attracting stamp duty, or a benami
arrangement. It is implemented here as *configurable contractual marketing and
distribution rights*, and no agreement can go live without a recorded legal
review.

Nine further items — RERA registration, commission tax treatment, payment
custody, DPDP compliance, messaging consent and more — are listed in the same
register with their current implementation status.
