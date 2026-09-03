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

> **Status note, added when the investor module was switched on.**
> `ENABLE_INVESTOR_MODULE` now defaults to **true**, at the operator's
> instruction. L1 below is **not** thereby closed: the module is live and the
> advice has not been taken. The protection that does not depend on the flag is
> the `agreements_active_requires_legal_review` CHECK constraint — no
> exclusive-inventory agreement can reach ACTIVE without a recorded human legal
> review, whatever the flag says.

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

---

## L8 — The published policy documents  ·  Severity: HIGH  ·  Blocks launch

**What exists.** Seven documents at `/terms`, `/privacy`, `/cookies`,
`/disclaimer`, `/refunds`, `/agent-terms` and `/grievance-redressal`, listed at
`/legal`, written from what the platform actually does — review before
publication, badges granted never self-claimed, contact reveal logged and
capped, twelve-hour visit notice, customer-confirmed visits, a deterministic
versioned commission engine, paid ledger entries never rewritten.

**What they are.** Drafts by an engineer, describing accurately what the
software does. They are not legal advice and have not been reviewed by anyone
qualified in Indian law. Publishing them unchanged is a decision, not a default.

**Company particulars are deliberately not written into them.** Registered
address, LLPIN, GSTIN, grievance officer and jurisdiction come from environment
configuration (`NEXT_PUBLIC_LEGAL_*`, `NEXT_PUBLIC_GRIEVANCE_*`). Anything unset
renders as a visible gap — `[registered address — not yet published]` — rather
than as an invented value, and `missingLegalParticulars()` reports the gaps
through `/api/v1/health`. An invented address is a false statement in a document
users are asked to rely on; a gap is merely incomplete.

**Two particulars are withheld by decision, not by oversight.**

- **No postal address is published.** Every sentence that would have carried one
  is written to read correctly without it. The Consumer Protection
  (E-Commerce) Rules, 2020 require an e-commerce entity to display the address
  of its headquarters and registered office; withholding it is a decision the
  company has taken and an advisor should be asked to confirm.
- **The grievance route names an office, not an individual.** Rule 3(2)(a) of
  the IT Rules, 2021 asks for the *name* and contact details of the Grievance
  Officer. "Grievance Office" is a true and usable answer for a complainant,
  and it is not the answer the Rule asks for. Setting
  `NEXT_PUBLIC_GRIEVANCE_OFFICER` publishes a name everywhere it belongs.

Neither is reported as a gap by `missingLegalParticulars()`, precisely because
they are choices; the registration number and the jurisdiction still are.

**Required decisions.**

0. **The two withheld particulars above** — whether the exposure is acceptable.
1. **Intermediary status.** Whether the platform is an intermediary under
   §79 of the IT Act, and whether the safe harbour survives the editorial acts
   it performs — reviewing listings before publication, editing them, awarding
   badges. This determines how much of the liability position holds.
2. **Limitation of liability.** The cap in the Terms (greater of fees paid and
   ₹10,000) is a placeholder. Indian courts read these down, and the Consumer
   Protection Act, 2019 constrains what may be excluded against a consumer.
3. **Jurisdiction clause.** Exclusive jurisdiction is unenforceable against a
   consumer in several readings; confirm what to state.
4. **DPDP retention periods.** Seven and eight years are asserted in the Privacy
   Policy from tax and limitation practice. Confirm each against the obligation
   that actually drives it, and confirm the position that audit and
   contact-access logs are not erasable on request.
5. **Consent notice.** The DPDP Act requires an itemised notice at the point of
   collection, in English and in the Eighth Schedule languages on request. The
   registration checkbox links to the policy; whether that discharges the
   obligation needs deciding.
6. **RERA advertisement disclosure.** Which state's format applies to a listing
   page, and whether the disclaimer discharges it.
7. **Commission and GST.** Whether the platform's share is a brokerage service
   attracting GST at the platform level, and the TDS position on agent payouts.
8. **Refund timescales.** 7–10 working days and a 30-day claim window are
   drafted; confirm against the payment aggregator's own rules and any RBI
   requirement.
9. **Grievance timescales.** 24-hour acknowledgement, 15-day resolution and
   24-hour takedown of manifestly unlawful content follow the IT Rules, 2021.
   Confirm they match what operations can actually sustain — a published
   timescale that is missed is worse than a longer one that is met.

**Until this is signed off**, the documents should be treated as a description
of the product's behaviour rather than as an enforceable agreement.
