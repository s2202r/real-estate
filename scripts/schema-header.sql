-- ===========================================================================
-- GetMeSpace — consolidated schema
-- ===========================================================================
-- GENERATED FILE. Do not edit by hand.
--
-- Every migration in supabase/migrations/, concatenated in order. This exists
-- for the Supabase SQL-editor workflow, where pasting thirteen files in the
-- right order is error-prone.
--
-- Regenerate with:  bash scripts/build-schema.sh
--
-- ---------------------------------------------------------------------------
-- HOW TO USE
-- ---------------------------------------------------------------------------
--   1. Paste this whole file into the Supabase SQL editor and run it.
--   2. THEN paste supabase/seed.sql and run that (optional demo data).
--
-- Running seed.sql first fails with:
--   ERROR: relation "public.user_roles" does not exist
-- because the seed assumes this schema already exists.
--
-- If you have the Supabase CLI, prefer `supabase db push` (or `db reset`,
-- which also applies the seed) over this file — it tracks migration history.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Precondition check
-- ---------------------------------------------------------------------------
-- This file is not idempotent: it creates types, tables and policies outright.
-- Running it twice fails with `ERROR: 42710: type "app_role" already exists`,
-- which says nothing about what to do next. Say it here instead.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where n.nspname = 'public' and t.typname = 'app_role'
  ) then
    raise exception using
      message = 'This schema is already installed in this database.',
      detail  = 'schema.sql creates types and tables outright; it cannot be applied on top of itself.',
      hint    = 'If you only want demo data, run supabase/seed.sql. To rebuild from scratch, run supabase/reset.sql first — it DROPS the public schema and every row in it.';
  end if;
end $$;



-- ===========================================================================
