-- ===========================================================================
-- Repair: auth accounts with no profile
-- ===========================================================================
-- Symptom this fixes:
--
--     ERROR: insert or update on table "user_roles" violates foreign key
--     constraint "user_roles_user_id_fkey"
--     DETAIL: Key (user_id)=(…) is not present in table "profiles".
--
-- and, in the app, a signed-in account that is denied every area and shows the
-- part of its email before the @ as its name — that string is the fallback
-- `getSessionUser` uses when there is no profile row to read.
--
-- Cause: `public.profiles` is created by the `on_auth_user_created` trigger on
-- `auth.users`. An account created while that trigger did not exist — an early
-- seed run against a database without the schema, a manual insert, a restore
-- that brought back `auth` but not `public` — has an auth identity and nothing
-- else. Everything downstream references `profiles`, so nothing can be granted
-- to it.
--
-- This does exactly what the trigger would have done, for every account that
-- is missing the rows, and nothing to accounts that already have them. It is
-- safe to run more than once.
--
-- Run it, then grant the admin role at the bottom.
-- ===========================================================================

set search_path = public, extensions, pg_temp;

begin;

-- 1 · The profile itself.
insert into public.profiles (id, full_name, email, phone, avatar_url)
select
  u.id,
  coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           split_part(coalesce(u.email, 'user'), '@', 1)),
  u.email,
  nullif(u.raw_user_meta_data ->> 'phone', ''),
  nullif(u.raw_user_meta_data ->> 'avatar_url', '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2 · The role the account asked for at sign-up. 'admin' is never among these:
--     it is granted deliberately, at the bottom of this file.
insert into public.user_roles (user_id, role)
select
  p.id,
  case
    when u.raw_user_meta_data ->> 'role' in ('customer','agent','investor')
      then (u.raw_user_meta_data ->> 'role')::public.app_role
    else 'customer'::public.app_role
  end
from public.profiles p
join auth.users u on u.id = p.id
where not exists (select 1 from public.user_roles r where r.user_id = p.id)
on conflict (user_id, role) do nothing;

-- 3 · Notification preferences.
insert into public.notification_preferences (user_id)
select p.id from public.profiles p
where not exists (select 1 from public.notification_preferences n where n.user_id = p.id)
on conflict (user_id) do nothing;

-- 4 · The role-specific record. Without it the account signs in but every
--     workspace page finds no profile to work with.
insert into public.customers (user_id)
select r.user_id from public.user_roles r
where r.role = 'customer' and r.revoked_at is null
  and not exists (select 1 from public.customers c where c.user_id = r.user_id)
on conflict (user_id) do nothing;

insert into public.agents (user_id, slug)
select
  r.user_id,
  lower(regexp_replace(
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), 'agent'),
    '[^a-zA-Z0-9]+', '-', 'g'
  )) || '-' || substr(r.user_id::text, 1, 8)
from public.user_roles r
join auth.users u on u.id = r.user_id
where r.role = 'agent' and r.revoked_at is null
  and not exists (select 1 from public.agents a where a.user_id = r.user_id)
on conflict (user_id) do nothing;

insert into public.investors (user_id)
select r.user_id from public.user_roles r
where r.role = 'investor' and r.revoked_at is null
  and not exists (select 1 from public.investors i where i.user_id = r.user_id)
on conflict (user_id) do nothing;

commit;

-- ===========================================================================
-- Grant the admin role
-- ===========================================================================
-- Change the address below to the account that should administer the platform.
-- Admin is never self-assignable through the application (§13); this is the
-- deliberate, out-of-band grant.
-- ===========================================================================

insert into public.user_roles (user_id, role, admin_role)
select p.id, 'admin', 'super_admin'
  from public.profiles p
 where p.email = 'admin@demo.realestatenetwork.test'
on conflict (user_id, role) do update
   set admin_role = 'super_admin', revoked_at = null;

-- What the account now holds. Expect at least one row with role = admin.
select p.email, r.role, r.admin_role, r.revoked_at
  from public.profiles p
  join public.user_roles r on r.user_id = p.id
 where p.email = 'admin@demo.realestatenetwork.test';
