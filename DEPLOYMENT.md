# Deployment

Target: **Vercel** (application) + **Supabase** (database, auth, storage).

---

## 1 · Supabase project

1. Create a project at [supabase.com](https://supabase.com). Choose a region
   close to your users — for an India-first launch that is `ap-south-1`
   (Mumbai), which also matters for the data-residency question in
   `docs/LEGAL_REVIEW.md` L5.
2. Apply migrations:

   ```bash
   supabase link --project-ref <project-ref>
   supabase db push
   ```

3. Verify the security posture against the live database **before** any real
   traffic:

   ```bash
   psql "$DATABASE_URL" -f supabase/tests/security.test.sql
   ```

   A non-zero exit means RLS coverage, a guard trigger or ledger immutability
   has regressed. Do not deploy past a failure here.

4. Confirm storage buckets exist (created by `…_storage.sql`) and that the four
   private buckets are **not** public.

5. Configure Auth → URL Configuration:
   - Site URL: `https://getmespace.in`
   - Redirect URLs: `https://getmespace.in/auth/callback`
   - Enable email confirmations for production.

---

## 2 · Vercel project

Import the repository. Framework preset: Next.js. Build command `npm run build`,
output handled automatically.

### Environment variables

| Variable | Scope | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All | ✅ | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | ✅ | |
| `SUPABASE_SERVICE_ROLE_KEY` | **Production/Preview only** | ✅ | Bypasses RLS. Never `NEXT_PUBLIC_`. |
| `NEXT_PUBLIC_APP_URL` | All | ✅ | Canonical URLs, OG tags, auth redirects |
| `NEXT_PUBLIC_APP_NAME` | All | | Branding is configurable |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | All | | Restrict by HTTP referrer |
| `GOOGLE_MAPS_API_KEY` | Server | | Restrict by IP — a **different** key |
| `MAP_PROVIDER` | Server | | `google` or `none` |
| `AI_PROVIDER`, `AI_PROVIDER_API_KEY`, `AI_MODEL` | Server | | Defaults to the rule-based provider |
| `EMAIL_PROVIDER`, `EMAIL_PROVIDER_API_KEY`, `EMAIL_FROM` | Server | | `console` logs instead of sending |
| `ENABLE_INVESTOR_MODULE` | Server | | **Must remain `false`** until legal sign-off |
| `ENABLE_*` | Server | | See `.env.example` |
| `CONTACT_REVEAL_DAILY_LIMIT` | Server | | Default 25 |
| `VISIT_GEOFENCE_RADIUS_METERS` | Server | | Default 200 |
| `VISIT_MIN_DURATION_MINUTES` | Server | | Default 10 |

> Set `SUPABASE_SERVICE_ROLE_KEY` on Production and Preview only. It should not
> exist in a local `.env` that might be shared.

---

## 3 · Pre-deploy checklist

```bash
npm run verify     # typecheck + lint + 195 unit tests
npm run build      # production build
```

- [ ] `supabase/tests/security.test.sql` passes against the target database
- [ ] `ENABLE_INVESTOR_MODULE=false` unless L1 is signed off
- [ ] Grievance officer populated in `admin_settings`
      (`platform.grievance_officer`) — required under the Consumer Protection
      (E-Commerce) Rules 2020 and IT Rules 2021
- [ ] `platform.support_email` set
- [ ] At least one `super_admin` granted
- [ ] Google Maps keys restricted (referrer for browser, IP for server)
- [ ] Email provider configured — `console` silently drops mail in production
- [ ] Commission rules reviewed in `/admin/commissions`
- [ ] `NEXT_PUBLIC_APP_URL` matches the real domain (canonical URLs and
      sitemap depend on it)

---

## 4 · Post-deploy verification

```bash
curl https://getmespace.in/api/v1/health
curl https://getmespace.in/robots.txt
curl https://getmespace.in/sitemap.xml
```

Then manually confirm the trust boundary holds in production:

1. Signed out, `/dashboard` redirects to `/login`.
2. Signed out, `/api/v1/leads` returns `401`.
3. As a customer, `/admin` redirects to `/unauthorized`.
4. As an agent, another agent's draft listing is not visible.
5. A rejected listing does not appear in public search.

---

## 5 · Production hardening

**Rate limiting.** The bundled limiter is in-memory, so on Vercel each
serverless instance keeps its own counter and the effective limit is
per-instance — an abuse speed bump, not a hard guarantee. For production,
implement `RateLimiter` against Upstash/Redis and swap it with
`setRateLimiter()`; no caller changes.

**Error monitoring.** `SENTRY_DSN` is read but no SDK is bundled. Add your
provider and wire it into the `console.error` sites in `lib/api/handler.ts` and
`lib/services/audit.ts`.

**Payments.** `payments` records a *reference* to settlement performed by a
licensed processor. The platform holds no funds. Do not add custody without an
RBI Payment Aggregator authorisation (`docs/LEGAL_REVIEW.md` L4).

**Backups.** Enable point-in-time recovery on Supabase. The commission ledger
and audit log are the records you cannot reconstruct.

**Scheduled work.** Visit-offer expiry, listing expiry and re-verification
reminders are modelled in the schema (`expires_at`, `next_verification_at`) but
have no scheduler attached. Add Vercel Cron or Supabase scheduled functions.

---

## 6 · Rollback

Application: promote the previous Vercel deployment.

Database: migrations are forward-only. Roll back with a new migration that
reverses the change. **Never** hand-edit `commission_ledger` or `audit_logs` to
undo something — that is exactly what the immutability guarantees exist to
prevent. Correct with reversal and adjustment entries.
