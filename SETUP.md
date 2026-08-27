# Setup

## Requirements

- Node.js 20.9+ (22 LTS recommended)
- npm 10+
- [Supabase CLI](https://supabase.com/docs/guides/cli) for local development
- Docker (used by `supabase start`)

## 1 · Install

```bash
npm install
```

## 2 · Environment

```bash
cp .env.example .env.local
```

Fill in, at minimum:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...          # server only, never NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Everything else has a working default. The app is designed to render its public
shell with **no** Supabase credentials at all, so a first `vercel deploy` works
before the database is wired up — pages degrade to empty states rather than
crashing.

> `SUPABASE_SERVICE_ROLE_KEY` bypasses row level security. It must never be
> prefixed `NEXT_PUBLIC_`, committed, or referenced outside
> `src/lib/supabase/admin.ts`.

## 3 · Database

### With the Supabase CLI (recommended)

```bash
supabase start          # local Postgres, Auth, Storage, Studio
supabase db reset       # applies supabase/migrations, then supabase/seed.sql
```

`supabase start` prints the local URL and keys — copy them into `.env.local`.

### Against a hosted project

```bash
supabase link --project-ref <your-project-ref>
supabase db push                                    # migrations only
psql "$DATABASE_URL" -f supabase/seed.sql           # optional demo data
```

### With plain psql, no Supabase CLI

The migrations assume the Supabase-managed `auth` and `storage` schemas plus
the `anon`, `authenticated` and `service_role` roles exist. Against a bare
Postgres you must create those first; `supabase/tests/security.test.sql`
documents the shape they need. Then:

```bash
for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -f "$f"; done
psql "$DATABASE_URL" -f supabase/seed.sql
```

## 4 · Storage buckets

Created by migration `…_storage.sql`. Public: `property-media`, `avatars`,
`marketing-assets`. Private: `property-documents`, `agent-documents`,
`user-documents`, `agreements`.

Private objects are only ever served through short-lived signed URLs minted
server-side after an authorisation check.

## 5 · Run

```bash
npm run dev
```

| URL | Audience |
| --- | --- |
| `/` | Public site |
| `/properties` | Verified property search |
| `/dashboard` | Customer |
| `/agent/dashboard` | Agent workspace |
| `/admin` | Operations console |
| `/investor/dashboard` | Investor (404 unless `ENABLE_INVESTOR_MODULE=true`) |

## 6 · Demo accounts

`supabase/seed.sql` creates demo users at `*@demo.realestatenetwork.test`
(10 agents, 5 customers, 2 investors, 1 admin). Every seeded record carries
`is_demo = true` and every display name is prefixed `[Demo]`.

The seed does **not** set passwords — it inserts into `auth.users` directly, so
the trigger-driven sign-up path is exercised. For local sign-in, either set a
password through Supabase Studio, or register a fresh account at `/register`.

To grant yourself admin after registering:

```sql
insert into public.user_roles (user_id, role, admin_role)
select id, 'admin', 'super_admin' from public.profiles where email = 'you@example.com';
```

## 7 · Verify

```bash
npm run verify        # typecheck + lint + 195 unit tests
npm run build         # production build
npm run test:watch    # TDD loop
```

Database security assertions run against a live database:

```bash
psql "$DATABASE_URL" -f supabase/tests/security.test.sql
```

A non-zero exit means a security regression — RLS coverage, a guard trigger, or
ledger immutability has broken.

## 8 · Regenerating database types

After changing anything under `supabase/migrations`:

```bash
supabase gen types typescript --local > src/types/database.ts
# or, with no Supabase project available:
python3 scripts/generate-db-types.py
```

## Troubleshooting

**Pages render but no data appears.** Supabase credentials are missing or wrong.
The app degrades to empty states by design. Check `/api/v1/health`.

**"Administrative operations are unavailable".** `SUPABASE_SERVICE_ROLE_KEY` is
not set. Moderation, verification and commission calculation need it.

**RLS blocks a query you expected to work.** That is usually correct. Check the
policy in `…_rls_policies.sql` before adding an exception — the boundary is
meant to be tight.

**Investor routes return 404.** Expected. See `docs/LEGAL_REVIEW.md` item L1.
