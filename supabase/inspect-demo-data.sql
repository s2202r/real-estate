-- ===========================================================================
-- What is actually in this database — read-only
-- ===========================================================================
-- Run this before `remove-demo-data.sql` to see what it will treat as demo,
-- and to check that nothing real is caught by it.
--
-- It changes NOTHING. Every statement is a select.
--
-- Why it exists: `is_demo` is set by the seed, but it is a column like any
-- other and can be lost. `repair-missing-profiles.sql` re-creates a profile
-- and its role record for an auth account that has none, and those rows are
-- created with `is_demo` at its default of false — so a demo account whose
-- profile went missing and was repaired comes back looking real. The seed
-- leaves two other marks that survive all of that: it addresses every account
-- at a `@demo.…` domain and prefixes every name with `[Demo] `.
-- ===========================================================================

set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- 1 · Every account, and why it does or does not look like demo data.
-- ---------------------------------------------------------------------------
select
  p.email,
  p.full_name,
  p.is_demo                                             as flagged_demo,
  p.email like '%@demo.%'                               as demo_email,
  p.full_name like '[Demo]%'                            as demo_name,
  (select string_agg(r.role::text, ', ')
     from public.user_roles r
    where r.user_id = p.id and r.revoked_at is null)    as roles,
  p.created_at::date                                    as created,
  case
    when exists (select 1 from public.user_roles r
                  where r.user_id = p.id and r.role = 'admin' and r.revoked_at is null)
      then 'KEPT — administrator'
    when p.is_demo or p.email like '%@demo.%' or p.full_name like '[Demo]%'
      then 'would be DELETED as demo'
    else 'kept — real account'
  end                                                   as verdict
from public.profiles p
order by verdict, p.email;

-- ---------------------------------------------------------------------------
-- 2 · The totals behind those verdicts.
-- ---------------------------------------------------------------------------
with classified as (
  select
    p.id,
    exists (select 1 from public.user_roles r
             where r.user_id = p.id and r.role = 'admin' and r.revoked_at is null) as is_administrator,
    (p.is_demo or p.email like '%@demo.%' or p.full_name like '[Demo]%')           as looks_demo
  from public.profiles p
)
select
  count(*)                                                              as accounts,
  count(*) filter (where is_administrator)                              as administrators,
  count(*) filter (where looks_demo and not is_administrator)           as demo_to_remove,
  count(*) filter (where not looks_demo and not is_administrator)       as real_accounts
from classified;

-- ---------------------------------------------------------------------------
-- 3 · Content, split the same way. `flagged` is what the `is_demo` column
--     says; `by_owner` is what the account behind the row says.
-- ---------------------------------------------------------------------------
with demo_profiles as (
  select p.id from public.profiles p
   where (p.is_demo or p.email like '%@demo.%' or p.full_name like '[Demo]%')
     and not exists (select 1 from public.user_roles r
                      where r.user_id = p.id and r.role = 'admin' and r.revoked_at is null)
),
demo_agents as (
  select a.id from public.agents a where a.is_demo or a.user_id in (select id from demo_profiles)
)
select 'agents' as entity,
       (select count(*) from public.agents)                                        as total,
       (select count(*) from public.agents where is_demo)                          as flagged,
       (select count(*) from demo_agents)                                          as by_owner
union all
select 'customers',
       (select count(*) from public.customers),
       (select count(*) from public.customers where is_demo),
       (select count(*) from public.customers c where c.is_demo or c.user_id in (select id from demo_profiles))
union all
select 'listings',
       (select count(*) from public.listings),
       (select count(*) from public.listings where is_demo),
       (select count(*) from public.listings l where l.is_demo or l.agent_id in (select id from demo_agents))
union all
select 'property passports',
       (select count(*) from public.property_passports),
       (select count(*) from public.property_passports where is_demo),
       (select count(*) from public.property_passports pp
         where pp.is_demo
            or (pp.created_by in (select id from demo_profiles)
                and not exists (select 1 from public.listings l
                                 where l.property_id = pp.id
                                   and not l.is_demo
                                   and l.agent_id not in (select id from demo_agents)))) 
union all
select 'leads',
       (select count(*) from public.leads),
       (select count(*) from public.leads where is_demo),
       (select count(*) from public.leads le where le.is_demo
          or le.customer_id in (select id from public.customers c where c.is_demo or c.user_id in (select id from demo_profiles)))
union all
select 'visits',
       (select count(*) from public.visits),
       (select count(*) from public.visits where is_demo),
       (select count(*) from public.visits v where v.is_demo
          or v.customer_id in (select id from public.customers c where c.is_demo or c.user_id in (select id from demo_profiles)))
union all
select 'deals',
       (select count(*) from public.deals),
       (select count(*) from public.deals where is_demo),
       (select count(*) from public.deals d where d.is_demo
          or d.customer_id in (select id from public.customers c where c.is_demo or c.user_id in (select id from demo_profiles)));

-- ---------------------------------------------------------------------------
-- 4 · The agents behind the directory, so you can recognise them by name.
-- ---------------------------------------------------------------------------
select a.slug, coalesce(a.agency_name, p.full_name) as name, p.email,
       a.is_demo as flagged_demo, a.status,
       (select count(*) from public.listings l where l.agent_id = a.id) as listings
  from public.agents a
  left join public.profiles p on p.id = a.user_id
 order by a.is_demo desc, a.slug;
