# Legal & Regulatory Review Register

**Status: OPEN — required before production launch in India.**

This register exists because several product mechanics in the brief have legal
consequences that engineering cannot resolve. Nothing here is legal advice. Each
item names what the platform does today, what the exposure is, and what a
qualified Indian advisor must decide.

Engineering rule of thumb applied throughout: **where a mechanic is legally
uncertain, it is implemented as configurable and shipped disabled**, rather than
implemented as an unconditional business rule.

---

## L1 — Investor / "exclusive inventory" module  ·  Severity: HIGH  ·  Blocks launch

**The brief's example.** Investor pays ₹25,00,000 against a property whose seller
price is ₹1,00,00,000, targets an exit at ₹1,10,00,000, and captures the spread.

**Why it was not built that way.** A literal implementation risks
characterisation as:

- an **unregistered collective investment scheme** (SEBI) if pooled or offered
  to multiple passive investors;
- an **agreement to sell** attracting **stamp duty** and, in several states,
  compulsory registration;
- a **benami transaction** where the investor funds a purchase held in another's
  name (Benami Transactions (Prohibition) Amendment Act, 2016 — criminal);
- **RERA §3** exposure if the arrangement resembles pre-launch inventory sale;
- income characterised as **business income / capital gains** with GST
  implications on the spread.

**What is implemented.** An `exclusive_inventory` record carrying a *configurable
agreement type* — `EXCLUSIVE_MARKETING_RIGHTS`, `INVENTORY_RESERVATION`,
`DISTRIBUTION_RIGHTS`, `CONTRACTUAL_RIGHTS` — with agreement dates, capital
amount, target exit price, expected margin, platform fee and investor economics
as data. No transfer of property interest is modelled or asserted. The module is
gated by `ENABLE_INVESTOR_MODULE`, default `false`.

**Required decisions.** Which agreement type (if any) is lawful; the template
contract; whether investor capital may touch platform-controlled accounts at all;
tax treatment of the spread; disclosure obligations to the seller and to the
end customer.

---

## L2 — RERA agent registration  ·  Severity: HIGH

Most states require a real-estate agent to be registered (e.g. RERA §9) before
facilitating a transaction in a registered project, with penalties under §62 for
non-registration. State rules differ materially (UP-RERA, HRERA, MahaRERA…).

**Implemented.** `agent_rera_records` (number, state, validity, documents),
admin verification workflow, a `RERA_VERIFIED` badge that **only an admin can
grant** — never self-claimed — and per-listing RERA fields.

**Required decisions.** Whether unregistered agents may transact at all on the
platform, or only list; whether the platform is itself an agent requiring
registration; state-wise rollout gating; advertisement disclosure format
(RERA number in every ad is mandatory in several states).

---

## L3 — Commission sharing, GST, TDS  ·  Severity: MEDIUM-HIGH

The commission engine splits a pool across listing agent, sales agent, visiting
agents, referrer, investor and platform.

**Exposure.** GST on brokerage services; TDS under §194H on commission payouts;
sharing brokerage with unregistered persons in states that restrict it; the
platform's own status as principal vs. intermediary.

**Implemented.** The ledger records **gross obligations** with currency, rule
snapshot and audit trail. It deliberately does **not** compute tax.

**Required decisions.** Gross-vs-net convention, who raises the invoice, TDS
withholding responsibility, GST registration thresholds for agents.

---

## L4 — Payments and fund flow  ·  Severity: HIGH

The platform must not pool, hold or route third-party funds without an RBI
**Payment Aggregator / Payment Gateway** authorisation. Escrow of booking amounts
has its own requirements.

**Implemented.** `payments` records a *reference* to an external settlement
(processor, reference id, status). No wallet, no balance, no custody.

**Required decisions.** PA/PG partner, escrow structure for booking amounts,
refund and chargeback policy, PMLA/KYC obligations if custody is ever added.

---

## L5 — Personal data (DPDP Act, 2023)  ·  Severity: HIGH

Customer contact details, KYC documents, location traces from visit check-ins and
identity documents are all personal data; KYC and ID documents are sensitive.

**Implemented.** Contact masking by default; reveal is an authorised, rate-limited
and **logged** action (`contact_access_logs`); private storage buckets with signed
URLs; RLS isolation; append-only audit trail; explicit consent columns.

**Required decisions.** Notice and consent wording, retention schedule, data
principal rights (access/correction/erasure) SLA, grievance officer appointment,
breach notification runbook, cross-border transfer position (Supabase region
choice), processor agreements.

---

## L6 — Visit GPS and location tracking  ·  Severity: MEDIUM

Geofenced check-in captures the location of both customer and agent.

**Required decisions.** Consent text at check-in, retention of coordinates,
whether precise coordinates may be shown to counterparties (currently they are
not — only a pass/fail geofence result is exposed).

---

## L7 — Price intelligence and valuation  ·  Severity: MEDIUM

`FAIR PRICE / BELOW MARKET / ABOVE MARKET` is a statistical comparison against
comparable listings, not a valuation.

**Implemented.** Every price-intelligence output carries a mandatory disclaimer
and its sample size; the platform never emits a rupee "valuation" figure.

**Required decisions.** Disclaimer wording; whether registered-valuer rules are
implicated if the feature is extended.

---

## L8 — Document verification and OCR  ·  Severity: MEDIUM (Phase 3)

**Non-negotiable engineering rule already encoded:** AI/OCR output is a *risk
signal* attached to a document, never an assertion of legal authenticity of title.
UI copy must never imply the platform has verified ownership.

---

## L9 — Intermediary status, reviews and takedown  ·  Severity: MEDIUM

IT Rules 2021 due diligence and Consumer Protection (E-Commerce) Rules 2020:
grievance officer, published response timelines, seller information, no unfair
trade practice, no fake reviews.

**Implemented.** All reviews are moderated before publication; anonymous public
accusations are not permitted; disputes have a formal workflow with admin
decisions and audit history.

**Required decisions.** Grievance officer details, published SLAs, takedown
procedure, terms of service and platform liability position.

---

## L10 — Messaging consent  ·  Severity: MEDIUM

Transactional SMS requires **TRAI DLT** registration of headers and templates;
WhatsApp requires approved templates and opt-in under the WhatsApp Business
Policy.

**Implemented.** Channel adapters are typed stubs behind `ENABLE_SMS` /
`ENABLE_WHATSAPP`, both default `false`; per-user, per-channel consent columns
exist on the notification preferences.

---

## Sign-off

| Item | Owner | Counsel | Decision | Date |
| --- | --- | --- | --- | --- |
| L1 Investor module | | | ☐ | |
| L2 RERA | | | ☐ | |
| L3 Commission tax | | | ☐ | |
| L4 Payments | | | ☐ | |
| L5 DPDP | | | ☐ | |
| L6 Location | | | ☐ | |
| L7 Valuation | | | ☐ | |
| L8 Documents | | | ☐ | |
| L9 Intermediary | | | ☐ | |
| L10 Messaging | | | ☐ | |

`ENABLE_INVESTOR_MODULE` must remain `false` until L1 is signed off.
