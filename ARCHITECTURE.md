# Architecture

> Product working name: **GetMeSpace** (`APP_NAME`, configurable — see `src/config/app.ts`).

## 0. Current repository state (as inspected)

At the time this document was authored the repository contained a bare `.git`
directory with **no commits and no source files**. Everything described below is
therefore greenfield; there was no existing application to migrate, adapt or
preserve.

## 1. What this platform is (and is not)

This is **not** a listing portal. A listing portal models one entity — "a
property ad" — and optimises for lead volume sold back to agents.

This platform models a **verified inventory network**. Its atomic unit is the
*physical property*, not the advertisement. Many agents may transact against the
same physical property; the platform tracks who contributed what, and pays them
deterministically.

Seven entities are kept strictly separate. Collapsing any two of them is the
single most common way this class of product fails:

| Entity | Meaning | Lifetime |
| --- | --- | --- |
| **Property** (Passport) | The physical asset. One flat = one row, forever. | Permanent |
| **Listing** | One agent's offer to transact that asset. | Weeks–months |
| **Requirement** | What a customer wants. Demand side. | Weeks–months |
| **Lead** | A customer↔property relationship owned by an agent. | Deal cycle |
| **Visit** | One physical/virtual inspection event. | Hours |
| **Deal** | The commercial transaction. | Deal cycle |
| **Commission** | Money owed to a participant of a deal. | Permanent (ledger) |

A property has many listings over its life (different agents, different years,
different prices). A listing that expires does not delete the property, its price
history or its visit history. That accumulated history *is* the product.

## 2. Stack

| Concern | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) | Server Components keep sensitive data server-side by default. |
| Language | TypeScript 5.9, `strict` | Money and permissions are not places for `any`. |
| UI | Tailwind CSS v4 + shadcn-style primitives on Radix | Owned source, no runtime theme service, accessible primitives. |
| Icons | lucide-react | |
| Data | Supabase Postgres + Auth + Storage + RLS | Row-level authorisation lives with the data, not the UI. |
| Validation | Zod v4 | One schema reused for form, server action and REST route. |
| Tests | Vitest (unit/integration), Playwright (E2E, optional) | |
| Hosting | Vercel | |

### Why Server Components and Server Actions rather than a separate API service

Every mutation that touches money, attribution or verification runs on the
server, inside a request the user cannot forge. A separate Node service would add
an extra network hop, an extra deployment, an extra auth boundary and no
security benefit — the trust boundary is Postgres RLS either way. A versioned
REST surface (`/api/v1/*`) exists *in addition*, for partners and future mobile
clients, and shares the exact same domain layer.

## 3. Layering

```text
┌─────────────────────────────────────────────────────────────┐
│ app/            Route handlers, pages, server actions        │  ← thin
├─────────────────────────────────────────────────────────────┤
│ components/     Design system + feature components           │
├─────────────────────────────────────────────────────────────┤
│ lib/services/   Use-cases. Authorise → validate → persist →  │  ← policy
│                 audit → notify. The only layer allowed to    │
│                 use the service-role client.                 │
├─────────────────────────────────────────────────────────────┤
│ lib/domain/     PURE functions. No I/O, no Supabase, no      │  ← rules
│                 Date.now() passed implicitly. 100% testable. │
│                 commission · attribution · matching ·        │
│                 duplicate detection · scoring · money        │
├─────────────────────────────────────────────────────────────┤
│ lib/supabase/   Client factories (browser / server / admin)  │
│ lib/providers/  notifications · ai · maps  (swappable)       │
├─────────────────────────────────────────────────────────────┤
│ Supabase Postgres — RLS is the real authorisation boundary   │  ← truth
└─────────────────────────────────────────────────────────────┘
```

**The invariant:** `lib/domain` never imports from `lib/services`,
`lib/supabase`, `next/*` or any provider. It takes plain data and returns plain
data. This is what makes commission maths auditable and reproducible: given the
same inputs, five years apart, it returns the same rupees.

## 4. Money

Three rules, enforced by construction:

1. **Storage** — `numeric(14,2)` columns with an explicit `currency` column
   (default `INR`). Never `float`/`double precision`.
2. **Arithmetic** — all computation happens in **integer minor units (paise)**
   inside `lib/domain/money.ts`. Values cross the DB boundary through
   `toMinor()` / `fromMinor()`. There is no code path where a rupee amount is
   added, multiplied or split as a JavaScript float.
3. **Splitting** — percentage splits use the **largest-remainder method** with a
   stable tie-break on participant order. This guarantees the parts sum *exactly*
   to the pool, to the paisa, with no drift and no "rounding account".

Client-supplied money is never trusted. The browser may *display* a computed
commission; the server always recomputes it before persisting.

## 5. Authorisation model

Three enforcement layers, all of which must pass:

1. **Middleware** — session refresh and coarse route gating (`/agent/*` requires
   an agent role). Convenience only; never the security boundary.
2. **Service layer** — explicit capability checks (`assertCanModerateListing`)
   before any privileged mutation, and audit-log writes after.
3. **Postgres RLS** — the actual boundary. Even if 1 and 2 were bypassed, a
   customer's token cannot read another customer's phone number, and an agent's
   token cannot read a lead they do not own or a commission that is not theirs.

Roles live in `user_roles` (many-to-many), so one account can be an agent *and*
an investor. Agent *sub-roles* (listing / sales / visiting / referral) are **not**
account types — they are derived per-deal from participation records, exactly as
§3 of the brief requires.

The service-role key is confined to `lib/supabase/admin.ts`, which begins with
`import "server-only"` — importing it from a client component is a build error,
not a code-review finding.

## 6. Attribution

Attribution is **append-only and event-sourced**. `lead_events`, `visit_checkins`,
`deal_events` and `listing_status_history` are insert-only; the current state is a
projection. When a commission is later disputed, the platform can replay exactly
who did what, when, and with what evidence.

A visit only becomes `QUALIFIED` — and therefore only earns money — when the
qualification predicate in `lib/domain/attribution.ts` passes: agent check-in,
customer confirmation (OTP or in-app), a minimum dwell time, and, when the
listing is geofenced, a GPS fix inside the fence. This predicate is pure and
unit-tested, because it is the gate on the money.

## 7. Configurable commission policy

Percentages are **data, not code**. `commission_rules` rows carry a policy
document (participant shares, visit-pool distribution model, caps, floors,
effective dates). The engine resolves the active policy at deal-close time and
**snapshots it into the calculation record**, so a later policy edit can never
silently change a historical payout. Corrections are made with reversal and
adjustment entries, never by mutating a paid ledger row.

Supported visit-pool models (all data-driven): `LATEST_WEIGHTED`, `WEIGHTED_SCORE`,
`EQUAL`, `CUSTOM`.

## 8. Provider abstractions

`lib/providers/*` define interfaces first and ship a working default:

- **notifications** — `NotificationChannel` interface; in-app (Postgres) and
  console/email adapters implemented; SMS, WhatsApp and Push adapters are typed
  stubs behind feature flags. Business logic dispatches *events*, never
  provider calls.
- **ai** — `AiProvider` interface with a deterministic `RuleBasedProvider`
  default, so listing assistance and NL search work with no API key and no
  vendor lock-in. OpenAI/Anthropic adapters slot in via env.
- **maps** — `MapProvider` interface; Google adapter reads keys from env. No key
  is ever hard-coded, and the server-side key is distinct from the browser key.

AI never decides money. It drafts copy (agent must approve) and parses search
text. That is the whole remit.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Commission disputes destroy agent trust | Deterministic engine + stored calculation snapshot + per-paisa breakdown shown in UI + dispute workflow. |
| Visit fraud (fake visits farming commission) | Multi-signal qualification: dual check-in, OTP, dwell time, geofence, outcome recording. |
| Property duplication fragments the passport | Duplicate detection on submit; admin adjudicates; never auto-merges. |
| Customer PII leaking to the whole agent network | Contact masking by default; reveal is an authorised, audited, rate-limited action. |
| Cold-start (no inventory, no agents) | Demand marketplace lets customers post requirements before supply exists. |
| Investor module legal exposure | Ships **disabled**; see §10 and `docs/LEGAL_REVIEW.md`. |
| Vendor lock-in | Provider interfaces for AI, maps, messaging. |

## 10. Legal / regulatory review required before production

**These are flagged for qualified Indian legal counsel. They are not engineering
decisions and must not be treated as such.** Full detail in
`docs/LEGAL_REVIEW.md`.

1. **Investor / exclusive-inventory module.** A "pay 25%, resell at a markup"
   arrangement may be characterised as an unregistered collective investment
   scheme, an agreement to sell attracting stamp duty, or a benami arrangement.
   It is implemented as *configurable contractual marketing/distribution rights*,
   is **off by default** (`ENABLE_INVESTOR_MODULE=false`), and must not be
   enabled until counsel approves the agreement templates and money flow.
2. **RERA agent registration** (state-specific; e.g. UP-RERA, HRERA). Advertising
   or brokering through unregistered agents carries penalties. RERA capture and
   verification exists; enforcement policy is a business decision.
3. **Commission sharing** with unregistered persons, plus **GST on brokerage**
   and **TDS u/s 194H** — the ledger records gross amounts; tax treatment is out
   of scope and must be configured with a finance advisor.
4. **DPDP Act 2023** — consent capture, purpose limitation, data-principal
   rights, retention, breach notification. Contact masking and access logging are
   implemented as the technical baseline.
5. **Payments.** The platform must not pool or hold third-party funds without an
   RBI Payment Aggregator licence. The ledger records *obligations*; settlement
   is delegated to a licensed PG/escrow.
6. **TRAI DLT** registration for transactional SMS and **WhatsApp Business
   Policy** template approval before those channels are enabled.
7. **Consumer Protection (E-Commerce) Rules 2020 / IT Rules 2021** — grievance
   officer, takedown timelines, seller information display.
8. **Valuation and price-intelligence claims** must carry disclaimers and must
   not be presented as a professional valuation.
9. **Document verification** — OCR/AI output is a *risk signal only*. The
   platform must never assert legal authenticity of a title document.

## 11. Delivery phases

- **MVP (this build)** — passport, listings + moderation, agent verification,
  search, requirements, leads with masking, visit marketplace with qualification,
  deals, commission engine + ledger, admin operations, audit, notifications.
- **Phase 2** — investor module (post-legal), AI ranking, WhatsApp/SMS, marketing
  kit, virtual tours, location/price intelligence.
- **Phase 3** — document OCR and fraud detection, automated RERA verification,
  valuation, NRI mode, finance/insurance/legal/interiors marketplaces, partner API.

---

## Progressive web app

The app is installable: `app/manifest.ts` declares it, `public/sw.js` is the
service worker, and `components/pwa/` registers it and offers the install.

The caching policy is a privacy decision before it is a performance one.

| Cached | Not cached |
| --- | --- |
| The offline page and the icons (precached on install) | **All HTML.** Every page is either personalised or changes through the day |
| `/_next/static/*`, which is content-hashed and immutable | `/api/*` and `/auth/*` — per-session by definition, and tokens must not touch disk |
| | Cross-origin requests, including listing photography |
| | Anything that is not a GET |

Nothing personal is written to the device. A navigation goes to the network
and falls back to the offline page only when the network is genuinely
unavailable, so a cached page can never show one visitor another's data, or a
listing that has since been suspended.

Bumping `VERSION` in `public/sw.js` invalidates every cache it owns; the
worker deletes caches it no longer recognises on activate.

---

## Site-wide location

The header carries a city -> locality -> project selector whose choice applies
across the site: search, the agent directory and the home page's featured
inventory all read it.

It lives in a cookie (`gms_location`), not the URL, because the choice outlives
any one page — someone who picks Noida expects the agent directory to be about
Noida too. `lib/location/scope.ts` holds the pure logic (validation,
precedence, labelling) so the client picker and the server pages share one
definition; `lib/location/server.ts` reads the cookie.

Two rules matter:

- **The URL wins.** `/properties?city=Mumbai` shows Mumbai whatever the header
  says, so a shared link cannot mean different things to different people. The
  scope only fills in what the URL left unsaid.
- **The cookie is user input.** It is validated exactly like a query string:
  the city must be one the platform serves, a locality without a city is
  dropped, a project id must look like a uuid, and free text is length-capped
  before it reaches a query.

Projects filter through the property passport, which is where `project_id`
lives, so that query uses an inner join — with the default embed PostgREST
filters the embedded rows and returns every listing regardless.
