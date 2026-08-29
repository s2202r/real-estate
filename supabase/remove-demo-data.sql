-- ===========================================================================
-- Remove the demo seed
-- ===========================================================================
-- `seed.sql` plants a whole working marketplace — agents, listings, leads,
-- visits, closed deals with commission — and flags every row it creates with
-- `is_demo = true`. This deletes exactly those rows, and nothing else.
--
-- Real data is identified by the absence of that flag, so anything created
-- through the application is untouched: a listing an agent published, a lead a
-- customer raised, an account somebody signed up for.
--
-- WHAT IT DOES NOT DELETE
--   · audit_logs — append-only by design. The record that demo rows once
--     existed is itself a fact about this database.
--   · commission_rules, amenities, regions, notification templates. These are
--     configuration, not demo content; deleting them would leave the platform
--     unable to calculate a commission or send a notification.
--   · Any row without `is_demo = true`.
--
-- IT DELETES DEMO ACCOUNTS, WITH ONE EXCEPTION. Every demo login
-- (…@demo.realestatenetwork.test) is removed from `auth.users`, which cascades
-- to its profile, roles and notifications — EXCEPT an account that holds a live
-- admin role. In practice the seed's admin account is how people first sign in
-- to this console, so deleting it would lock the platform with no way back in.
-- Such an account is kept, and its demo flag cleared: whatever it started as,
-- it is a real operator account now. The script says which ones it kept.
--
-- REAL ROWS THAT POINTED AT DEMO ONES. A real customer who enquired about a
-- demo listing keeps their lead; it simply no longer points at a listing. A
-- real visit booked against a demo property goes with the property, because a
-- visit to somewhere that does not exist is not a record worth keeping.
--
-- This is not `reset.sql`. That one drops the whole schema and everything in
-- it. This one leaves the schema, the configuration and all real data exactly
-- where they are.
--
-- Safe to run more than once: a second run deletes nothing and reports zeros.
-- Runs in one transaction, so it either all happens or none of it does.
-- ===========================================================================

set search_path = public, extensions, pg_temp;

begin;

-- What is about to go. Compare this against the counts on /admin.
select 'before' as when, * from (
  select
    (select count(*) from public.property_passports where is_demo) as passports,
    (select count(*) from public.listings            where is_demo) as listings,
    (select count(*) from public.agents              where is_demo) as agents,
    (select count(*) from public.customers           where is_demo) as customers,
    (select count(*) from public.investors           where is_demo) as investors,
    (select count(*) from public.leads               where is_demo) as leads,
    (select count(*) from public.visits              where is_demo) as visits,
    (select count(*) from public.deals               where is_demo) as deals,
    (select count(*) from public.profiles            where is_demo) as accounts
) counts;

-- ---------------------------------------------------------------------------
-- 1 · Money first.
--
-- `commission_ledger.deal_id` is ON DELETE RESTRICT — deliberately, so a paid
-- entry cannot vanish because someone deleted a deal. That protection has to
-- be stepped around explicitly here, and only for demo deals.
-- ---------------------------------------------------------------------------
delete from public.payments
 where deal_id in (select id from public.deals where is_demo);

delete from public.commission_ledger
 where deal_id in (select id from public.deals where is_demo);

-- Cascades to calculations, distributions, participants, events, documents
-- and visit attributions.
delete from public.deals where is_demo;

-- ---------------------------------------------------------------------------
-- 2 · Everything hanging off the demo accounts and inventory.
--     Each of these cascades to its own children.
-- ---------------------------------------------------------------------------
delete from public.agreements             where is_demo;
delete from public.investor_opportunities where is_demo;
delete from public.reviews                where is_demo;
delete from public.crm_contacts           where is_demo;
delete from public.visits                 where is_demo;
delete from public.leads                  where is_demo;
delete from public.customer_requirements  where is_demo;

-- ---------------------------------------------------------------------------
-- 3 · Inventory. Deleting a passport cascades to its listings, address,
--     media, amenities, price history and duplicate candidates.
-- ---------------------------------------------------------------------------
delete from public.listings           where is_demo;
delete from public.property_passports where is_demo;
delete from public.projects           where is_demo;

-- ---------------------------------------------------------------------------
-- 4 · The administrator is never deleted.
--
-- Whoever is running this is very likely signed in as the seed's admin. Taking
-- that account out would leave a platform nobody can administer and no path to
-- fixing it from the application. So an account with a live admin role stops
-- being demo data and becomes what it already is in practice: the operator's
-- account.
-- ---------------------------------------------------------------------------
update public.profiles p
   set is_demo = false
 where p.is_demo
   and exists (
     select 1 from public.user_roles r
      where r.user_id = p.id and r.role = 'admin' and r.revoked_at is null
   );

-- Which accounts were kept for that reason. Expect the one you sign in with.
select p.email as kept_as_administrator
  from public.profiles p
  join public.user_roles r on r.user_id = p.id
 where r.role = 'admin' and r.revoked_at is null;

-- ---------------------------------------------------------------------------
-- 5 · The role records, then the accounts themselves.
--
-- Deleting from auth.users cascades to profiles, and from there to user_roles,
-- notifications and notification preferences. The role records are removed
-- first anyway, so that a profile row that somehow lost its auth user does not
-- leave an orphaned agent behind.
-- ---------------------------------------------------------------------------
delete from public.agents    where is_demo;
delete from public.customers where is_demo;
delete from public.investors where is_demo;

delete from auth.users u
 where exists (select 1 from public.profiles p where p.id = u.id and p.is_demo);

-- Any demo profile whose auth user was already gone.
delete from public.profiles where is_demo;

-- What is left. Every column should read 0.
select 'after' as when, * from (
  select
    (select count(*) from public.property_passports where is_demo) as passports,
    (select count(*) from public.listings            where is_demo) as listings,
    (select count(*) from public.agents              where is_demo) as agents,
    (select count(*) from public.customers           where is_demo) as customers,
    (select count(*) from public.investors           where is_demo) as investors,
    (select count(*) from public.leads               where is_demo) as leads,
    (select count(*) from public.visits              where is_demo) as visits,
    (select count(*) from public.deals               where is_demo) as deals,
    (select count(*) from public.profiles            where is_demo) as accounts
) counts;

-- And what genuinely remains — this is what /admin will now show.
select 'real' as when, * from (
  select
    (select count(*) from public.property_passports) as passports,
    (select count(*) from public.listings where status = 'VERIFIED') as live_listings,
    (select count(*) from public.agents)    as agents,
    (select count(*) from public.customers) as customers,
    (select count(*) from public.leads)     as leads,
    (select count(*) from public.visits)    as visits,
    (select count(*) from public.deals)     as deals
) counts;

commit;
