-- ===========================================================================
-- DESTRUCTIVE RESET — development databases only
-- ===========================================================================
-- Drops the entire `public` schema and every demo account, so that
-- supabase/schema.sql can be run again from a clean slate.
--
-- THIS DELETES ALL APPLICATION DATA: every property, listing, lead, visit,
-- deal, commission entry and audit row, and every profile. It exists because
-- schema.sql is not idempotent — re-running it on a database that already has
-- the schema fails with:
--
--     ERROR: 42710: type "app_role" already exists
--
-- If you see that error, you have two choices:
--
--   1. The schema is already installed and you just want demo data.
--      Do NOT run this file. Run supabase/seed.sql instead.
--
--   2. You want to rebuild from scratch and can afford to lose the data.
--      Run this file, then supabase/schema.sql, then supabase/seed.sql.
--
-- Never run this against a database holding real customer records.
-- ===========================================================================

begin;

-- The sign-up trigger lives on auth.users and calls a function in public, so
-- it has to go before the schema it depends on.
drop trigger if exists on_auth_user_created on auth.users;

-- Storage policies live in the `storage` schema, which the drop below does not
-- reach. The storage migration drops them by name before recreating, so they
-- are left alone here; buckets are upserted and likewise safe to keep.

drop schema if exists public cascade;
create schema public;

-- Restore the grants Supabase expects on a fresh public schema. Without these
-- PostgREST cannot see anything, and the API returns permission errors that
-- look like RLS failures.
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres, service_role;
alter default privileges in schema public
  grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to postgres, anon, authenticated, service_role;

-- Demo accounts live in auth.users, which survives the drop above. Leaving
-- them would make the seed's account creation a no-op and leave sign-in
-- pointing at profiles that no longer exist.
delete from auth.identities where provider_id in (
  select id::text from auth.users where email like '%@demo.getmespace.test'
);
delete from auth.users where email like '%@demo.getmespace.test';

commit;

do $$
begin
  raise notice 'Reset complete. Now run supabase/schema.sql, then supabase/seed.sql.';
end $$;
