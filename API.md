# API Reference

Base path: `/api/v1`

Every response is a JSON envelope: `{ "data": ... }` on success, or
`{ "error": { "code", "message", "details"? } }` on failure. Every response
carries an `x-request-id` header — quote it when reporting a problem.

## Authentication

Requests authenticate with the Supabase session cookie (browser) or a bearer
token (server-to-server). **Row Level Security applies to every endpoint**, so
an endpoint cannot return rows the caller is not entitled to, whatever
parameters are supplied.

Partner API keys (`api_keys`, hashed at rest with scopes and per-key rate
limits) are modelled in the schema for the external-API phase (§53); the routes
below currently authenticate via session.

## Cross-cutting behaviour

All routes wrapped by `withApi` share:

| Control | Behaviour |
| --- | --- |
| Validation | Zod on body and query. Failures return `400 invalid_request` with field details. |
| Rate limiting | Per user where authenticated, per IP otherwise. `x-ratelimit-*` headers on every response; `429` + `retry-after` when exceeded. |
| Idempotency | Send `Idempotency-Key` on unsafe methods; a replay returns the stored response with `idempotent-replay: true`. |
| Errors | Shape-stable. Internal failures return a generic `500 internal_error` — never SQL, table names or stack traces. |

## Status codes

`200` success · `400` invalid request · `401` unauthenticated ·
`403` forbidden / feature disabled · `404` not found · `409` conflict (state
does not permit the action) · `429` rate limited · `500` internal ·
`503` database not configured

---

## Properties

### `GET /api/v1/properties`

Public verified-property search.

| Query | Type | Notes |
| --- | --- | --- |
| `q` | string | Matches title, locality and city |
| `city`, `locality` | string | |
| `listingType` | `SALE\|RENT\|LEASE` | |
| `priceMin`, `priceMax` | number | Rupees |
| `bedroomsMin` | integer | |
| `sort` | `newest\|price_asc\|price_desc\|area_desc` | Default `newest` |
| `page`, `pageSize` | integer | `pageSize` max 50 |

Rate limit 120/min.

```bash
curl "$APP_URL/api/v1/properties?city=Noida&listingType=SALE&priceMax=15000000"
```

```json
{
  "data": [
    {
      "id": "…",
      "referenceCode": "LIST-NCR-000004",
      "title": "3 BHK Apartment in Sector 137, Noida",
      "price": "13500000.00",
      "currency": "INR",
      "propertyReference": "PROP-NCR-0000004",
      "verificationScore": 88
    }
  ],
  "meta": { "total": 42, "page": 1, "pageSize": 20, "totalPages": 3 }
}
```

### `GET /api/v1/properties/:id`

Accepts a listing UUID **or** a property passport reference
(`PROP-NCR-0000001`). Partners should store the passport code: it outlives any
individual listing.

---

## Listings (agent)

### `GET /api/v1/listings`

The agent's own inventory, including drafts and rejections. Requires an agent
profile. Not a second route to the public catalogue — RLS scopes it to the
caller.

### `POST /api/v1/listings/:id/submit`

Submits a draft for moderation. Returns `409` if the listing is not in a
submittable state.

There is deliberately **no publish endpoint**. Only an administrator can move a
listing to `VERIFIED`, and a database trigger enforces that independently of
this API.

### `POST /api/v1/listings/:id/share`

Requests access to another agent's inventory.

```json
{ "message": "I have a client actively looking in this locality." }
```

Creates a request only — approval is the owning agent's decision, and the
requester approving their own request is blocked by both RLS and a trigger.

### `POST /api/v1/listings/draft`

Drafts listing copy. Requires an agent profile; `403 feature_disabled` when
`ENABLE_AI_LISTING_ASSISTANT` is off. The response always carries
`requiresApproval: true` — nothing here publishes anything.

---

## Demand and matching

### `GET /api/v1/requirements`

The demand marketplace. Filter by `city`, `listingType`, `budgetMax`.

**Never returns customer identity.** RLS lets a verified agent discover an
`ACTIVE`, discoverable requirement, but the customer's name, phone and email
live in tables the agent cannot read. Discovery exposes the demand, not the
person.

### `GET /api/v1/matches?requirementId=…`

Scores verified listings against a requirement using the deterministic engine.

| Query | Notes |
| --- | --- |
| `requirementId` | UUID, required. RLS restricts this to the owner or an admin. |
| `minimumScore` | 0–100, default 50 |
| `limit` | max 50, default 20 |

```json
{
  "data": [
    {
      "listingId": "…",
      "score": 92,
      "breakdown": [
        { "dimension": "budget", "score": 100, "weight": 0.26, "explanation": "Within budget at ₹1,35,00,000." },
        { "dimension": "location", "score": 100, "weight": 0.22, "explanation": "In the preferred locality Noida Extension." }
      ],
      "algorithmVersion": "rules-v1"
    }
  ]
}
```

The `agentQuality` dimension is **stripped from customer-facing responses**
(§13): internal agent standing informs ranking but is never published, since it
would immediately become a target to game.

---

## Leads

### `GET /api/v1/leads`

Leads the caller is party to.

Customer contact details are **masked in the response regardless of the
`is_contact_unlocked` flag**. Unmasking is a separate, audited, quota-limited
action in the agent workspace; an API returning plaintext numbers in a list
would route around that control entirely.

```json
{
  "data": [
    {
      "reference_code": "LEAD-NET-000012",
      "stage": "VISIT_SCHEDULED",
      "customer": { "name": "Rahul M.", "phone": "98••••••01", "email": "r••••l@example.com", "isMasked": true }
    }
  ],
  "meta": { "note": "Contact details are masked. Unmasking is an audited action in the agent workspace." }
}
```

---

## Visits

### `GET /api/v1/visits`

Visits the caller is party to. Filter by `status` and `from` (`YYYY-MM-DD`).

### `POST /api/v1/visits/:id/accept`

Accepts an offered visit; the caller becomes the visiting agent. Returns `409`
if the offer has expired, been withdrawn, or the visit is already assigned.
Every other outstanding offer for that visit is withdrawn.

### `POST /api/v1/visits/:id/check-in`

```json
{ "actor": "AGENT", "latitude": 28.5041, "longitude": 77.3910, "accuracyMeters": 8 }
```

Coordinates are optional: a missing GPS fix is tolerated by the qualification
rules (basements exist), whereas a fix that contradicts the property location is
not.

---

## Deals and commission

### `GET /api/v1/deals`

Deals the caller participates in.

### `POST /api/v1/deals/:id/calculate-commission`

Runs the deterministic engine. Requires the `commission.calculate` capability.

| Query | Notes |
| --- | --- |
| `preview=true` | Compute **without** persisting — how an operator sees what a policy change would produce before committing to it |

```json
{
  "data": {
    "dealReference": "DEAL-NCR-000456",
    "commissionPool": "500000.00",
    "currency": "INR",
    "distributions": [
      { "role": "LISTING_AGENT", "amount": "100000.00", "amountMinor": 10000000, "sharePercent": 20 },
      { "role": "SALES_AGENT",   "amount": "200000.00", "amountMinor": 20000000, "sharePercent": 40 },
      { "role": "VISITING_AGENT","amount": "37500.00",  "amountMinor": 3750000,  "tier": "LATEST" },
      { "role": "VISITING_AGENT","amount": "18750.00",  "amountMinor": 1875000,  "tier": "PREVIOUS" },
      { "role": "VISITING_AGENT","amount": "18750.00",  "amountMinor": 1875000,  "tier": "EARLIER" },
      { "role": "PLATFORM",      "amount": "125000.00", "amountMinor": 12500000, "sharePercent": 25 }
    ],
    "explanation": [
      { "step": "pool", "detail": "Commission pool agreed manually for this deal.", "amount": "500000.00" },
      { "step": "role", "detail": "Listing agent 20% of pool", "amount": "100000.00" }
    ],
    "engineVersion": "commission-v1",
    "persisted": true
  }
}
```

The sum of `amountMinor` always equals the pool in paise. Exactly. The engine
refuses to return an unbalanced calculation rather than persisting one.

### `GET /api/v1/commissions`

The caller's own ledger. There are no parameters that select a subject, so this
endpoint cannot be made to disclose another agent's earnings.

---

## Search

### `POST /api/v1/search/parse`

```json
{ "query": "3BHK in Noida Extension under 1.5 crore close to metro" }
```

```json
{
  "data": {
    "interpretation": "for sale, 3 BHK, budget up to ₹1.5 Cr, in Greater Noida, around Noida Extension, close to a metro station",
    "confidence": 0.8,
    "filters": { "city": "Greater Noida", "locality": "Noida Extension", "listingType": "SALE", "bedrooms": "3", "priceMax": "15000000" }
  }
}
```

The interpretation is returned so the UI can show "here's what I understood"
**before** running the search (§35) — the customer corrects a misreading instead
of silently receiving wrong results. Returns an empty interpretation when
`ENABLE_AI_SEARCH` is off.

---

## Health

### `GET /api/v1/health`

Reports status, API version, whether the database is configured, and the feature
flag set. Deliberately reports only whether integrations are *configured*, never
any value — a health endpoint that echoes configuration is a reconnaissance
gift.

---

## Versioning

`/api/v1` is stable. Breaking changes ship as `/api/v2`. Additive fields are not
breaking; clients must tolerate unknown properties.

## Planned (§53)

Property and agent verification, location intelligence, document verification
and OCR, and fraud scoring are designed for but not yet exposed. The schema
(`api_keys` with scopes and per-key limits) and the handler (capability checks,
idempotency, rate limiting) already accommodate them.
