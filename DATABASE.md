# Database

PostgreSQL via Supabase. **70 tables, 147 RLS policies, 189 foreign keys, 232
indexes, 69 triggers**, across 13 migrations in `supabase/migrations/`.

Every migration has been applied and verified against a real PostgreSQL 16
instance; `supabase/tests/security.test.sql` asserts the security properties
below against a live database with the application out of the loop.

---

## The shape of the model

The schema's whole job is to keep seven things separate that a listing portal
would collapse into one:

```text
                    ┌──────────────────────┐
                    │  property_passports  │  ← the physical property, forever
                    │  PROP-NCR-0000001    │
                    └──────────┬───────────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       property_addresses  property_media  property_documents
                             (+ amenities, nearby places,
                              verifications, price history)
                               │
                               ▼
                    ┌──────────────────────┐
                    │      listings        │  ← ONE AGENT'S OFFER
                    │  LIST-NCR-000123     │     (many per passport)
                    └──────────┬───────────┘
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
       listing_shares      leads            visits
       (agent network)  LEAD-NET-000123  VISIT-NCR-000123
              │                │                │
              │                └────────┬───────┘
              │                         ▼
              │              ┌──────────────────────┐
              └─────────────▶│        deals         │
                             │   DEAL-NCR-000456    │
                             └──────────┬───────────┘
                                        ▼
                         commission_calculations
                                        ▼
                         commission_distributions
                                        ▼
                            commission_ledger
                             COMM-NET-000789
```

A listing expiring does not delete the passport, its price history, its visit
history or its verification record. That accumulated history is the product.

---

## Table groups

| Migration | Tables | Purpose |
| --- | --- | --- |
| `…_extensions_and_enums` | — | 45 enums, 3 money domains, 5 extensions |
| `…_identity` | `profiles`, `roles`, `user_roles`, `agents`, `agent_verifications`, `agent_documents`, `agent_rera_records`, `customers`, `investors`, `investor_verifications` | Who everyone is |
| `…_property_passport` | `regions`, `projects`, `property_passports`, `property_addresses`, `property_media`, `property_documents`, `amenities`, `property_amenities`, `property_nearby_places`, `property_verifications`, `property_price_history`, `property_duplicate_candidates` | The physical asset |
| `…_listings` | `listings`, `listing_media`, `listing_status_history`, `listing_shares`, `listing_referrals`, `favorites`, `saved_searches` | Offers and the agent network |
| `…_demand_and_crm` | `customer_requirements`, `requirement_matches`, `leads`, `lead_events`, `contact_access_logs`, `crm_contacts`, `crm_tasks`, `crm_notes` | Demand side and CRM |
| `…_visits` | `visits`, `visit_assignments`, `visit_checkins`, `visit_feedback`, `visit_attributions` | Visit marketplace and evidence |
| `…_deals_and_commissions` | `deals`, `deal_participants`, `deal_events`, `deal_documents`, `commission_rules`, `commission_calculations`, `commission_distributions`, `commission_ledger`, `payments` | Money |
| `…_investor_module` | `investor_opportunities`, `investor_interests`, `agreements`, `exclusive_inventory`, `investor_positions` | Feature-flagged, legally gated |
| `…_platform` | `notification_templates`, `notifications`, `notification_preferences`, `reviews`, `disputes`, `dispute_evidence`, `dispute_events`, `audit_logs`, `analytics_events`, `admin_settings`, `feature_flags`, `api_keys`, `idempotency_keys` | Platform services |

---

## Key design decisions

### Reference codes are allocated in the database

`PROP-NCR-0000001`, `DEAL-NCR-000456`, `COMM-NET-000789`. Allocated by
`next_reference()` with a per-scope counter row locked on update, because only
the database can hand out a monotonic sequence safely under concurrency. A
`BEFORE INSERT` trigger fills the column, so application code never supplies one
(and the generated `Insert` types mark it optional for exactly that reason).

### Money is `numeric`, never float

`money_amount` is a domain over `numeric(14,2)` with a non-negative check, and
every money column carries an explicit `currency`. `commission_distributions`
additionally stores `amount_minor` (paise) as the **reconciliation column**: the
sum of `amount_minor` across a calculation equals the pool exactly, which is
directly assertable in SQL.

### Attribution logs are append-only

`lead_events`, `visit_checkins`, `deal_events`, `listing_status_history`,
`property_price_history`, `contact_access_logs` and `audit_logs` have no
`UPDATE` or `DELETE` policy — **and** those privileges are `REVOKE`d from `anon`
and `authenticated` outright, so a future permissive policy cannot silently make
history editable.

### Guard triggers enforce what RLS cannot

RLS is row-level; several rules here are column-level or transition-level:

| Trigger | Prevents |
| --- | --- |
| `agents_guard_self_promotion` | An agent writing their own badges, trust score, verification level or status |
| `listings_guard_self_approval` | An agent moving a listing to `VERIFIED`, or editing moderation columns |
| `shares_guard_response` | The requesting agent approving their own inventory-share request |
| `visits_guard_qualification` | An agent marking their own visit as qualified |
| `reviews_guard_response` | An agent editing the content of a review about them |
| `ledger_guard_transition` | Illegal ledger transitions (`PAID → CALCULATED`) |
| `ledger_guard_immutability` | Re-pricing an `APPROVED` or `PAID` ledger row |
| `exclusive_inventory_guard` | Exclusivity without an `ACTIVE` agreement |

These guards recognise a **platform context** (`auth.uid() is null`) so the
service-role client, migrations and seeds can legitimately write those columns
after running the domain rules. That is safe because RLS gives `anon` no
`UPDATE` path to these tables in the first place, so an anonymous request can
never reach a guard trigger.

### One structural legal guarantee

```sql
constraint agreements_active_requires_legal_review check (
  status <> 'ACTIVE' or legal_reviewed_at is not null
)
```

No exclusive-inventory agreement can go live without a recorded human legal
review. Not a convention, not a code path — a constraint.

---

## Row Level Security

Enabled **and forced** on all 70 tables. Deny by default.

| Actor | Can read |
| --- | --- |
| Anonymous | `VERIFIED` listings, their passports and public media; approved reviews; the `public_agents` view; reference data |
| Customer | Everything of their own; leads/visits/deals they are party to; their own contact-access log |
| Agent | Their own inventory, CRM, leads, assigned visits and money; inventory explicitly shared with them; **no bulk access to `customers` at all** |
| Investor | Their own positions, interests and agreements |
| Admin | Everything, scoped by admin sub-role for privileged writes |

Two tables have RLS enabled and **no policies at all** — `reference_counters`
and `idempotency_keys`. That is deliberate: they are service-role machinery, and
enabling RLS without a policy denies every client.

### The `public_agents` view

Agent profiles must be publicly readable, but `profiles` holds phone numbers and
email addresses and is locked to owner-and-admin. Rather than loosening RLS on a
PII table, `public_agents` is a `security_invoker = false` view exposing one
hand-picked column list. It deliberately omits `trust_score`, `response_rate`,
`conversion_rate`, `risk_score`, `complaint_count` and all contact details (§13).

---

## Indexes

232 indexes, chosen for the queries the product actually runs:

- **Search hot path** — a partial composite on
  `(city, locality, listing_type, property_type, price) WHERE status = 'VERIFIED'`,
  plus partial indexes on price, bedrooms, published date and coordinates. Every
  one is partial on `VERIFIED`, so the index only contains publicly visible rows.
- **Moderation queues** — partial indexes on the pending statuses only.
- **Attribution** — `(property_id, customer_id, ended_at DESC) WHERE is_qualified`,
  which is precisely the query the commission engine makes.
- **Fuzzy matching** — `pg_trgm` GIN indexes on listing title, locality and
  project name, backing both search and duplicate detection.
- **Array containment** — GIN indexes on service cities, localities and
  specialisations, used by agent discovery and the visit marketplace.
- **Uniqueness that matters** — one live exclusivity window per property; one
  primary photograph per property; one open lead per customer/listing/agent
  triple; one unit number per project/tower.

---

## Seed data

`supabase/seed.sql` produces the complete §66 demo scenario: 10 agents,
5 customers, 2 investors, 30 property passports, 40 listings (10 of them second
listings on an existing passport, so agent collaboration is visible), inventory
shares, requirements, leads, three qualified visits and one closed deal whose
commission distribution sums exactly to its pool.

Users are created by inserting into `auth.users`, so the seed exercises the real
`handle_new_user` trigger rather than bypassing it. Every row is flagged
`is_demo = true` and every name is prefixed `[Demo]`.
