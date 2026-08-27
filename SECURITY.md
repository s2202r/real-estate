# Security

## Trust model

The browser is untrusted. The server is trusted only to the extent that it
authenticates the caller. **Postgres RLS is the authorisation boundary.** Every
other check is defence in depth.

```text
Browser ──▶ Middleware ──▶ Server Component / Action / Route ──▶ Supabase (RLS)
            (routing)       (capability checks + audit)          (enforcement)
```

If a bug in the app layer let a request through, RLS still refuses the row.

## Authentication

- Supabase Auth with cookie-based sessions via `@supabase/ssr`.
- Cookies are `httpOnly`, `secure` in production, `sameSite=lax`.
- `middleware.ts` refreshes the session on every request and gates route groups.
- Server code obtains identity with `supabase.auth.getUser()` (verified against
  the auth server), never by decoding a token client-side.

## Authorisation

Roles are rows in `user_roles`, not claims a client can set. One account may hold
several roles (`agent` + `investor`). Agent sub-roles — listing, sales, visiting,
referral — are **derived per deal** from participation records, never stored as
account types.

Admin sub-roles (`super_admin`, `operations_admin`, `verification_admin`,
`finance_admin`, `support_admin`, `content_admin`) map to capabilities in
`src/lib/auth/permissions.ts`. Capability checks are enforced server-side and
mirrored in RLS via `public.has_role()` / `public.is_admin()` helpers, which are
`SECURITY DEFINER` with a pinned `search_path`.

## The service-role key

- Exists only in `src/lib/supabase/admin.ts`.
- That module starts with `import "server-only"` — importing it into a client
  bundle fails the build.
- It is never referenced with a `NEXT_PUBLIC_` prefix, so it cannot be inlined
  into client JavaScript.
- It is used only for: admin moderation queues, the commission engine's
  transactional writes, seed/maintenance scripts, and cross-tenant reads that
  RLS legitimately forbids to the acting user.

## Customer privacy and contact masking

Customer phone/email are **never** returned to an agent by default.

- `mask()` in `src/lib/security/masking.ts` renders `+91 98••••••21`.
- Reveal is a server action: it checks that the agent owns an active lead for
  that customer, enforces a per-day quota (`CONTACT_REVEAL_DAILY_LIMIT`), writes
  a `contact_access_logs` row and an audit entry, then returns the value.
- The customer can see, in their dashboard, exactly which agents accessed their
  contact details and when.
- RLS on `customers` restricts contact columns to the owner and admins; agents
  read customers through a view that omits raw contact fields.

## Input validation

Every mutation validates with Zod **on the server**, in the service layer, before
touching the database — including mutations invoked from forms whose client-side
validation already passed. Client validation is a UX affordance only.

Money is re-derived server-side. A client may post a price; it may never post a
commission amount.

## File uploads

- Buckets: `property-media` (public read), `property-documents`,
  `agent-documents`, `user-documents`, `agreements` (all private),
  `avatars` (public), `marketing-assets` (public).
- Server-side validation of MIME type against an allow-list, extension/MIME
  agreement, and size caps (10 MB images, 200 MB video, 25 MB documents).
- Private buckets are read exclusively through **short-lived signed URLs** minted
  server-side after an authorisation check. No private object URL is ever
  rendered into HTML.
- Storage RLS policies scope object paths by owner id prefix.

## API hardening

- `/api/v1/*` handlers are wrapped by `withApi()`, which applies: method check,
  auth resolution, Zod body/query validation, rate limiting, idempotency-key
  replay protection on unsafe methods, structured error mapping, and a request id
  on every response.
- Rate limiting is keyed by user id (or IP for anonymous) with a fixed window.
  The in-memory limiter is a development default; production should point it at
  Upstash/Redis via the same interface.
- Errors returned to clients are shape-stable and never leak SQL, stack traces or
  internal ids.

## Audit logging

`audit_logs` is append-only: RLS grants `INSERT` only, and `UPDATE`/`DELETE` are
revoked for all application roles. Every verification decision, moderation
action, lead assignment, visit qualification, commission calculation/approval,
deal status change and admin action writes an entry with actor, action, entity,
before/after snapshot, IP and user agent.

## Financial safety

- `numeric(14,2)` storage; integer-paise arithmetic; no floats anywhere.
- All commission maths is server-side and deterministic.
- Ledger rows are immutable once `PAID`; corrections are reversal/adjustment
  entries.
- Deal closure and commission persistence run inside a single Postgres function
  so a partial write cannot leave a deal with half a distribution.

## Web hardening

- Security headers set in `next.config.ts`: `Strict-Transport-Security`,
  `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`,
  `Permissions-Policy`, and a `Content-Security-Policy`.
- React escapes by default; there is no `dangerouslySetInnerHTML` on
  user-supplied content. JSON-LD is the only serialised payload and is built from
  typed objects, not string concatenation.
- CSRF: mutations are Server Actions (origin-checked by Next.js) or `/api/v1`
  routes requiring an `Authorization` header, so a cross-site form post cannot
  authenticate.
- No secrets in the client bundle; only `NEXT_PUBLIC_*` values reach the browser.

## Pre-launch checklist

- [x] RLS enabled on every table in `public`
- [x] Auth-protected route groups
- [x] Server-side authorisation independent of the UI
- [x] Upload MIME/size validation
- [x] Signed URLs for private objects
- [x] API rate limiting
- [x] Zod validation on all mutations
- [x] Parameterised queries only (Supabase client)
- [x] XSS-safe rendering
- [x] CSRF-resistant mutation surface
- [x] Secure cookies
- [x] Append-only audit logs
- [x] PII masking + access logging
- [x] Secrets excluded from git
- [x] Service-role key server-only
- [ ] External penetration test (pre-production)
- [ ] DPDP consent + retention sign-off (see `docs/LEGAL_REVIEW.md` L5)

## Reporting

Report vulnerabilities privately to the address in `NEXT_PUBLIC_SUPPORT_EMAIL`.
Please do not open a public issue.
