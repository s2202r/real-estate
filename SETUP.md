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

> **Order matters.** `seed.sql` only inserts demo data — it does not create
> tables. Running it first fails with
> `relation "public.user_roles" does not exist`. Apply the schema, then the seed.

### With the Supabase CLI (recommended)

```bash
supabase start          # local Postgres, Auth, Storage, Studio
supabase db reset       # applies supabase/migrations, then supabase/seed.sql
```

`supabase start` prints the local URL and keys — copy them into `.env.local`.

### Against a hosted project, with the CLI

```bash
supabase link --project-ref <your-project-ref>
supabase db push                                    # migrations only
psql "$DATABASE_URL" -f supabase/seed.sql           # optional demo data
```

### Through the Supabase SQL editor, no CLI

Pasting thirteen migration files in the right order is error-prone, so a
consolidated file is generated for exactly this:

1. Paste **`supabase/schema.sql`** into the SQL editor and run it.
   (4,300 lines — the whole schema in dependency order.)
2. Paste **`supabase/seed.sql`** and run it. Optional; demo data only.

Both files refuse to run in the wrong order or twice, with a message that says
what to do instead. `supabase/migrations/` remains the source of truth;
`schema.sql` is a generated convenience, rebuilt with `bash scripts/build-schema.sh`.

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
| `/how-it-works` | Network guide — agents, investors and admins only |
| `/dashboard` | Customer |
| `/agent/dashboard` | Agent workspace |
| `/admin` | Operations console |
| `/investor/dashboard` | Investor (404 unless `ENABLE_INVESTOR_MODULE=true`) |

## 6 · Demo accounts

`supabase/seed.sql` creates 28 sign-in-ready accounts, 20 verified agents, 90
property passports and 130 listings (121 of them live) across all ten
supported cities, including commercial space and plots. Every seeded record
carries `is_demo = true` and every display name is prefixed `[Demo]`.

| Email | Role |
| --- | --- |
| `admin@demo.getmespace.test` | Admin (super_admin) |
| `agent1@…` … `agent20@…` | Agents (agent1 and agent4 carry the full transaction story) |
| `customer1@…` … `customer5@…` | Customers |
| `investor1@…`, `investor2@…` | Investors (module disabled by default) |

**Password for all of them: `DemoPassword123!`**

> Development only. These are real bcrypt-hashed credentials on confirmed
> accounts — never seed them into a database that faces the internet.

The seed writes complete GoTrue records: hashed password, `authenticated`
aud/role, confirmed email, empty-string (never null) token columns, and a
matching `auth.identities` row. A bare
`insert into auth.users (id, email, raw_user_meta_data)` inserts successfully
but produces accounts that cannot sign in, which is why the seed uses a helper.

Profiles, roles and agent/customer records are still created by the real
`handle_new_user` trigger, so the sign-up path is exercised rather than bypassed.

To grant yourself admin after registering your own account:

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

**`relation "public.user_roles" does not exist` when running the seed.** The
migrations have not been applied. Run `supabase db push`, or paste
`supabase/schema.sql` into the SQL editor first.

**`type "app_role" already exists` when running the schema.** `schema.sql`
creates types and tables outright, so it cannot be applied on top of itself.
Either the schema is already installed and you should skip to `seed.sql`, or
you want to start over — run `supabase/reset.sql` first (it **drops the public
schema and every row in it**), then `schema.sql`, then `seed.sql`.

**`Demo data is already present in this database`.** The seed has run before
and is not designed to run twice. You have two options:

| You want | Run |
| --- | --- |
| The wider inventory added to what you already have | `supabase/seed-additional-inventory.sql` — 10 more agents, 60 passports, 90 listings, all at fresh identifiers. Nothing existing is touched. |
| A clean rebuild | `supabase/reset.sql`, then `supabase/schema.sql`, then `supabase/seed.sql`. **Destructive** — every row goes. |

**Seeded accounts exist but sign-in fails.** Check that `auth.identities` has a
row per user and that `confirmation_token` / `recovery_token` are empty strings
rather than null — GoTrue scans those into Go strings and a null breaks login.
