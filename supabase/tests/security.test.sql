-- ===========================================================================
-- Database security test suite
-- ===========================================================================
-- Verifies, against a real database, that the guarantees claimed in
-- SECURITY.md actually hold. Run after applying migrations + seed:
--
--   psql "$DATABASE_URL" -f supabase/tests/security.test.sql
--
-- Every check raises an exception on failure, so a non-zero psql exit status
-- means a security regression. These are assertions about the DATABASE, made
-- without the application in the loop — which is the point: if the whole
-- Next.js layer were bypassed, these properties must still hold.
-- ===========================================================================

\set ON_ERROR_STOP on
set client_min_messages = notice;

create or replace function pg_temp.assert(condition boolean, description text)
returns void language plpgsql as $$
begin
  if condition then
    raise notice 'PASS  %', description;
  else
    raise exception 'FAIL  %', description;
  end if;
end;
$$;

-- Runs `stmt` as `user_id` with the `authenticated` role and asserts it fails.
create or replace function pg_temp.assert_denied(user_id uuid, stmt text, description text)
returns void language plpgsql as $$
declare
  failed boolean := false;
begin
  begin
    perform set_config('role', 'authenticated', true);
    perform set_config('request.jwt.claim.sub', user_id::text, true);
    execute stmt;
  exception when others then
    failed := true;
  end;
  perform set_config('role', 'postgres', true);
  if failed then
    raise notice 'PASS  %', description;
  else
    raise exception 'FAIL  % (statement unexpectedly succeeded)', description;
  end if;
end;
$$;

-- Counts rows visible to `user_id` (or anon when null) for a given query.
create or replace function pg_temp.visible_count(user_id uuid, query text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('role', case when user_id is null then 'anon' else 'authenticated' end, true);
  perform set_config('request.jwt.claim.sub', coalesce(user_id::text, ''), true);
  execute query into n;
  perform set_config('role', 'postgres', true);
  return n;
end;
$$;

do $$
declare
  agent_a_user   uuid;
  agent_b_user   uuid;
  customer_user  uuid;
  other_customer uuid;
  agent_a        uuid;
  agent_b        uuid;
  draft_listing  uuid;
  live_listing   uuid;
  share_id       uuid;
  visit_id       uuid;
  ledger_id      uuid;
  n              bigint;
begin
  select a.id, a.user_id into agent_a, agent_a_user
    from public.agents a join public.listings l on l.agent_id = a.id
   where l.status = 'DRAFT' limit 1;
  select a.id, a.user_id into agent_b, agent_b_user
    from public.agents a where a.id <> agent_a limit 1;
  select c.user_id into customer_user  from public.customers c
    where exists (select 1 from public.favorites f where f.customer_id = c.id) limit 1;
  select c.user_id into other_customer from public.customers c
    where c.user_id <> customer_user limit 1;
  select id into draft_listing from public.listings where status = 'DRAFT' and agent_id = agent_a limit 1;
  select id into live_listing  from public.listings where status = 'VERIFIED' limit 1;

  raise notice '';
  raise notice '=== 1. Public visibility ===';

  n := pg_temp.visible_count(null, 'select count(*) from public.listings');
  perform pg_temp.assert(
    n = (select count(*) from public.listings where status = 'VERIFIED'),
    'anonymous visitors see VERIFIED listings only');

  n := pg_temp.visible_count(null, 'select count(*) from public.listings where status <> ''VERIFIED''');
  perform pg_temp.assert(n = 0, 'anonymous visitors cannot see draft or unmoderated listings');

  n := pg_temp.visible_count(null, 'select count(*) from public.profiles');
  perform pg_temp.assert(n = 0, 'anonymous visitors cannot read any profile row (PII)');

  n := pg_temp.visible_count(null, 'select count(*) from public.customers');
  perform pg_temp.assert(n = 0, 'anonymous visitors cannot read customers');

  n := pg_temp.visible_count(null, 'select count(*) from public.leads');
  perform pg_temp.assert(n = 0, 'anonymous visitors cannot read leads');

  n := pg_temp.visible_count(null, 'select count(*) from public.commission_ledger');
  perform pg_temp.assert(n = 0, 'anonymous visitors cannot read the commission ledger');

  n := pg_temp.visible_count(null, 'select count(*) from public.public_agents');
  perform pg_temp.assert(n > 0, 'anonymous visitors CAN read the curated public agent view');

  raise notice '';
  raise notice '=== 2. Customer privacy (§47) ===';

  n := pg_temp.visible_count(agent_a_user, 'select count(*) from public.customers');
  perform pg_temp.assert(n = 0, 'an agent cannot bulk-read the customers table');

  n := pg_temp.visible_count(agent_a_user, 'select count(*) from public.profiles');
  perform pg_temp.assert(n <= 1, 'an agent can read only their own profile row');

  n := pg_temp.visible_count(other_customer,
    format('select count(*) from public.favorites f join public.customers c on c.id=f.customer_id where c.user_id = %L', customer_user));
  perform pg_temp.assert(n = 0, 'a customer cannot read another customer''s favourites');

  raise notice '';
  raise notice '=== 3. Agent isolation ===';

  n := pg_temp.visible_count(agent_b_user,
    format('select count(*) from public.crm_notes where agent_id = %L', agent_a));
  perform pg_temp.assert(n = 0, 'an agent cannot read another agent''s CRM notes');

  n := pg_temp.visible_count(agent_b_user,
    format('select count(*) from public.commission_ledger where agent_id = %L', agent_a));
  perform pg_temp.assert(n = 0, 'an agent cannot read another agent''s commission ledger');

  n := pg_temp.visible_count(agent_b_user,
    format('select count(*) from public.listings where id = %L', draft_listing));
  perform pg_temp.assert(n = 0, 'an agent cannot see another agent''s DRAFT listing');

  raise notice '';
  raise notice '=== 4. Self-promotion guards (§10) ===';

  perform pg_temp.assert_denied(agent_a_user,
    format('update public.listings set status = ''VERIFIED'' where id = %L', draft_listing),
    'an agent cannot self-approve their own listing');

  -- Badge writes are silently reverted rather than rejected, so assert the value.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', agent_a_user::text, true);
  begin
    update public.agents
       set badges = array['TRUSTED_AGENT','TOP_PERFORMER']::public.agent_badge[],
           trust_score = 100,
           verification_level = 'PLATFORM_TRUSTED'
     where id = agent_a;
  exception when others then null;
  end;
  perform set_config('role', 'postgres', true);
  perform pg_temp.assert(
    (select trust_score from public.agents where id = agent_a) <> 100,
    'an agent cannot raise their own trust score');
  perform pg_temp.assert(
    (select verification_level from public.agents where id = agent_a) <> 'PLATFORM_TRUSTED'
      or (select verification_level from public.agents where id = agent_a) is null,
    'an agent cannot grant themselves a verification level');

  raise notice '';
  raise notice '=== 5. Inventory sharing integrity (§14) ===';

  select id into share_id from public.listing_shares where status = 'REQUESTED' limit 1;
  if share_id is not null then
    perform pg_temp.assert_denied(
      (select a.user_id from public.agents a
        join public.listing_shares s on s.requester_agent_id = a.id where s.id = share_id),
      format('update public.listing_shares set status = ''APPROVED'' where id = %L', share_id),
      'the requesting agent cannot approve their own inventory-share request');
  end if;

  raise notice '';
  raise notice '=== 6. Visit qualification is platform-computed (§18) ===';

  select id into visit_id from public.visits where not is_qualified limit 1;
  perform pg_temp.assert_denied(agent_a_user,
    format('update public.visits set is_qualified = true, qualified_at = now() where id = %L', visit_id),
    'an agent cannot mark their own visit as qualified');

  raise notice '';
  raise notice '=== 7. Ledger immutability (§23) ===';

  select id into ledger_id from public.commission_ledger where status = 'APPROVED' limit 1;

  begin
    update public.commission_ledger set amount = amount + 1, amount_minor = amount_minor + 100
     where id = ledger_id;
    raise exception 'FAIL  an APPROVED ledger amount was modified';
  exception
    when check_violation then raise notice 'PASS  an APPROVED ledger entry''s amount is immutable';
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'PASS  an APPROVED ledger entry''s amount is immutable';
  end;

  update public.commission_ledger set status = 'PAYMENT_PROCESSING' where id = ledger_id;
  update public.commission_ledger set status = 'PAID', paid_at = now() where id = ledger_id;

  begin
    update public.commission_ledger set status = 'CALCULATED' where id = ledger_id;
    raise exception 'FAIL  a PAID ledger entry was reverted to CALCULATED';
  exception
    when check_violation then raise notice 'PASS  a PAID ledger entry cannot revert to CALCULATED';
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'PASS  a PAID ledger entry cannot revert to CALCULATED';
  end;

  raise notice '';
  raise notice '=== 8. Append-only history ===';

  perform pg_temp.assert(
    not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.audit_logs', 'DELETE'),
    'audit_logs grants no UPDATE or DELETE to authenticated users');

  perform pg_temp.assert(
    not has_table_privilege('authenticated', 'public.lead_events', 'DELETE')
    and not has_table_privilege('authenticated', 'public.visit_checkins', 'DELETE')
    and not has_table_privilege('authenticated', 'public.deal_events', 'DELETE'),
    'attribution event logs grant no DELETE to authenticated users');

  raise notice '';
  raise notice '=== 9. Legal gating of exclusive inventory (L1) ===';

  begin
    insert into public.agreements (agreement_type, status, currency)
    values ('DISTRIBUTION_RIGHTS', 'ACTIVE', 'INR');
    raise exception 'FAIL  an agreement became ACTIVE without a recorded legal review';
  exception
    when check_violation then raise notice 'PASS  an agreement cannot become ACTIVE without a recorded legal review';
    when others then
      if sqlerrm like 'FAIL%' then raise; end if;
      raise notice 'PASS  an agreement cannot become ACTIVE without a recorded legal review';
  end;

  raise notice '';
  raise notice '=== 10. RLS coverage ===';

  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform pg_temp.assert(n = 0, 'row level security is enabled on every table in public');

  select count(*) into n
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity and not c.relforcerowsecurity;
  perform pg_temp.assert(n = 0, 'row level security is FORCED on every table in public');

  raise notice '';
  raise notice '=== All database security assertions passed ===';
end $$;

reset role;
