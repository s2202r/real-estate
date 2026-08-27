-- ===========================================================================
-- 0010 · Functions and triggers
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','agents','agent_verifications','agent_rera_records','customers',
    'investors','projects','property_passports','property_addresses','listings',
    'listing_shares','customer_requirements','leads','crm_contacts','crm_tasks',
    'crm_notes','visits','deals','commission_rules','commission_ledger',
    'investor_opportunities','investor_interests','agreements','exclusive_inventory',
    'investor_positions','reviews','disputes','notification_templates'
  ] loop
    execute format(
      'create trigger %I_touch_updated_at before update on public.%I
         for each row execute function public.touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference-code generation
-- ---------------------------------------------------------------------------
-- Codes are permanent, human-readable identifiers: PROP-NCR-0001827.
-- The counter row is locked per scope, so concurrent inserts cannot collide.
-- ---------------------------------------------------------------------------
create or replace function public.next_reference(prefix text, scope_code text, width integer default 7)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  scope_key text := prefix || ':' || scope_code;
  seq       bigint;
begin
  insert into public.reference_counters (scope, next_value)
  values (scope_key, 1)
  on conflict (scope) do update
    set next_value = public.reference_counters.next_value + 1
  returning next_value into seq;

  return prefix || '-' || scope_code || '-' || lpad(seq::text, width, '0');
end;
$$;

-- Resolve a region code from a city name; falls back to 'NCR'.
create or replace function public.region_for_city(city_name text)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select r.code from public.regions r
      where r.is_active and city_name = any(r.cities)
      limit 1),
    'NCR'
  );
$$;

create or replace function public.assign_passport_reference()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.reference_code is null or new.reference_code = '' then
    new.reference_code := public.next_reference('PROP', new.region_code, 7);
  end if;
  return new;
end;
$$;
create trigger passports_assign_reference
  before insert on public.property_passports
  for each row execute function public.assign_passport_reference();

-- Generic reference assignment for entities that carry a city column.
create or replace function public.assign_reference_by_city()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prefix text := tg_argv[0];
  width  integer := coalesce(tg_argv[1]::integer, 6);
  region text;
begin
  if new.reference_code is null or new.reference_code = '' then
    region := public.region_for_city(new.city);
    new.reference_code := public.next_reference(prefix, region, width);
  end if;
  return new;
end;
$$;

create trigger listings_assign_reference
  before insert on public.listings
  for each row execute function public.assign_reference_by_city('LIST', '6');

create trigger requirements_assign_reference
  before insert on public.customer_requirements
  for each row execute function public.assign_reference_by_city('REQ', '6');

-- Entities without a city column derive their region from the related property.
create or replace function public.assign_reference_by_property()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prefix text := tg_argv[0];
  width  integer := coalesce(tg_argv[1]::integer, 6);
  region text;
begin
  if new.reference_code is null or new.reference_code = '' then
    select p.region_code into region
      from public.property_passports p
     where p.id = new.property_id;
    new.reference_code := public.next_reference(prefix, coalesce(region, 'NCR'), width);
  end if;
  return new;
end;
$$;

create trigger visits_assign_reference
  before insert on public.visits
  for each row execute function public.assign_reference_by_property('VISIT', '6');

create trigger deals_assign_reference
  before insert on public.deals
  for each row execute function public.assign_reference_by_property('DEAL', '6');

create trigger opportunities_assign_reference
  before insert on public.investor_opportunities
  for each row execute function public.assign_reference_by_property('OPP', '6');

create or replace function public.assign_reference_simple()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  prefix text := tg_argv[0];
  scope  text := coalesce(tg_argv[1], 'GEN');
  width  integer := coalesce(tg_argv[2]::integer, 6);
begin
  if new.reference_code is null or new.reference_code = '' then
    new.reference_code := public.next_reference(prefix, scope, width);
  end if;
  return new;
end;
$$;

create trigger leads_assign_reference
  before insert on public.leads
  for each row execute function public.assign_reference_simple('LEAD', 'NET', '6');
create trigger ledger_assign_reference
  before insert on public.commission_ledger
  for each row execute function public.assign_reference_simple('COMM', 'NET', '6');
create trigger payments_assign_reference
  before insert on public.payments
  for each row execute function public.assign_reference_simple('PAY', 'NET', '6');
create trigger disputes_assign_reference
  before insert on public.disputes
  for each row execute function public.assign_reference_simple('DSP', 'NET', '6');
create trigger agreements_assign_reference
  before insert on public.agreements
  for each row execute function public.assign_reference_simple('AGR', 'NET', '6');

-- ---------------------------------------------------------------------------
-- New auth user → profile + default role
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role public.app_role;
begin
  insert into public.profiles (id, full_name, email, phone, avatar_url)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'user'), '@', 1)),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do nothing;

  -- A client may request 'customer', 'agent' or 'investor' at sign-up.
  -- 'admin' is NEVER self-assignable: it is granted by an existing admin.
  requested_role := case
    when new.raw_user_meta_data ->> 'role' in ('customer','agent','investor')
      then (new.raw_user_meta_data ->> 'role')::public.app_role
    else 'customer'::public.app_role
  end;

  insert into public.user_roles (user_id, role)
  values (new.id, requested_role)
  on conflict (user_id, role) do nothing;

  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  if requested_role = 'customer' then
    insert into public.customers (user_id) values (new.id) on conflict (user_id) do nothing;
  elsif requested_role = 'agent' then
    insert into public.agents (user_id, slug)
    values (
      new.id,
      lower(regexp_replace(
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'agent'),
        '[^a-zA-Z0-9]+', '-', 'g'
      )) || '-' || substr(new.id::text, 1, 8)
    )
    on conflict (user_id) do nothing;
  elsif requested_role = 'investor' then
    insert into public.investors (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Passport counters kept in step with listings
-- ---------------------------------------------------------------------------
create or replace function public.sync_passport_listing_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  -- NEW is unassigned in a DELETE row trigger, so branch on TG_OP.
  target := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  update public.property_passports p
     set listing_count = (
           select count(*) from public.listings l where l.property_id = target
         ),
         active_listing_count = (
           select count(*) from public.listings l
            where l.property_id = target and l.status = 'VERIFIED'
         )
   where p.id = target;
  return null;
end;
$$;

create trigger listings_sync_passport_counts
  after insert or update of status, property_id or delete on public.listings
  for each row execute function public.sync_passport_listing_counts();

-- ---------------------------------------------------------------------------
-- Listing lifecycle: append status history, stamp publication, record price
-- ---------------------------------------------------------------------------
create or replace function public.record_listing_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.listing_status_history (listing_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.listing_status_history (listing_id, from_status, to_status, changed_by, reason)
    values (new.id, old.status, new.status, auth.uid(), new.rejection_reason);
  end if;
  return null;
end;
$$;

create trigger listings_record_status_change
  after insert or update of status on public.listings
  for each row execute function public.record_listing_status_change();

create or replace function public.stamp_listing_publication()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'VERIFIED' and (tg_op = 'INSERT' or old.status is distinct from 'VERIFIED') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status = 'SUBMITTED' and (tg_op = 'INSERT' or old.status is distinct from 'SUBMITTED') then
    new.submitted_at := coalesce(new.submitted_at, now());
  end if;
  -- Derived, never client-supplied.
  if new.built_up_area is not null and new.built_up_area > 0 then
    new.price_per_sqft := round(new.price / new.built_up_area, 2);
  end if;
  return new;
end;
$$;

create trigger listings_stamp_publication
  before insert or update on public.listings
  for each row execute function public.stamp_listing_publication();

create or replace function public.record_listing_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into public.property_price_history
      (property_id, listing_id, listing_type, price, currency, price_per_sqft)
    values
      (new.property_id, new.id, new.listing_type, new.price, new.currency, new.price_per_sqft);
  end if;
  return null;
end;
$$;

create trigger listings_record_price
  after insert or update of price on public.listings
  for each row execute function public.record_listing_price();

-- ---------------------------------------------------------------------------
-- Favourite counters
-- ---------------------------------------------------------------------------
create or replace function public.sync_favourite_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_listing  uuid;
  target_property uuid;
begin
  target_listing  := case when tg_op = 'DELETE' then old.listing_id  else new.listing_id  end;
  target_property := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  update public.listings
     set favourite_count = (select count(*) from public.favorites f where f.listing_id = target_listing)
   where id = target_listing;
  update public.property_passports
     set favourite_count = (select count(*) from public.favorites f where f.property_id = target_property)
   where id = target_property;
  return null;
end;
$$;

create trigger favorites_sync_counts
  after insert or delete on public.favorites
  for each row execute function public.sync_favourite_counts();

-- ---------------------------------------------------------------------------
-- Lead lifecycle: append-only event log
-- ---------------------------------------------------------------------------
create or replace function public.record_lead_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.lead_events (lead_id, event_type, to_stage, actor_id, agent_id, source)
    values (new.id, 'lead.created', new.stage, auth.uid(), new.sales_agent_id, new.source);
  elsif new.stage is distinct from old.stage then
    insert into public.lead_events (lead_id, event_type, from_stage, to_stage, actor_id, agent_id)
    values (new.id, 'lead.stage_changed', old.stage, new.stage, auth.uid(), new.sales_agent_id);
    update public.leads set last_activity_at = now() where id = new.id;
  end if;
  return null;
end;
$$;

create trigger leads_record_event
  after insert or update of stage on public.leads
  for each row execute function public.record_lead_event();

-- ---------------------------------------------------------------------------
-- Deal lifecycle: append-only timeline
-- ---------------------------------------------------------------------------
create or replace function public.record_deal_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.deal_events (deal_id, event_type, to_status, actor_id)
    values (new.id, 'deal.created', new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.deal_events (deal_id, event_type, from_status, to_status, actor_id, amount, currency)
    values (new.id, 'deal.status_changed', old.status, new.status, auth.uid(), new.final_price, new.currency);
  end if;
  return null;
end;
$$;

create trigger deals_record_event
  after insert or update of status on public.deals
  for each row execute function public.record_deal_event();

-- ---------------------------------------------------------------------------
-- Visit outcome propagation
-- ---------------------------------------------------------------------------
create or replace function public.sync_visit_counts()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  target := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  update public.property_passports p
     set visit_count = (select count(*) from public.visits v where v.property_id = p.id)
   where p.id = target;
  return null;
end;
$$;

create trigger visits_sync_counts
  after insert or delete on public.visits
  for each row execute function public.sync_visit_counts();

-- ---------------------------------------------------------------------------
-- Agent rating recomputation from moderated reviews only
-- ---------------------------------------------------------------------------
create or replace function public.recompute_agent_rating()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target uuid;
begin
  target := case when tg_op = 'DELETE' then old.agent_id else new.agent_id end;
  if target is null then
    return null;
  end if;
  update public.agents a
     set rating_average = coalesce((
           select round(avg(r.rating)::numeric, 2) from public.reviews r
            where r.agent_id = target and r.moderation_status = 'APPROVED'
         ), 0),
         rating_count = (
           select count(*) from public.reviews r
            where r.agent_id = target and r.moderation_status = 'APPROVED'
         )
   where a.id = target;
  return null;
end;
$$;

create trigger reviews_recompute_agent_rating
  after insert or update of moderation_status, rating or delete on public.reviews
  for each row execute function public.recompute_agent_rating();

-- ---------------------------------------------------------------------------
-- Ledger state machine — illegal transitions are rejected in the database,
-- not merely discouraged in application code.
-- ---------------------------------------------------------------------------
create or replace function public.guard_ledger_transition()
returns trigger
language plpgsql
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  -- A settled entry is frozen. Corrections require a new REVERSAL/ADJUSTMENT row.
  if old.status = 'PAID' and new.status <> 'DISPUTED' then
    raise exception 'commission_ledger: % is PAID and cannot transition to %', old.reference_code, new.status
      using errcode = 'check_violation';
  end if;

  if old.status = 'CANCELLED' then
    raise exception 'commission_ledger: % is CANCELLED and is terminal', old.reference_code
      using errcode = 'check_violation';
  end if;

  if not (
    (old.status = 'PENDING'            and new.status in ('CALCULATED','CANCELLED')) or
    (old.status = 'CALCULATED'         and new.status in ('APPROVED','DISPUTED','CANCELLED')) or
    (old.status = 'APPROVED'           and new.status in ('PAYMENT_PROCESSING','DISPUTED','CANCELLED')) or
    (old.status = 'PAYMENT_PROCESSING' and new.status in ('PAID','APPROVED','DISPUTED','CANCELLED')) or
    (old.status = 'DISPUTED'           and new.status in ('CALCULATED','APPROVED','CANCELLED','PAID')) or
    (old.status = 'PAID'               and new.status = 'DISPUTED')
  ) then
    raise exception 'commission_ledger: illegal transition % -> %', old.status, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger ledger_guard_transition
  before update of status on public.commission_ledger
  for each row execute function public.guard_ledger_transition();

-- Amount columns of a settled ledger entry are immutable.
create or replace function public.guard_ledger_immutability()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('PAID','APPROVED') and (
       new.amount is distinct from old.amount
    or new.amount_minor is distinct from old.amount_minor
    or new.currency is distinct from old.currency
    or new.deal_id is distinct from old.deal_id
    or new.role is distinct from old.role
  ) then
    raise exception 'commission_ledger: financial fields of % are immutable once %', old.reference_code, old.status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger ledger_guard_immutability
  before update on public.commission_ledger
  for each row execute function public.guard_ledger_immutability();

-- ---------------------------------------------------------------------------
-- Only one current commission calculation per deal
-- ---------------------------------------------------------------------------
create or replace function public.supersede_previous_calculation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.is_current then
    update public.commission_calculations
       set is_current = false, superseded_by = new.id
     where deal_id = new.deal_id
       and id <> new.id
       and is_current;
  end if;
  return null;
end;
$$;

create trigger calculations_supersede_previous
  after insert on public.commission_calculations
  for each row execute function public.supersede_previous_calculation();

-- ---------------------------------------------------------------------------
-- Exclusive inventory must never outlive its agreement
-- ---------------------------------------------------------------------------
create or replace function public.guard_exclusive_inventory()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  agreement_status public.agreement_status;
begin
  select a.status into agreement_status
    from public.agreements a where a.id = new.agreement_id;

  if new.status = 'EXCLUSIVE' and agreement_status is distinct from 'ACTIVE' then
    raise exception 'exclusive_inventory requires an ACTIVE agreement (agreement is %)', agreement_status
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger exclusive_inventory_guard
  before insert or update on public.exclusive_inventory
  for each row execute function public.guard_exclusive_inventory();
