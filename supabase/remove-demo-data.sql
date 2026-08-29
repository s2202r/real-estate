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
-- THE FLAG ALONE IS NOT ENOUGH, and step 0 below explains why. `is_demo` is a
-- column like any other, and it can be lost: `repair-missing-profiles.sql`
-- re-creates a profile and its role record for an auth account that has none,
-- with `is_demo` at its default of false. A demo account whose profile went
-- missing and was repaired therefore comes back looking real, and survives a
-- removal that trusts the flag. Two marks the seed leaves survive all of that,
-- and both are things no genuine account has: an address at a `@demo.…` domain
-- and a name beginning `[Demo] `. Step 0 restores the flag from those, and from
-- there everything follows the ownership.
--
-- Run `inspect-demo-data.sql` first. It changes nothing and shows you exactly
-- which accounts this will delete and which it will keep.
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

-- What is here now. Compare this against the counts on /admin.
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
-- 0 · Restore the flag on demo rows that lost it, then follow the ownership.
--
-- Conservative in one direction only: it can mark a row demo, never real. A
-- row without a demo owner and without the flag is never touched by any of it.
-- ---------------------------------------------------------------------------

-- FIRST, and before anything else looks at the flag: the administrator.
--
-- Whoever is running this is very likely signed in as the seed's admin, whose
-- address and name carry exactly the marks below. Taking that account out
-- would leave a platform nobody can administer and no path to fixing it from
-- the application. So an account holding a live admin role stops being demo
-- data and becomes what it already is in practice: the operator's account.
--
-- This has to happen before the propagation, not after it. Protecting the
-- profile at the end would still leave its customer and agent records flagged
-- and deleted underneath it — an account that signs in to a workspace with no
-- record behind it, which is the exact breakage `repair-missing-profiles.sql`
-- exists to undo.
update public.profiles p
   set is_demo = false
 where p.is_demo
   and exists (select 1 from public.user_roles r
                where r.user_id = p.id and r.role = 'admin' and r.revoked_at is null);

-- Which accounts are kept for that reason. Expect the one you sign in with.
select p.email as kept_as_administrator, p.full_name
  from public.profiles p
  join public.user_roles r on r.user_id = p.id
 where r.role = 'admin' and r.revoked_at is null;

-- Accounts the seed created, by the marks it leaves on them. Administrators
-- are excluded by the check above, which never lets them back in.
update public.profiles
   set is_demo = true
 where not is_demo
   and (email like '%@demo.%' or full_name like '[Demo]%')
   and not exists (select 1 from public.user_roles r
                    where r.user_id = profiles.id and r.role = 'admin' and r.revoked_at is null);

-- The role records belonging to those accounts.
update public.agents a set is_demo = true
  from public.profiles p
 where p.id = a.user_id and p.is_demo and not a.is_demo;

update public.customers c set is_demo = true
  from public.profiles p
 where p.id = c.user_id and p.is_demo and not c.is_demo;

update public.investors i set is_demo = true
  from public.profiles p
 where p.id = i.user_id and p.is_demo and not i.is_demo;

-- Inventory offered by a demo agent.
update public.listings l set is_demo = true
  from public.agents a
 where a.id = l.agent_id and a.is_demo and not l.is_demo;

-- A passport created by a demo account — but ONLY if no real agent is still
-- offering it. Several agents may list the same physical property, and taking
-- the passport would take a real agent's listing with it.
update public.property_passports pp
   set is_demo = true
 where not pp.is_demo
   and exists (select 1 from public.profiles p where p.id = pp.created_by and p.is_demo)
   and not exists (select 1 from public.listings l where l.property_id = pp.id and not l.is_demo);

-- Work raised by a demo customer. A REAL customer's lead or visit is not
-- touched here: if it pointed at demo inventory the foreign keys deal with it,
-- which is a smaller loss than deleting somebody's genuine enquiry.
update public.leads le set is_demo = true
  from public.customers c
 where c.id = le.customer_id and c.is_demo and not le.is_demo;

update public.visits v set is_demo = true
  from public.customers c
 where c.id = v.customer_id and c.is_demo and not v.is_demo;

update public.customer_requirements cr set is_demo = true
  from public.customers c
 where c.id = cr.customer_id and c.is_demo and not cr.is_demo;

-- Deals restrict deletion of the customer and the property, so a demo deal
-- that lost its flag would block the whole script.
update public.deals d set is_demo = true
  from public.customers c
 where c.id = d.customer_id and c.is_demo and not d.is_demo;

update public.deals d set is_demo = true
  from public.property_passports pp
 where pp.id = d.property_id and pp.is_demo and not d.is_demo;

-- Named, so you can see exactly whose accounts are about to go.
select p.email, p.full_name, p.created_at::date as created
  from public.profiles p
 where p.is_demo
 order by p.email;

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
-- 4 · The role records, then the accounts themselves.
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
