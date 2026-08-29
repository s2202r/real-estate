-- ===========================================================================
-- Demo seed data
-- ===========================================================================
-- EVERY row created here is flagged `is_demo = true` and every profile name is
-- prefixed "[Demo]". This data exists to demonstrate the platform end to end;
-- it must never be mistaken for production inventory.
--
-- Covers the §66 demo scenario:
--   Agent registers -> verified -> creates property -> admin verifies ->
--   listing live -> customer searches, saves, requests a visit ->
--   listing agent unavailable -> another agent accepts from the visit
--   marketplace -> visit qualified -> second visit by a third agent ->
--   negotiation -> deal -> commission calculated -> ledger -> payout approved.
--
-- DEMO LOGIN: every seeded account uses the password below. Development only.
--
--     email:    admin@demo.getmespace.test   (also agent1..20@, customer1..5@)
--     password: DemoPassword123!
--
-- PREREQUISITE: the migrations in supabase/migrations/ must already be applied.
-- Running this file against an empty database fails with
-- 'relation "public.user_roles" does not exist'.
-- ===========================================================================

-- pgcrypto lives in the `extensions` schema on hosted Supabase and in `public`
-- on a plain Postgres, so crypt()/gen_salt() are resolved from either.
set search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Precondition check
-- ---------------------------------------------------------------------------
-- Fail with an actionable message rather than a bare
-- 'relation "public.user_roles" does not exist' twenty lines in.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.user_roles') is null then
    raise exception using
      message = 'Schema not found: the migrations have not been applied to this database.',
      detail  = 'seed.sql only inserts demo data; it does not create tables.',
      hint    = 'Run `supabase db push` first, or paste supabase/schema.sql into the SQL editor and run it, then re-run this file.';
  end if;

  -- This file is not re-runnable: it seeds fixed ids and unique records. The
  -- whole thing runs in one transaction, so a second run would roll back with
  -- a confusing constraint violation partway through. Say so up front instead.
  if exists (select 1 from public.profiles where is_demo limit 1) then
    raise exception using
      message = 'Demo data is already present in this database.',
      detail  = 'seed.sql seeds fixed identifiers and is not designed to run twice.',
      hint    = 'To ADD the wider inventory to what you already have, run supabase/seed-additional-inventory.sql instead. To start over, run supabase/reset.sql (destructive), then supabase/schema.sql, then this file.';
  end if;
end $$;

begin;

-- ---------------------------------------------------------------------------
-- Deterministic UUID helper so re-seeding is stable and references are readable
-- ---------------------------------------------------------------------------
create or replace function pg_temp.demo_uuid(kind text, n integer)
returns uuid language sql immutable as $$
  select (
    substr(md5('getmespace:' || kind), 1, 8) || '-' ||
    substr(md5('getmespace:' || kind), 9, 4) || '-4' ||
    substr(md5('getmespace:' || kind), 14, 3) || '-8' ||
    substr(md5('getmespace:' || kind), 18, 3) || '-' ||
    lpad(to_hex(n), 12, '0')
  )::uuid;
$$;

-- ===========================================================================
-- 1 · Users
-- ===========================================================================
-- Inserting into auth.users fires handle_new_user(), which creates the profile,
-- the role and the role-specific record. Seeding through the real trigger means
-- the seed also exercises the sign-up path.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- Demo user creation
-- ---------------------------------------------------------------------------
-- A bare `insert into auth.users (id, email, raw_user_meta_data)` succeeds but
-- produces an account that CANNOT sign in: GoTrue requires a password, an
-- `authenticated` aud/role, a confirmed email, empty-string (not null) token
-- columns, and a matching row in auth.identities for the email provider.
--
-- This helper writes all of that, so the seeded accounts are usable
-- immediately. Development only - every account shares one obvious password.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.create_demo_user(
  user_id uuid,
  user_email text,
  user_meta jsonb
) returns uuid language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000',
    user_id,
    'authenticated',
    'authenticated',
    user_email,
    crypt('DemoPassword123!', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    user_meta,
    now(),
    now(),
    -- Empty strings, never null: GoTrue scans these into Go strings and a null
    -- makes every subsequent sign-in fail with a type-conversion error.
    '', '', '', ''
  )
  on conflict (id) do nothing;

  -- The identity row is what lets the email/password provider find the user.
  -- Wrapped defensively because auth.identities has gained columns over time;
  -- a schema mismatch should warn, not abort the whole seed.
  begin
    insert into auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      user_id::text,
      user_id,
      jsonb_build_object('sub', user_id::text, 'email', user_email, 'email_verified', true),
      'email',
      now(), now(), now()
    )
    on conflict do nothing;
  exception when others then
    raise warning 'Could not create auth.identities row for % (%). Password sign-in may not work for this account.', user_email, sqlerrm;
  end;

  return user_id;
end;
$$;

-- Admin
select pg_temp.create_demo_user(
  pg_temp.demo_uuid('admin', 1),
  'admin@demo.getmespace.test',
  '{"full_name":"[Demo] Platform Admin","role":"customer"}'::jsonb
);

-- Admins are never self-assigned; grant the role explicitly.
insert into public.user_roles (user_id, role, admin_role)
values (pg_temp.demo_uuid('admin', 1), 'admin', 'super_admin')
on conflict (user_id, role) do nothing;

-- 10 agents across NCR, Mumbai, Bengaluru and Lucknow (ten more in section 14)
select pg_temp.create_demo_user(
  pg_temp.demo_uuid('agent', n),
  'agent' || n || '@demo.getmespace.test',
  jsonb_build_object(
    'full_name', '[Demo] ' || (array[
      'Rohit Sharma','Priya Nair','Amit Verma','Sneha Kulkarni','Imran Qureshi',
      'Kavita Reddy','Manish Gupta','Deepa Iyer','Sandeep Chauhan','Ritu Malhotra'
    ])[n],
    'role', 'agent',
    'phone', (array['9810012001','9820012002','9810012003','9930012004','9810012005',
                    '9880012006','9810012007','9840012008','9910012009','9810012010'])[n]
  )
)
from generate_series(1, 10) n;

-- 5 customers
select pg_temp.create_demo_user(
  pg_temp.demo_uuid('customer', n),
  'customer' || n || '@demo.getmespace.test',
  jsonb_build_object(
    'full_name', '[Demo] ' || (array[
      'Rahul Mehta','Anjali Desai','Vikram Singh','Neha Bansal','Arjun Pillai'
    ])[n],
    'role', 'customer',
    'phone', (array['9811100001','9811100002','9811100003','9811100004','9811100005'])[n]
  )
)
from generate_series(1, 5) n;

-- 2 investors
select pg_temp.create_demo_user(
  pg_temp.demo_uuid('investor', n),
  'investor' || n || '@demo.getmespace.test',
  jsonb_build_object(
    'full_name', '[Demo] ' || (array['Sunil Agarwal','Meera Kapoor'])[n],
    'role', 'investor',
    'phone', (array['9811200001','9811200002'])[n]
  )
)
from generate_series(1, 2) n;

update public.profiles
   set is_demo = true,
       city = coalesce(city, 'Noida'),
       email_verified_at = now(),
       phone_verified_at = now(),
       consent_terms_at = now(),
       consent_privacy_at = now()
 where email like '%@demo.getmespace.test';

-- ---------------------------------------------------------------------------
-- Agent profiles: specialisation, service areas, verification standing
-- ---------------------------------------------------------------------------
with agent_data as (
  select * from (values
    (1,  'rohit-sharma-ncr',    'Sharma Realty',        'Noida',        array['Noida','Greater Noida'],       array['Sector 137','Sector 150','Noida Extension'], 11, 'RERA_VERIFIED',  92.5, 4.8, 96.0),
    (2,  'priya-nair-ncr',      'Nair Homes',           'Gurgaon',      array['Gurgaon','Delhi'],             array['Golf Course Road','Sohna Road','DLF Phase 3'], 8,  'RERA_VERIFIED',  88.0, 4.6, 91.0),
    (3,  'amit-verma-ncr',      'Verma Properties',     'Ghaziabad',    array['Ghaziabad','Noida'],           array['Indirapuram','Raj Nagar Extension'],          6,  'BUSINESS_VERIFIED', 74.0, 4.3, 84.0),
    (4,  'sneha-kulkarni-mum',  'Kulkarni Estates',     'Mumbai',       array['Mumbai','Thane'],              array['Andheri West','Powai','Thane West'],          12, 'PLATFORM_TRUSTED', 95.0, 4.9, 98.0),
    (5,  'imran-qureshi-ncr',   'Qureshi Associates',   'Noida',        array['Noida','Greater Noida'],       array['Sector 137','Sector 74','Sector 78'],         5,  'IDENTITY_VERIFIED', 61.0, 4.1, 77.0),
    (6,  'kavita-reddy-blr',    'Reddy Realty',         'Bengaluru',    array['Bengaluru'],                   array['Whitefield','Sarjapur Road','HSR Layout'],    9,  'RERA_VERIFIED',  86.5, 4.7, 93.0),
    (7,  'manish-gupta-ncr',    'Gupta Property Hub',   'Noida',        array['Noida','Ghaziabad'],           array['Noida Extension','Sector 137','Indirapuram'], 4,  'IDENTITY_VERIFIED', 58.0, 4.0, 72.0),
    (8,  'deepa-iyer-blr',      'Iyer Homes',           'Bengaluru',    array['Bengaluru'],                   array['Indiranagar','Koramangala','Whitefield'],     7,  'BUSINESS_VERIFIED', 79.0, 4.5, 88.0),
    (9,  'sandeep-chauhan-lko', 'Chauhan Realty',       'Lucknow',      array['Lucknow'],                     array['Gomti Nagar','Hazratganj'],                   10, 'RERA_VERIFIED',  83.0, 4.4, 89.0),
    (10, 'ritu-malhotra-ncr',   'Malhotra Estates',     'Gurgaon',      array['Gurgaon','Delhi'],             array['Golf Course Extension','Dwarka Expressway'],  6,  'BUSINESS_VERIFIED', 76.5, 4.2, 85.0)
  ) as t(n, slug, agency, city, cities, localities, years, level, trust, rating, response)
)
update public.agents a
   set slug = d.slug,
       agency_name = d.agency,
       headline = d.agency || ' · ' || d.years || ' years in ' || d.city,
       bio = '[Demo] ' || d.agency || ' specialises in ' || array_to_string(d.localities, ', ')
             || '. ' || d.years || ' years of local transaction experience.',
       experience_years = d.years,
       service_cities = d.cities,
       service_localities = d.localities,
       specializations = array['APARTMENT','BUILDER_FLOOR','VILLA']::public.property_type[],
       verification_level = d.level::public.verification_level,
       badges = case d.level
                  when 'PLATFORM_TRUSTED' then array['IDENTITY_VERIFIED','RERA_VERIFIED','TRUSTED_AGENT','TOP_PERFORMER']
                  when 'RERA_VERIFIED'    then array['IDENTITY_VERIFIED','RERA_VERIFIED','TRUSTED_AGENT']
                  when 'BUSINESS_VERIFIED' then array['IDENTITY_VERIFIED']
                  else array['IDENTITY_VERIFIED']
                end::public.agent_badge[],
       trust_score = d.trust,
       rating_average = d.rating,
       rating_count = 12 + d.n,
       response_rate = d.response,
       response_time_minutes = 20 + d.n * 3,
       visit_completion_rate = 80 + d.n,
       cancellation_rate = greatest(0, 12 - d.n),
       conversion_rate = 8 + d.n,
       closed_deal_count = 3 + d.n,
       accepts_visit_requests = true,
       max_visit_distance_km = 20,
       base_latitude  = 28.5000 + (d.n * 0.01),
       base_longitude = 77.3900 + (d.n * 0.01),
       status = 'ACTIVE',
       is_demo = true
  from agent_data d
 where a.user_id = pg_temp.demo_uuid('agent', d.n);

update public.profiles p
   set city = a.service_cities[1]
  from public.agents a
 where a.user_id = p.id and a.is_demo;

-- RERA records for the RERA-verified agents
insert into public.agent_rera_records (agent_id, rera_number, state, authority, registered_name, valid_from, valid_until, status, verified_at)
select a.id,
       'UPRERAAGT' || lpad((10000 + row_number() over (order by a.slug))::text, 6, '0'),
       'Uttar Pradesh', 'UP-RERA', a.agency_name,
       current_date - interval '18 months', current_date + interval '18 months',
       'APPROVED', now()
  from public.agents a
 where a.is_demo and 'RERA_VERIFIED' = any(a.badges);

-- Agent verification submissions (one still pending, for the admin queue)
insert into public.agent_verifications (agent_id, level, status, legal_name, business_name, submitted_at, reviewed_at)
select a.id, 'IDENTITY_VERIFIED', 'APPROVED', p.full_name, a.agency_name, now() - interval '30 days', now() - interval '29 days'
  from public.agents a join public.profiles p on p.id = a.user_id
 where a.is_demo;

insert into public.agent_verifications (agent_id, level, status, legal_name, business_name, gst_number, submitted_at)
select a.id, 'BUSINESS_VERIFIED', 'SUBMITTED', p.full_name, a.agency_name, '09AAACH7409R1ZZ', now() - interval '2 days'
  from public.agents a join public.profiles p on p.id = a.user_id
 where a.is_demo and a.slug in ('manish-gupta-ncr','imran-qureshi-ncr');

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
update public.customers c
   set preferred_cities = case
         when c.user_id = pg_temp.demo_uuid('customer',1) then array['Noida','Greater Noida']
         when c.user_id = pg_temp.demo_uuid('customer',2) then array['Gurgaon']
         when c.user_id = pg_temp.demo_uuid('customer',3) then array['Mumbai']
         when c.user_id = pg_temp.demo_uuid('customer',4) then array['Bengaluru']
         else array['Lucknow'] end,
       budget_min = 4000000, budget_max = 18000000,
       allow_agent_contact = true,
       is_demo = true
 where exists (select 1 from public.profiles p where p.id = c.user_id and p.is_demo);

-- ---------------------------------------------------------------------------
-- Investors  (module is feature-flagged OFF by default; data exists for demos)
-- ---------------------------------------------------------------------------
update public.investors i
   set entity_name = case when i.user_id = pg_temp.demo_uuid('investor',1)
                          then '[Demo] Agarwal Family Office' else '[Demo] Kapoor Capital' end,
       entity_type = 'HUF',
       investment_cities = array['Noida','Greater Noida','Gurgaon'],
       ticket_size_min = 2500000, ticket_size_max = 25000000,
       target_holding_months = 12,
       target_return_percent = 18,
       risk_appetite = 'MODERATE',
       verification_status = 'APPROVED',
       verification_level = 'IDENTITY_VERIFIED',
       status = 'ACTIVE',
       is_demo = true
 where exists (select 1 from public.profiles p where p.id = i.user_id and p.is_demo);

-- ===========================================================================
-- 2 · Projects
-- ===========================================================================
insert into public.projects (id, slug, name, developer_name, region_code, city, locality, state, pincode, latitude, longitude, rera_number, rera_state, total_towers, total_units, possession_date, amenities, description, is_demo)
values
  (pg_temp.demo_uuid('project',1), 'green-valley-heights-noida', '[Demo] Green Valley Heights', 'Green Valley Developers', 'NCR', 'Noida', 'Sector 137', 'Uttar Pradesh', '201305', 28.5041, 77.3910, 'UPRERAPRJ123456', 'Uttar Pradesh', 6, 720, '2021-06-30', array['swimming_pool','gym','clubhouse','park','security_24x7','power_backup'], '[Demo] Ready-to-move gated township on the Noida Expressway.', true),
  (pg_temp.demo_uuid('project',2), 'skyline-residency-noida-ext', '[Demo] Skyline Residency', 'Skyline Infra', 'NCR', 'Greater Noida', 'Noida Extension', 'Uttar Pradesh', '201306', 28.6100, 77.4400, 'UPRERAPRJ223344', 'Uttar Pradesh', 8, 960, '2023-12-31', array['gym','park','security_24x7','kids_play_area','lift'], '[Demo] Value-focused apartments in Noida Extension.', true),
  (pg_temp.demo_uuid('project',3), 'palm-grove-gurgaon', '[Demo] Palm Grove', 'Palm Estates', 'NCR', 'Gurgaon', 'Sohna Road', 'Haryana', '122018', 28.4089, 77.0400, 'HRERA-GGM-334455', 'Haryana', 4, 480, '2020-03-31', array['swimming_pool','gym','clubhouse','ev_charging','security_24x7'], '[Demo] Premium low-rise community off Sohna Road.', true),
  (pg_temp.demo_uuid('project',4), 'harbour-view-mumbai', '[Demo] Harbour View', 'Harbour Realty', 'MUM', 'Mumbai', 'Powai', 'Maharashtra', '400076', 19.1176, 72.9060, 'P51800012345', 'Maharashtra', 3, 300, '2022-09-30', array['swimming_pool','gym','clubhouse','security_24x7','lift'], '[Demo] Lake-facing towers in Powai.', true),
  (pg_temp.demo_uuid('project',5), 'tech-park-enclave-blr', '[Demo] Tech Park Enclave', 'Enclave Builders', 'BLR', 'Bengaluru', 'Whitefield', 'Karnataka', '560066', 12.9698, 77.7500, 'PRM/KA/RERA/1251/446', 'Karnataka', 5, 600, '2022-01-31', array['gym','park','clubhouse','ev_charging','rain_water'], '[Demo] Walk-to-work apartments near Whitefield tech parks.', true),
  (pg_temp.demo_uuid('project',6), 'gomti-greens-lucknow', '[Demo] Gomti Greens', 'Greens Group', 'LKO', 'Lucknow', 'Gomti Nagar', 'Uttar Pradesh', '226010', 26.8500, 81.0000, 'UPRERAPRJ998877', 'Uttar Pradesh', 3, 240, '2021-11-30', array['park','security_24x7','lift','power_backup'], '[Demo] Spacious homes in Gomti Nagar.', true);

-- ===========================================================================
-- 3 · Property passports  (30 physical properties)
-- ===========================================================================
-- Several passports deliberately carry MORE THAN ONE listing further down, so
-- the agent-collaboration model is visible in the demo data.
-- ===========================================================================
do $$
declare
  n integer;
  cities   text[] := array['Noida','Greater Noida','Gurgaon','Mumbai','Bengaluru','Lucknow','Ghaziabad','Delhi'];
  locs     text[] := array['Sector 137','Noida Extension','Sohna Road','Powai','Whitefield','Gomti Nagar','Indirapuram','Dwarka'];
  states   text[] := array['Uttar Pradesh','Uttar Pradesh','Haryana','Maharashtra','Karnataka','Uttar Pradesh','Uttar Pradesh','Delhi'];
  pins     text[] := array['201305','201306','122018','400076','560066','226010','201014','110075'];
  regions  text[] := array['NCR','NCR','NCR','MUM','BLR','LKO','NCR','NCR'];
  lats     numeric[] := array[28.5041,28.6100,28.4089,19.1176,12.9698,26.8500,28.6450,28.5921];
  lngs     numeric[] := array[77.3910,77.4400,77.0400,72.9060,77.7500,81.0000,77.3550,77.0460];
  ptypes   public.property_type[] := array['APARTMENT','APARTMENT','BUILDER_FLOOR','APARTMENT','APARTMENT','VILLA','APARTMENT','APARTMENT'];
  idx      integer;
  pid      uuid;
  beds     smallint;
  area     numeric;
begin
  for n in 1..30 loop
    idx  := 1 + (n % 8);
    pid  := pg_temp.demo_uuid('property', n);
    beds := 1 + (n % 4);
    area := 550 + (beds * 350) + ((n % 5) * 60);

    insert into public.property_passports (
      id, region_code, property_type, category, project_id,
      tower, unit_number, floor, total_floors,
      carpet_area, built_up_area, super_built_up_area,
      bedrooms, bathrooms, balconies, facing, age_years,
      ownership_type, status, verification_status, verification_score,
      last_verified_at, next_verification_at, created_by, is_demo
    ) values (
      pid, regions[idx], ptypes[idx], 'RESIDENTIAL',
      case when idx <= 6 then pg_temp.demo_uuid('project', idx) else null end,
      'Tower ' || chr(65 + (n % 5)), (100 + n)::text, 1 + (n % 18), 22,
      round(area * 0.72, 2), area, round(area * 1.18, 2),
      beds, greatest(1, beds - 1)::smallint, (1 + (n % 3))::smallint,
      (array['NORTH','EAST','SOUTH','WEST','NORTH_EAST','SOUTH_EAST']::public.facing_direction[])[1 + (n % 6)],
      (1 + (n % 9))::smallint,
      'FREEHOLD', 'ACTIVE', 'APPROVED', 70 + (n % 30),
      now() - interval '10 days', now() + interval '80 days',
      pg_temp.demo_uuid('agent', 1 + (n % 10)), true
    );

    insert into public.property_addresses (
      property_id, address_line1, locality, city, state, pincode, country,
      latitude, longitude, is_exact_location_public
    ) values (
      pid,
      'Tower ' || chr(65 + (n % 5)) || ', Unit ' || (100 + n),
      locs[idx], cities[idx], states[idx], pins[idx], 'IN',
      lats[idx] + (n * 0.0007), lngs[idx] + (n * 0.0007), false
    );

    -- Amenities: a deterministic but varied subset.
    insert into public.property_amenities (property_id, amenity_key)
    select pid, k from unnest(array['lift','power_backup','security_24x7','covered_parking','park']) k
    on conflict do nothing;
    if n % 2 = 0 then
      insert into public.property_amenities (property_id, amenity_key)
      select pid, k from unnest(array['gym','swimming_pool','clubhouse']) k on conflict do nothing;
    end if;
    if n % 3 = 0 then
      insert into public.property_amenities (property_id, amenity_key)
      select pid, k from unnest(array['ev_charging','modular_kitchen','vastu_compliant']) k on conflict do nothing;
    end if;

    -- Nearby places, used by the location-score engine.
    insert into public.property_nearby_places (property_id, place_type, name, distance_km, travel_minutes) values
      (pid, 'METRO',    'Metro Station',        round((0.4 + (n % 7) * 0.3)::numeric, 2), 5 + (n % 12)),
      (pid, 'SCHOOL',   'International School',  round((0.8 + (n % 5) * 0.4)::numeric, 2), 6 + (n % 10)),
      (pid, 'HOSPITAL', 'Multi-speciality Hospital', round((1.2 + (n % 6) * 0.5)::numeric, 2), 9 + (n % 14)),
      (pid, 'MALL',     'Shopping Mall',         round((1.5 + (n % 4) * 0.7)::numeric, 2), 11 + (n % 9)),
      (pid, 'OFFICE_HUB','Business Park',        round((2.0 + (n % 6) * 0.9)::numeric, 2), 14 + (n % 16)),
      (pid, 'AIRPORT',  'International Airport', round((18 + (n % 20))::numeric, 2), 45 + (n % 30));

    -- Cover image (Unsplash source URLs; demo only).
    insert into public.property_media (property_id, media_type, external_url, caption, alt_text, sort_order, is_primary)
    values (pid, 'IMAGE',
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + (n % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      '[Demo] Living area', 'Demo property photograph', 0, true);
  end loop;
end $$;

-- ===========================================================================
-- 4 · Listings  (40 listings over 30 passports)
-- ===========================================================================
do $$
declare
  n integer;
  pid uuid; lid uuid;
  agent_row public.agents%rowtype;
  pp public.property_passports%rowtype;
  addr public.property_addresses%rowtype;
  ltype public.listing_type;
  price numeric;
  prop_index integer;
  agent_index integer;
  status public.listing_status;
begin
  for n in 1..40 loop
    -- Listings 31..40 re-list an EARLIER passport under a DIFFERENT agent.
    -- This is the network effect made visible: one property, several agents.
    prop_index  := case when n <= 30 then n else n - 30 end;
    agent_index := case when n <= 30 then 1 + (n % 10) else 1 + ((n + 4) % 10) end;

    pid := pg_temp.demo_uuid('property', prop_index);
    lid := pg_temp.demo_uuid('listing', n);

    select * into pp   from public.property_passports where id = pid;
    select * into addr from public.property_addresses where property_id = pid;
    select * into agent_row from public.agents where user_id = pg_temp.demo_uuid('agent', agent_index);

    ltype := case when n % 5 = 0 then 'RENT' else 'SALE' end;
    price := case
               when ltype = 'RENT' then 18000 + (pp.bedrooms * 9000) + ((n % 6) * 2500)
               else 4200000 + (pp.bedrooms * 2100000) + ((n % 9) * 380000)
             end;

    -- Most listings are live; a few sit in the moderation queue on purpose so
    -- the admin dashboard has real work to show.
    status := case
                when n % 13 = 0 then 'SUBMITTED'
                when n % 17 = 0 then 'DRAFT'
                else 'VERIFIED'
              end;

    insert into public.listings (
      id, property_id, agent_id, title, slug, description, highlights,
      listing_type, status, price, is_negotiable, maintenance_charge,
      security_deposit, brokerage_type, brokerage_value,
      property_type, category, bedrooms, bathrooms, balconies,
      built_up_area, carpet_area, floor, total_floors, facing, furnishing,
      age_years, possession_status, available_from,
      covered_parking, open_parking, power_backup, water_supply,
      city, locality, state, pincode, latitude, longitude,
      cover_image_url, youtube_url, virtual_tour_url,
      is_shareable, submitted_at, reviewed_by, reviewed_at,
      verification_score, published_at, expires_at,
      view_count, enquiry_count, is_demo
    ) values (
      lid, pid, agent_row.id,
      pp.bedrooms || ' BHK ' ||
        replace(initcap(replace(pp.property_type::text, '_', ' ')), 'Bhk', 'BHK') ||
        ' in ' || addr.locality || ', ' || addr.city,
      lower(regexp_replace(
        pp.bedrooms || '-bhk-' || replace(lower(pp.property_type::text), '_', '-') || '-' ||
        addr.locality || '-' || addr.city || '-' || right(lid::text, 8),
        '[^a-z0-9]+', '-', 'g')),
      '[Demo] A ' || pp.bedrooms || ' BHK ' || lower(replace(pp.property_type::text, '_', ' ')) ||
        ' of ' || pp.built_up_area || ' sq ft in ' || addr.locality || ', ' || addr.city ||
        '. ' || case when ltype = 'RENT' then 'Available on rent. ' else 'Available for sale. ' end ||
        'Verified on the network with a complete property passport.',
      array['Verified property passport', 'Gated community', 'Close to metro and schools'],
      ltype, status, price, true,
      case when ltype = 'SALE' then 2500 + (pp.bedrooms * 800) else null end,
      case when ltype = 'RENT' then price * 2 else null end,
      'PERCENT', case when ltype = 'RENT' then 100 else 1.5 end,
      pp.property_type, pp.category, pp.bedrooms, pp.bathrooms, pp.balconies,
      pp.built_up_area, pp.carpet_area, pp.floor, pp.total_floors, pp.facing,
      (array['UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED']::public.furnishing_status[])[1 + (n % 3)],
      pp.age_years,
      (array['READY_TO_MOVE','READY_TO_MOVE','RESALE','UNDER_CONSTRUCTION']::public.possession_status[])[1 + (n % 4)],
      current_date + ((n % 30) || ' days')::interval,
      1 + (n % 2), (n % 2), 'FULL', 'Municipal + Borewell',
      addr.city, addr.locality, addr.state, addr.pincode, addr.latitude, addr.longitude,
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + (n % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      case when n % 4 = 0 then 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' else null end,
      -- No placeholder tour URL: example.com cannot be embedded, so it would
      -- render as "this content is blocked" or a dead link. Demo media comes
      -- from youtube_url above, which is on the embed allowlist.
      null,
      true,
      case when status <> 'DRAFT' then now() - interval '12 days' else null end,
      case when status = 'VERIFIED' then pg_temp.demo_uuid('admin', 1) else null end,
      case when status = 'VERIFIED' then now() - interval '11 days' else null end,
      case when status = 'VERIFIED' then 72 + (n % 28) else 0 end,
      case when status = 'VERIFIED' then now() - interval '11 days' else null end,
      now() + interval '90 days',
      40 + (n * 7) % 500, (n % 9), true
    );

    insert into public.listing_media (listing_id, media_type, external_url, caption, sort_order, is_primary)
    select lid, 'IMAGE',
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + ((n + g) % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      '[Demo] Photo ' || g, g, g = 0
    from generate_series(0, 3) g;
  end loop;
end $$;

-- ===========================================================================
-- 5 · Agent-to-agent inventory sharing  (§14)
-- ===========================================================================
insert into public.listing_shares (listing_id, owner_agent_id, requester_agent_id, status, request_message, response_message, agreed_share_percent, requested_at, responded_at)
select
  l.id, l.agent_id, req.id,
  (case when (row_number() over (order by l.id)) % 4 = 0 then 'REQUESTED' else 'APPROVED' end)::public.share_status,
  '[Demo] I have a client actively looking in this locality. May I share this listing with them?',
  case when (row_number() over (order by l.id)) % 4 = 0 then null
       else '[Demo] Approved. Please register the customer as a lead before sharing.' end,
  case when (row_number() over (order by l.id)) % 4 = 0 then null else 30 end,
  now() - interval '9 days',
  case when (row_number() over (order by l.id)) % 4 = 0 then null else now() - interval '8 days' end
from public.listings l
join lateral (
  select a.id from public.agents a
   where a.is_demo and a.id <> l.agent_id
     and l.city = any(a.service_cities)
   order by a.trust_score desc
   limit 1
) req on true
where l.status = 'VERIFIED' and l.is_demo
order by l.id
limit 12
on conflict (listing_id, requester_agent_id) do nothing;

-- ===========================================================================
-- 6 · Customer requirements (demand marketplace)
-- ===========================================================================
insert into public.customer_requirements (
  customer_id, title, property_type, category, listing_type, city, localities, state,
  budget_min, budget_max, min_area, bedrooms_min, bedrooms_max,
  furnishing, possession, required_by, amenities, preferences, is_discoverable, status, is_demo
)
select
  c.id,
  d.title, d.ptypes, 'RESIDENTIAL', d.ltype, d.city, d.localities, d.state,
  d.bmin, d.bmax, d.min_area, d.bed_min, d.bed_max,
  array['SEMI_FURNISHED','FULLY_FURNISHED']::public.furnishing_status[],
  array['READY_TO_MOVE']::public.possession_status[],
  current_date + interval '90 days',
  array['lift','security_24x7','covered_parking'],
  d.prefs, true, 'ACTIVE', true
from (values
  (1, '[Demo] 3BHK in Noida Extension under 1.5 Cr', array['APARTMENT']::public.property_type[], 'SALE'::public.listing_type, 'Greater Noida', array['Noida Extension','Sector 137'], 'Uttar Pradesh', 9000000::numeric, 15000000::numeric, 1400::numeric, 3::smallint, 3::smallint, '[Demo] Prefer high floor, east facing, close to metro and good schools.'),
  (2, '[Demo] 2BHK rental in Gurgaon', array['APARTMENT','BUILDER_FLOOR']::public.property_type[], 'RENT'::public.listing_type, 'Gurgaon', array['Sohna Road','Golf Course Road'], 'Haryana', 25000::numeric, 55000::numeric, 1000::numeric, 2::smallint, 3::smallint, '[Demo] Semi-furnished, pet friendly, near a business park.'),
  (3, '[Demo] Family home in Powai', array['APARTMENT']::public.property_type[], 'SALE'::public.listing_type, 'Mumbai', array['Powai','Andheri West'], 'Maharashtra', 18000000::numeric, 35000000::numeric, 1100::numeric, 3::smallint, 4::smallint, '[Demo] Lake view preferred, ready to move only.'),
  (4, '[Demo] Walk-to-work near Whitefield', array['APARTMENT']::public.property_type[], 'SALE'::public.listing_type, 'Bengaluru', array['Whitefield','Sarjapur Road'], 'Karnataka', 8000000::numeric, 16000000::numeric, 1200::numeric, 2::smallint, 3::smallint, '[Demo] Under 3 km from the tech park, EV charging required.'),
  (5, '[Demo] Villa in Gomti Nagar', array['VILLA','INDEPENDENT_HOUSE']::public.property_type[], 'SALE'::public.listing_type, 'Lucknow', array['Gomti Nagar'], 'Uttar Pradesh', 12000000::numeric, 25000000::numeric, 2200::numeric, 4::smallint, 5::smallint, '[Demo] Corner plot, vastu compliant.')
) as d(n, title, ptypes, ltype, city, localities, state, bmin, bmax, min_area, bed_min, bed_max, prefs)
join public.customers c on c.user_id = pg_temp.demo_uuid('customer', d.n);

-- ===========================================================================
-- 7 · Favourites and saved searches
-- ===========================================================================
insert into public.favorites (customer_id, listing_id, property_id, notes)
select c.id, l.id, l.property_id, '[Demo] Shortlisted for a site visit.'
from public.customers c
join lateral (
  select l.* from public.listings l
   where l.status = 'VERIFIED' and l.is_demo and l.city = any(c.preferred_cities)
   order by l.price limit 3
) l on true
where exists (select 1 from public.profiles p where p.id = c.user_id and p.is_demo)
on conflict do nothing;

insert into public.saved_searches (customer_id, name, filters, alert_enabled)
select c.id, '[Demo] ' || c.preferred_cities[1] || ' under budget',
  jsonb_build_object('city', c.preferred_cities[1], 'listingType', 'SALE',
                     'priceMax', c.budget_max, 'bedroomsMin', 2, 'verifiedOnly', true),
  true
from public.customers c
where exists (select 1 from public.profiles p where p.id = c.user_id and p.is_demo);

-- ===========================================================================
-- 8 · Leads
-- ===========================================================================
insert into public.leads (
  id, customer_id, property_id, listing_id, listing_agent_id, sales_agent_id,
  source, stage, priority, message, budget, is_contact_unlocked, contact_unlocked_at,
  accepted_at, first_response_at, next_follow_up_at, score, is_demo
)
select
  pg_temp.demo_uuid('lead', row_number() over (order by f.customer_id, f.listing_id)::integer),
  f.customer_id, f.property_id, f.listing_id, l.agent_id, l.agent_id,
  'CUSTOMER_SEARCH',
  (array['NEW','CONTACTED','QUALIFIED','PROPERTY_SHARED','VISIT_SCHEDULED','VISIT_COMPLETED','INTERESTED','NEGOTIATION']::public.lead_stage[])
    [1 + ((row_number() over (order by f.customer_id, f.listing_id))::integer % 8)],
  'MEDIUM',
  '[Demo] Interested in this property. Please share more details and availability for a visit.',
  l.price,
  true, now() - interval '6 days',
  now() - interval '6 days', now() - interval '6 days',
  now() + interval '2 days',
  55 + ((row_number() over (order by f.customer_id, f.listing_id))::integer % 40),
  true
from public.favorites f
join public.listings l on l.id = f.listing_id;

-- ===========================================================================
-- 9 · Visits  (§16–§20)
-- ===========================================================================
-- Includes the §66 scenario: the listing agent is unavailable, a nearby agent
-- accepts from the visit marketplace, conducts and qualifies the visit, and a
-- second agent conducts a later qualifying visit.
-- ===========================================================================
do $$
declare
  v_customer   uuid;
  v_property   uuid;
  v_listing    uuid;
  v_lead       uuid;
  agent_a      uuid;   -- listing agent (unavailable on the day)
  agent_c      uuid;   -- visiting agent who accepts from the marketplace
  agent_e      uuid;   -- later visiting agent
  visit_1      uuid := pg_temp.demo_uuid('visit', 1);
  visit_2      uuid := pg_temp.demo_uuid('visit', 2);
  visit_3      uuid := pg_temp.demo_uuid('visit', 3);
begin
  select c.id into v_customer from public.customers c where c.user_id = pg_temp.demo_uuid('customer', 1);
  select l.id, l.property_id, l.agent_id into v_listing, v_property, agent_a
    from public.listings l
   where l.status = 'VERIFIED' and l.is_demo and l.listing_type = 'SALE'
   order by l.price desc limit 1;
  select id into agent_c from public.agents where user_id = pg_temp.demo_uuid('agent', 5);
  select id into agent_e from public.agents where user_id = pg_temp.demo_uuid('agent', 7);

  select id into v_lead from public.leads
   where customer_id = v_customer and listing_id = v_listing limit 1;

  if v_lead is null then
    v_lead := pg_temp.demo_uuid('lead', 900);
    insert into public.leads (id, customer_id, property_id, listing_id, listing_agent_id, sales_agent_id,
                              source, stage, message, is_contact_unlocked, is_demo)
    values (v_lead, v_customer, v_property, v_listing, agent_a, agent_a,
            'CUSTOMER_SEARCH', 'NEGOTIATION', '[Demo] Serious buyer, financing pre-approved.', true, true);
  else
    update public.leads set stage = 'NEGOTIATION' where id = v_lead;
  end if;

  -- ---- Visit 1: listing agent declines, Agent C accepts (visit marketplace)
  insert into public.visits (
    id, customer_id, property_id, listing_id, lead_id, visit_type, status,
    requested_date, requested_time, scheduled_at,
    preferred_agent_id, assigned_agent_id, listing_agent_id, assigned_at,
    started_at, ended_at, agent_confirmed_at, customer_confirmed_at, otp_verified_at,
    geofence_passed, geofence_distance_m, is_qualified, qualified_at,
    qualification_reasons, outcome, interest_level, agent_notes, is_demo
  ) values (
    visit_1, v_customer, v_property, v_listing, v_lead, 'PHYSICAL', 'QUALIFIED',
    (now() - interval '20 days')::date, '16:00', now() - interval '20 days',
    agent_a, agent_c, agent_a, now() - interval '21 days',
    now() - interval '20 days', now() - interval '20 days' + interval '42 minutes',
    now() - interval '20 days', now() - interval '20 days' + interval '45 minutes',
    now() - interval '20 days' + interval '44 minutes',
    true, 38.5, true, now() - interval '20 days' + interval '45 minutes',
    jsonb_build_object('agentCheckIn', true, 'customerConfirmation', true,
                       'minimumDuration', true, 'geofence', true),
    'INTERESTED', 4,
    '[Demo] Customer liked the layout and the east-facing balcony. Asked about the maintenance charge.', true
  );

  insert into public.visit_assignments (visit_id, agent_id, status, offer_rank, distance_km, match_score, offered_at, responded_at, decline_reason)
  values
    (visit_1, agent_a, 'DECLINED', 1, 0.0,  98.0, now() - interval '21 days', now() - interval '21 days' + interval '20 minutes', '[Demo] Travelling that day.'),
    (visit_1, agent_c, 'ACCEPTED', 2, 3.4,  86.0, now() - interval '21 days' + interval '25 minutes', now() - interval '21 days' + interval '31 minutes', null);

  insert into public.visit_checkins (visit_id, actor, action, latitude, longitude, accuracy_m, distance_from_property_m, within_geofence)
  values
    (visit_1, 'AGENT',    'CHECK_IN',  28.5041, 77.3910, 8.0,  38.5, true),
    (visit_1, 'CUSTOMER', 'CHECK_IN',  28.5041, 77.3911, 12.0, 41.2, true),
    (visit_1, 'AGENT',    'CHECK_OUT', 28.5041, 77.3910, 9.0,  36.0, true);

  insert into public.visit_feedback (visit_id, customer_id, agent_id, did_visit_happen, rating, agent_rating, property_matched_listing, interest_level, comments, moderation_status)
  values (visit_1, v_customer, agent_c, true, 5, 5, true, 4,
          '[Demo] The agent was punctual and knew the project well.', 'APPROVED');

  -- ---- Visit 2: a second qualifying visit, conducted by a different agent
  insert into public.visits (
    id, customer_id, property_id, listing_id, lead_id, visit_type, status,
    requested_date, requested_time, scheduled_at,
    preferred_agent_id, assigned_agent_id, listing_agent_id, assigned_at,
    started_at, ended_at, agent_confirmed_at, customer_confirmed_at, otp_verified_at,
    geofence_passed, geofence_distance_m, is_qualified, qualified_at,
    qualification_reasons, outcome, interest_level, agent_notes, is_demo
  ) values (
    visit_2, v_customer, v_property, v_listing, v_lead, 'PHYSICAL', 'QUALIFIED',
    (now() - interval '9 days')::date, '11:30', now() - interval '9 days',
    agent_c, agent_e, agent_a, now() - interval '10 days',
    now() - interval '9 days', now() - interval '9 days' + interval '55 minutes',
    now() - interval '9 days', now() - interval '9 days' + interval '58 minutes',
    now() - interval '9 days' + interval '57 minutes',
    true, 22.0, true, now() - interval '9 days' + interval '58 minutes',
    jsonb_build_object('agentCheckIn', true, 'customerConfirmation', true,
                       'minimumDuration', true, 'geofence', true),
    'NEGOTIATION_STARTED', 5,
    '[Demo] Second visit with family. Price negotiation started at 2% below asking.', true
  );

  insert into public.visit_assignments (visit_id, agent_id, status, offer_rank, distance_km, match_score, offered_at, responded_at)
  values (visit_2, agent_e, 'ACCEPTED', 1, 5.1, 81.0, now() - interval '10 days', now() - interval '10 days' + interval '12 minutes');

  insert into public.visit_checkins (visit_id, actor, action, latitude, longitude, accuracy_m, distance_from_property_m, within_geofence)
  values
    (visit_2, 'AGENT',    'CHECK_IN',  28.5042, 77.3909, 7.0,  22.0, true),
    (visit_2, 'CUSTOMER', 'CHECK_IN',  28.5042, 77.3910, 10.0, 25.5, true),
    (visit_2, 'AGENT',    'CHECK_OUT', 28.5042, 77.3909, 8.0,  21.0, true);

  insert into public.visit_feedback (visit_id, customer_id, agent_id, did_visit_happen, rating, agent_rating, property_matched_listing, interest_level, comments, moderation_status)
  values (visit_2, v_customer, agent_e, true, 5, 4, true, 5,
          '[Demo] Very helpful during the price discussion.', 'APPROVED');

  -- ---- Visit 3: an EARLIER qualifying visit by the listing agent himself.
  -- Three qualifying visits reproduce the worked example in COMMISSION_ENGINE.md.
  insert into public.visits (
    id, customer_id, property_id, listing_id, lead_id, visit_type, status,
    requested_date, requested_time, scheduled_at,
    preferred_agent_id, assigned_agent_id, listing_agent_id, assigned_at,
    started_at, ended_at, agent_confirmed_at, customer_confirmed_at, otp_verified_at,
    geofence_passed, geofence_distance_m, is_qualified, qualified_at,
    qualification_reasons, outcome, interest_level, agent_notes, is_demo
  ) values (
    visit_3, v_customer, v_property, v_listing, v_lead, 'PHYSICAL', 'QUALIFIED',
    (now() - interval '30 days')::date, '10:00', now() - interval '30 days',
    agent_a, agent_a, agent_a, now() - interval '31 days',
    now() - interval '30 days', now() - interval '30 days' + interval '28 minutes',
    now() - interval '30 days', now() - interval '30 days' + interval '30 minutes',
    now() - interval '30 days' + interval '29 minutes',
    true, 15.0, true, now() - interval '30 days' + interval '30 minutes',
    jsonb_build_object('agentCheckIn', true, 'customerConfirmation', true,
                       'minimumDuration', true, 'geofence', true),
    'NEEDS_FOLLOW_UP', 3,
    '[Demo] First walkthrough. Customer wanted to compare with two other options.', true
  );

  insert into public.visit_assignments (visit_id, agent_id, status, offer_rank, distance_km, match_score, offered_at, responded_at)
  values (visit_3, agent_a, 'ACCEPTED', 1, 0.0, 99.0, now() - interval '31 days', now() - interval '31 days' + interval '8 minutes');

  insert into public.visit_checkins (visit_id, actor, action, latitude, longitude, accuracy_m, distance_from_property_m, within_geofence)
  values
    (visit_3, 'AGENT',    'CHECK_IN',  28.5040, 77.3910, 6.0, 15.0, true),
    (visit_3, 'CUSTOMER', 'CHECK_IN',  28.5040, 77.3911, 9.0, 18.0, true),
    (visit_3, 'AGENT',    'CHECK_OUT', 28.5040, 77.3910, 7.0, 14.0, true);
end $$;

-- A handful of upcoming and pending-offer visits so the dashboards are alive.
insert into public.visits (
  customer_id, property_id, listing_id, visit_type, status,
  requested_date, requested_time, preferred_agent_id, listing_agent_id, is_demo
)
select f.customer_id, f.property_id, f.listing_id, 'PHYSICAL',
       (case when row_number() over (order by f.listing_id) % 2 = 0 then 'REQUESTED' else 'CONFIRMED' end)::public.visit_status,
       (current_date + interval '3 days')::date, '17:00', l.agent_id, l.agent_id, true
from public.favorites f
join public.listings l on l.id = f.listing_id
where l.status = 'VERIFIED'
limit 6;

-- ===========================================================================
-- 10 · Deal, attribution and commission  (§21–§23, §66 steps 14–18)
-- ===========================================================================
-- This reproduces the worked example in COMMISSION_ENGINE.md to the rupee.
-- The unit test `commission.test.ts` asserts that the engine, given these same
-- inputs, produces exactly these distributions — so the seed and the engine can
-- never silently drift apart.
-- ===========================================================================
do $$
declare
  d_id        uuid := pg_temp.demo_uuid('deal', 1);
  calc_id     uuid := pg_temp.demo_uuid('calculation', 1);
  rule_id     uuid;
  v_customer  uuid;
  v_property  uuid;
  v_listing   uuid;
  v_lead      uuid;
  agent_a     uuid;  -- listing agent + earliest qualifying visit
  agent_c     uuid;  -- sales agent + previous qualifying visit
  agent_e     uuid;  -- latest qualifying visit
  visit_1     uuid := pg_temp.demo_uuid('visit', 1);
  visit_2     uuid := pg_temp.demo_uuid('visit', 2);
  visit_3     uuid := pg_temp.demo_uuid('visit', 3);
  p_listing   uuid;
  p_sales     uuid;
  p_visit_e   uuid;
  p_visit_c   uuid;
  p_visit_a   uuid;
  p_platform  uuid;
begin
  select v.customer_id, v.property_id, v.listing_id, v.lead_id, v.listing_agent_id
    into v_customer, v_property, v_listing, v_lead, agent_a
    from public.visits v where v.id = visit_1;

  select id into agent_c from public.agents where user_id = pg_temp.demo_uuid('agent', 5);
  select id into agent_e from public.agents where user_id = pg_temp.demo_uuid('agent', 7);
  select id into rule_id from public.commission_rules where code = 'default-sale' and version = 1;

  -- ---- The deal ---------------------------------------------------------
  insert into public.deals (
    id, reference_code, customer_id, property_id, listing_id, lead_id,
    listing_type, status, asking_price, negotiated_price, final_price,
    booking_amount, currency, commission_pool, commission_pool_source,
    seller_name, seller_contact_masked, booked_at, closed_at, created_by, is_demo
  ) values (
    d_id, 'DEAL-NCR-000456', v_customer, v_property, v_listing, v_lead,
    'SALE', 'CLOSED_WON', 11500000, 11000000, 11000000,
    500000, 'INR', 500000, 'MANUAL',
    '[Demo] R. Khanna', '+91 98••••••44',
    now() - interval '5 days', now() - interval '2 days',
    pg_temp.demo_uuid('agent', 1), true
  );

  update public.leads set stage = 'CLOSED_WON', closed_at = now() - interval '2 days' where id = v_lead;

  -- ---- Participants -----------------------------------------------------
  insert into public.deal_participants (id, deal_id, role, agent_id, contribution_notes, added_by)
  values
    (pg_temp.demo_uuid('participant', 1), d_id, 'LISTING_AGENT',  agent_a, '[Demo] Sourced and listed the property; conducted the first qualifying visit.', pg_temp.demo_uuid('agent', 1)),
    (pg_temp.demo_uuid('participant', 2), d_id, 'SALES_AGENT',    agent_c, '[Demo] Owned the customer relationship and closed the negotiation.',        pg_temp.demo_uuid('agent', 1)),
    (pg_temp.demo_uuid('participant', 3), d_id, 'VISITING_AGENT', agent_e, '[Demo] Conducted the latest meaningful visit.',                            pg_temp.demo_uuid('agent', 1)),
    (pg_temp.demo_uuid('participant', 4), d_id, 'PLATFORM',       null,    '[Demo] Platform share.',                                                   pg_temp.demo_uuid('admin', 1));

  select id into p_listing  from public.deal_participants where deal_id = d_id and role = 'LISTING_AGENT';
  select id into p_sales    from public.deal_participants where deal_id = d_id and role = 'SALES_AGENT';
  select id into p_visit_e  from public.deal_participants where deal_id = d_id and role = 'VISITING_AGENT';
  select id into p_platform from public.deal_participants where deal_id = d_id and role = 'PLATFORM';

  -- ---- Visit attribution (frozen at calculation time) --------------------
  insert into public.visit_attributions (deal_id, visit_id, agent_id, tier, visit_rank, contribution_score, score_breakdown) values
    (d_id, visit_2, agent_e, 'LATEST',   1, 0.930,
      jsonb_build_object('recency', 0.35, 'customerConfirmation', 0.20, 'duration', 0.15, 'outcome', 0.15, 'interest', 0.10, 'negotiation', 0.05)),
    (d_id, visit_1, agent_c, 'PREVIOUS', 2, 0.746,
      jsonb_build_object('recency', 0.233, 'customerConfirmation', 0.20, 'duration', 0.15, 'outcome', 0.113, 'interest', 0.08, 'negotiation', 0.0)),
    (d_id, visit_3, agent_a, 'EARLIER',  3, 0.573,
      jsonb_build_object('recency', 0.117, 'customerConfirmation', 0.20, 'duration', 0.14, 'outcome', 0.056, 'interest', 0.06, 'negotiation', 0.0));

  -- ---- The commission calculation ---------------------------------------
  insert into public.commission_calculations (
    id, deal_id, rule_id, version, transaction_value, commission_pool, currency,
    policy_snapshot, explanation, engine_version, status, is_current,
    calculated_by, calculated_at, approved_by, approved_at
  ) values (
    calc_id, d_id, rule_id, 1, 11000000, 500000, 'INR',
    (select policy from public.commission_rules where id = rule_id),
    jsonb_build_array(
      jsonb_build_object('step','pool',   'detail','Commission pool agreed manually for this deal.', 'amount', 500000),
      jsonb_build_object('step','role',   'detail','Listing Agent 20% of pool',  'amount', 100000),
      jsonb_build_object('step','role',   'detail','Sales Agent 40% of pool',    'amount', 200000),
      jsonb_build_object('step','role',   'detail','Visit Pool 15% of pool',     'amount', 75000),
      jsonb_build_object('step','role',   'detail','Platform 25% of pool',       'amount', 125000),
      jsonb_build_object('step','visit',  'detail','Latest meaningful visit 50% of visit pool',   'amount', 37500),
      jsonb_build_object('step','visit',  'detail','Previous visit 25% of visit pool',            'amount', 18750),
      jsonb_build_object('step','visit',  'detail','Earlier qualifying visits 25% of visit pool', 'amount', 18750)
    ),
    'commission-v1', 'APPROVED', true,
    pg_temp.demo_uuid('admin', 1), now() - interval '2 days',
    pg_temp.demo_uuid('admin', 1), now() - interval '1 day'
  );

  -- ---- Distributions -----------------------------------------------------
  insert into public.commission_distributions
    (calculation_id, deal_id, participant_id, role, agent_id, visit_id, share_percent, amount, amount_minor, tier, contribution_score, calculation_basis)
  values
    (calc_id, d_id, p_listing,  'LISTING_AGENT',  agent_a, null,    20, 100000, 10000000, null, null,
      jsonb_build_object('basis','20% of commission pool 500000.00')),
    (calc_id, d_id, p_sales,    'SALES_AGENT',    agent_c, null,    40, 200000, 20000000, null, null,
      jsonb_build_object('basis','40% of commission pool 500000.00')),
    (calc_id, d_id, p_visit_e,  'VISITING_AGENT', agent_e, visit_2, 50,  37500,  3750000, 'LATEST',   0.930,
      jsonb_build_object('basis','50% of visit pool 75000.00')),
    (calc_id, d_id, null,       'VISITING_AGENT', agent_c, visit_1, 25,  18750,  1875000, 'PREVIOUS', 0.746,
      jsonb_build_object('basis','25% of visit pool 75000.00')),
    (calc_id, d_id, null,       'VISITING_AGENT', agent_a, visit_3, 25,  18750,  1875000, 'EARLIER',  0.573,
      jsonb_build_object('basis','25% of visit pool 75000.00')),
    (calc_id, d_id, p_platform, 'PLATFORM',       null,    null,    25, 125000, 12500000, null, null,
      jsonb_build_object('basis','25% of commission pool 500000.00'));

  -- ---- Ledger ------------------------------------------------------------
  insert into public.commission_ledger
    (deal_id, calculation_id, distribution_id, user_id, agent_id, role, entry_type, amount, amount_minor, currency, status, calculation_rule, approved_by, approved_at)
  select
    d_id, calc_id, cd.id,
    (select a.user_id from public.agents a where a.id = cd.agent_id),
    cd.agent_id, cd.role, 'EARNING', cd.amount, cd.amount_minor, 'INR',
    'APPROVED', 'default-sale v1',
    pg_temp.demo_uuid('admin', 1), now() - interval '1 day'
  from public.commission_distributions cd
  where cd.calculation_id = calc_id and cd.agent_id is not null;

  insert into public.commission_ledger
    (deal_id, calculation_id, distribution_id, role, entry_type, amount, amount_minor, currency, status, calculation_rule, approved_by, approved_at)
  select d_id, calc_id, cd.id, 'PLATFORM', 'EARNING', cd.amount, cd.amount_minor, 'INR',
         'APPROVED', 'default-sale v1', pg_temp.demo_uuid('admin', 1), now() - interval '1 day'
  from public.commission_distributions cd
  where cd.calculation_id = calc_id and cd.role = 'PLATFORM';
end $$;

-- A second deal, still in negotiation, so the pipeline is not all closed.
insert into public.deals (customer_id, property_id, listing_id, listing_type, status,
                          asking_price, negotiated_price, currency, created_by, is_demo)
select l2.customer_id, l2.property_id, l2.listing_id, 'SALE', 'NEGOTIATION',
       li.price, round(li.price * 0.97, 2), 'INR', a.user_id, true
from public.leads l2
join public.listings li on li.id = l2.listing_id
join public.agents a on a.id = l2.sales_agent_id
where l2.stage = 'NEGOTIATION' and l2.is_demo
limit 1;

-- ===========================================================================
-- 11 · Reviews, notifications, disputes
-- ===========================================================================
insert into public.reviews (subject_type, agent_id, author_id, customer_id, rating, title, body, is_verified_interaction, moderation_status, moderated_by, moderated_at, is_demo)
select 'AGENT', vf.agent_id, c.user_id, vf.customer_id, vf.agent_rating,
       '[Demo] Professional and responsive',
       '[Demo] Showed the property on time, answered every question about the society and the paperwork.',
       true, 'APPROVED', pg_temp.demo_uuid('admin', 1), now() - interval '3 days', true
from public.visit_feedback vf
join public.customers c on c.id = vf.customer_id
where vf.agent_id is not null;

-- One review awaiting moderation, so the admin queue is not empty.
insert into public.reviews (subject_type, agent_id, author_id, customer_id, rating, title, body, is_verified_interaction, moderation_status, is_demo)
select 'AGENT', a.id, c.user_id, c.id, 3,
       '[Demo] Good, but slow to respond',
       '[Demo] The property matched the listing, but it took two days to get a callback.',
       true, 'PENDING', true
from public.agents a
join public.customers c on c.user_id = pg_temp.demo_uuid('customer', 2)
where a.user_id = pg_temp.demo_uuid('agent', 3);

insert into public.notifications (user_id, template_key, channel, event_type, title, body, action_url, entity_type, status, sent_at)
select a.user_id, 'commission.approved', 'IN_APP', 'commission.approved',
       'Commission approved',
       'Your commission of INR ' || to_char(cl.amount, 'FM99,99,99,990') || ' for deal DEAL-NCR-000456 has been approved for payout.',
       '/agent/commissions', 'DEAL', 'SENT', now() - interval '1 day'
from public.commission_ledger cl
join public.agents a on a.id = cl.agent_id
where cl.agent_id is not null;

insert into public.notifications (user_id, template_key, channel, event_type, title, body, action_url, entity_type, status, sent_at)
select c.user_id, 'visit.completed', 'IN_APP', 'visit.completed',
       'How was your visit?',
       'Tell us how your recent property visit went. Your feedback confirms the visit.',
       '/dashboard/visits', 'VISIT', 'SENT', now() - interval '8 days'
from public.customers c
where exists (select 1 from public.profiles p where p.id = c.user_id and p.is_demo);

-- An open commission dispute for the admin dispute queue.
insert into public.disputes (
  category, status, priority, raised_by, raised_by_agent_id,
  entity_type, entity_id, title, description, claimed_amount, currency
)
select 'VISIT_ATTRIBUTION', 'OPEN', 'MEDIUM',
       a.user_id, a.id, 'COMMISSION', pg_temp.demo_uuid('deal', 1),
       '[Demo] Visit attribution on DEAL-NCR-000456',
       '[Demo] I conducted an unrecorded site visit with this customer before the listing agent. Requesting a review of the visit pool split.',
       18750, 'INR'
from public.agents a
where a.user_id = pg_temp.demo_uuid('agent', 3);

-- ===========================================================================
-- 12 · Investor / exclusive inventory demo  (module disabled by default)
-- ===========================================================================
-- Note the agreement is left in PENDING_LEGAL_REVIEW: the database constraint
-- `agreements_active_requires_legal_review` makes it structurally impossible to
-- activate exclusivity without a recorded human legal review.
-- ===========================================================================
insert into public.investor_opportunities (
  id, property_id, listing_id, created_by, title, summary, agreement_type,
  seller_price, capital_amount, target_exit_price, expected_margin,
  platform_fee_percent, currency, holding_period_months, status, eligibility, risk_notes, is_demo
)
select
  pg_temp.demo_uuid('opportunity', 1), l.property_id, l.id, pg_temp.demo_uuid('admin', 1),
  '[Demo] Exclusive distribution rights — ' || l.locality || ', ' || l.city,
  '[Demo] Indicative economics for exclusive distribution rights over a verified, ready-to-move unit.',
  'DISTRIBUTION_RIGHTS',
  10000000, 2500000, 11000000, 1000000, 2.5, 'INR', 12,
  'AVAILABLE',
  jsonb_build_object('cities', array['Noida','Greater Noida'], 'minTicket', 2000000, 'requiresKyc', true),
  '[Demo] Illustrative only. Not an offer of securities and not an agreement to sell immovable property.',
  true
from public.listings l
where l.status = 'VERIFIED' and l.is_demo and l.listing_type = 'SALE'
order by l.price desc offset 1 limit 1;

insert into public.investor_interests (opportunity_id, investor_id, status, proposed_capital, message)
select pg_temp.demo_uuid('opportunity', 1), i.id, 'INTERESTED', 2500000,
       '[Demo] Interested subject to documentation and legal review.'
from public.investors i
where i.user_id = pg_temp.demo_uuid('investor', 1);

insert into public.agreements (
  agreement_type, status, opportunity_id, property_id, investor_id,
  template_key, terms, capital_amount, exit_price, expected_margin,
  platform_fee_percent, investor_share_percent, currency,
  starts_on, ends_on, created_by, is_demo
)
select
  'DISTRIBUTION_RIGHTS', 'PENDING_LEGAL_REVIEW',
  pg_temp.demo_uuid('opportunity', 1), o.property_id, i.id,
  'distribution-rights-v1',
  jsonb_build_object(
    'scope', 'Exclusive distribution rights for the stated period',
    'noTransferOfInterest', true,
    'requiresCounselApproval', true
  ),
  2500000, 11000000, 1000000, 2.5, 70, 'INR',
  current_date, current_date + interval '12 months',
  pg_temp.demo_uuid('admin', 1), true
from public.investor_opportunities o
join public.investors i on i.user_id = pg_temp.demo_uuid('investor', 1)
where o.id = pg_temp.demo_uuid('opportunity', 1);

-- ===========================================================================
-- 13 · Duplicate-detection queue (admin has real work to adjudicate)
-- ===========================================================================
insert into public.property_duplicate_candidates (property_id, candidate_id, confidence, signals, status)
select p1.id, p2.id, 82.5,
  jsonb_build_object(
    'sameProject', true, 'sameTower', true, 'areaDeltaPercent', 0.0,
    'distanceMeters', 12, 'priceDeltaPercent', 3.2,
    'note', 'Demo record: queued for human adjudication. The platform never auto-merges passports.'
  ),
  'PENDING'
from public.property_passports p1
join public.property_passports p2
  on p2.project_id = p1.project_id and p2.id <> p1.id and p2.bedrooms = p1.bedrooms
where p1.is_demo and p1.project_id is not null
order by p1.reference_code
limit 3;

-- ===========================================================================
-- 14 · Directory and inventory breadth
-- ===========================================================================
-- Everything above tells ONE story end to end (§66): a property, a visit, a
-- deal, a commission. This section widens the demo instead of deepening it, so
-- that search, filters and the agent directory have something to work with —
-- ten more agents, and inventory in every supported city, including commercial
-- space and plots.
--
-- It only ADDS rows, at fresh indices (agents 11-20, passports 31-90, listings
-- 41-130). Nothing above is re-derived, so the §66 scenario is untouched.
-- ===========================================================================

-- 10 more agents, weighted to the cities the story above does not visit.
select pg_temp.create_demo_user(
  pg_temp.demo_uuid('agent', 10 + n),
  'agent' || (10 + n) || '@demo.getmespace.test',
  jsonb_build_object(
    'full_name', '[Demo] ' || (array[
      'Farhan Sheikh','Ananya Ghosh','Vivek Rane','Pooja Bhatt','Harpreet Singh',
      'Lakshmi Menon','Nikhil Joshi','Shruti Deshpande','Aakash Yadav','Zoya Khan'
    ])[n],
    'role', 'agent',
    'phone', (array['9820013011','9830013012','9890013013','9860013014','9814013015',
                    '9895013016','9822013017','9823013018','9810013019','9840013020'])[n]
  )
)
from generate_series(1, 10) n;

-- The profile hygiene applied to the first cohort, applied to this one too.
update public.profiles
   set is_demo = true,
       email_verified_at = coalesce(email_verified_at, now()),
       phone_verified_at = coalesce(phone_verified_at, now()),
       consent_terms_at = coalesce(consent_terms_at, now()),
       consent_privacy_at = coalesce(consent_privacy_at, now())
 where email like '%@demo.getmespace.test';

with agent_data as (
  select * from (values
    (11, 'farhan-sheikh-mum',      'Sheikh Realty',        'Mumbai',        array['Mumbai','Thane'],           array['Andheri West','Bandra East','Powai'],          9,  'RERA_VERIFIED',     87.0, 4.6, 92.0),
    (12, 'ananya-ghosh-blr',       'Ghosh Property Co',    'Bengaluru',     array['Bengaluru'],                array['HSR Layout','Sarjapur Road','Whitefield'],     6,  'BUSINESS_VERIFIED', 77.0, 4.4, 86.0),
    (13, 'vivek-rane-pnq',         'Rane Estates',         'Pune',          array['Pune'],                     array['Baner','Hinjewadi','Kharadi'],                 11, 'RERA_VERIFIED',     90.0, 4.7, 94.0),
    (14, 'pooja-bhatt-pnq',        'Bhatt Homes',          'Pune',          array['Pune'],                     array['Hinjewadi','Wakad','Baner'],                   4,  'IDENTITY_VERIFIED', 62.0, 4.1, 78.0),
    (15, 'harpreet-singh-ncr',     'Singh Realtors',       'Delhi',         array['Delhi','Gurgaon'],          array['Dwarka','Saket','Golf Course Extension'],      13, 'PLATFORM_TRUSTED',  94.0, 4.8, 97.0),
    (16, 'lakshmi-menon-hyd',      'Menon Realty',         'Hyderabad',     array['Hyderabad'],                array['Gachibowli','Kondapur','Madhapur'],            8,  'RERA_VERIFIED',     85.0, 4.5, 90.0),
    (17, 'nikhil-joshi-hyd',       'Joshi Property Hub',   'Hyderabad',     array['Hyderabad'],                array['Kondapur','Gachibowli'],                       3,  'IDENTITY_VERIFIED', 57.0, 3.9, 74.0),
    (18, 'shruti-deshpande-ncr',   'Deshpande Estates',    'Greater Noida', array['Greater Noida','Noida'],    array['Knowledge Park','Noida Extension','Sector 76'], 7, 'BUSINESS_VERIFIED', 80.0, 4.3, 87.0),
    (19, 'aakash-yadav-ncr',       'Yadav Associates',     'Ghaziabad',     array['Ghaziabad','Delhi'],        array['Raj Nagar Extension','Indirapuram'],           5,  'IDENTITY_VERIFIED', 64.0, 4.0, 79.0),
    (20, 'zoya-khan-lko',          'Khan Realty',          'Lucknow',       array['Lucknow'],                  array['Hazratganj','Gomti Nagar'],                    12, 'RERA_VERIFIED',     89.0, 4.7, 93.0)
  ) as t(n, slug, agency, city, cities, localities, years, level, trust, rating, response)
)
update public.agents a
   set slug = d.slug,
       agency_name = d.agency,
       headline = d.agency || ' · ' || d.years || ' years in ' || d.city,
       bio = '[Demo] ' || d.agency || ' specialises in ' || array_to_string(d.localities, ', ')
             || '. ' || d.years || ' years of local transaction experience.',
       experience_years = d.years,
       service_cities = d.cities,
       service_localities = d.localities,
       -- Specialisations vary so the directory's filter returns different sets.
       specializations = case
         when d.n % 4 = 0 then array['APARTMENT','STUDIO','SERVICED_APARTMENT']::public.property_type[]
         when d.n % 4 = 1 then array['APARTMENT','BUILDER_FLOOR','PENTHOUSE']::public.property_type[]
         when d.n % 4 = 2 then array['VILLA','INDEPENDENT_HOUSE','PLOT']::public.property_type[]
         else array['OFFICE','SHOP','CO_WORKING']::public.property_type[]
       end,
       languages = case
         when d.city in ('Mumbai','Pune') then array['English','Hindi','Marathi']
         when d.city = 'Bengaluru' then array['English','Hindi','Telugu']
         when d.city = 'Hyderabad' then array['English','Hindi','Telugu']
         else array['English','Hindi']
       end,
       verification_level = d.level::public.verification_level,
       badges = case d.level
                  when 'PLATFORM_TRUSTED' then array['IDENTITY_VERIFIED','RERA_VERIFIED','TRUSTED_AGENT','TOP_PERFORMER']
                  when 'RERA_VERIFIED'    then array['IDENTITY_VERIFIED','RERA_VERIFIED','TRUSTED_AGENT']
                  when 'BUSINESS_VERIFIED' then array['IDENTITY_VERIFIED']
                  else array['IDENTITY_VERIFIED']
                end::public.agent_badge[],
       trust_score = d.trust,
       rating_average = d.rating,
       rating_count = 8 + d.n,
       response_rate = d.response,
       response_time_minutes = 15 + d.n * 2,
       visit_completion_rate = least(99, 70 + d.n),
       cancellation_rate = greatest(0, 20 - d.n),
       conversion_rate = 6 + (d.n % 11),
       closed_deal_count = 2 + (d.n % 14),
       accepts_visit_requests = true,
       max_visit_distance_km = 20,
       base_latitude  = 28.5000 + (d.n * 0.01),
       base_longitude = 77.3900 + (d.n * 0.01),
       status = 'ACTIVE',
       is_demo = true
  from agent_data d
 where a.user_id = pg_temp.demo_uuid('agent', d.n);

update public.profiles p
   set city = a.service_cities[1]
  from public.agents a
 where a.user_id = p.id and a.is_demo;

-- RERA records and an approved identity check for the new cohort only.
insert into public.agent_rera_records (agent_id, rera_number, state, authority, registered_name, valid_from, valid_until, status, verified_at)
select a.id,
       'RERAAGT' || lpad((20000 + row_number() over (order by a.slug))::text, 6, '0'),
       'Uttar Pradesh', 'UP-RERA', a.agency_name,
       current_date - interval '14 months', current_date + interval '22 months',
       'APPROVED', now()
  from public.agents a
 where a.is_demo and 'RERA_VERIFIED' = any(a.badges)
   and not exists (select 1 from public.agent_rera_records r where r.agent_id = a.id);

insert into public.agent_verifications (agent_id, level, status, legal_name, business_name, submitted_at, reviewed_at)
select a.id, 'IDENTITY_VERIFIED', 'APPROVED', p.full_name, a.agency_name, now() - interval '25 days', now() - interval '24 days'
  from public.agents a join public.profiles p on p.id = a.user_id
 where a.is_demo
   and not exists (select 1 from public.agent_verifications v where v.agent_id = a.id);

-- ---------------------------------------------------------------------------
-- 60 more passports across every supported city, with commercial and land
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  idx integer;
  pid uuid;
  beds smallint;
  area numeric;
  ptype public.property_type;
  pcat public.property_category;
  is_res boolean;
  cities  text[] := array['Noida','Noida','Greater Noida','Greater Noida','Ghaziabad','Ghaziabad','Gurgaon','Gurgaon','Delhi','Delhi','Mumbai','Mumbai','Bengaluru','Bengaluru','Pune','Pune','Hyderabad','Hyderabad','Lucknow','Lucknow'];
  locs    text[] := array['Sector 137','Sector 76','Noida Extension','Knowledge Park','Indirapuram','Raj Nagar Extension','Sohna Road','Golf Course Extension','Dwarka','Saket','Powai','Andheri West','Whitefield','HSR Layout','Baner','Hinjewadi','Gachibowli','Kondapur','Gomti Nagar','Hazratganj'];
  states  text[] := array['Uttar Pradesh','Uttar Pradesh','Uttar Pradesh','Uttar Pradesh','Uttar Pradesh','Uttar Pradesh','Haryana','Haryana','Delhi','Delhi','Maharashtra','Maharashtra','Karnataka','Karnataka','Maharashtra','Maharashtra','Telangana','Telangana','Uttar Pradesh','Uttar Pradesh'];
  pins    text[] := array['201305','201301','201306','201310','201014','201017','122018','122003','110075','110017','400076','400053','560066','560102','411045','411057','500032','500084','226010','226001'];
  regions text[] := array['NCR','NCR','NCR','NCR','NCR','NCR','NCR','NCR','NCR','NCR','MUM','MUM','BLR','BLR','PNQ','PNQ','HYD','HYD','LKO','LKO'];
  lats    numeric[] := array[28.5041,28.5700,28.6100,28.4700,28.6450,28.7100,28.4089,28.4200,28.5921,28.5245,19.1176,19.1364,12.9698,12.9116,18.5590,18.5975,17.4400,17.4700,26.8500,26.8467];
  lngs    numeric[] := array[77.3910,77.3600,77.4400,77.5000,77.3550,77.4400,77.0400,77.0700,77.0460,77.2066,72.9060,72.8296,77.7500,77.6389,73.7868,73.7398,78.3489,78.3600,81.0000,80.9462];
  types   public.property_type[] := array['APARTMENT','STUDIO','APARTMENT','BUILDER_FLOOR','APARTMENT','VILLA','PENTHOUSE','APARTMENT','INDEPENDENT_HOUSE','APARTMENT','OFFICE','SHOP','PLOT','APARTMENT','SERVICED_APARTMENT'];
begin
  for n in 31..90 loop
    idx   := 1 + (n % 20);
    ptype := types[1 + (n % 15)];
    pcat  := case
               when ptype in ('OFFICE','SHOP','SHOWROOM','CO_WORKING') then 'COMMERCIAL'
               when ptype = 'PLOT' then 'LAND'
               else 'RESIDENTIAL'
             end::public.property_category;
    is_res := pcat = 'RESIDENTIAL';
    beds  := case when is_res then (1 + (n % 4))::smallint else null end;
    area  := case
               when ptype = 'PLOT' then 900 + ((n % 8) * 300)
               when is_res then 480 + (coalesce(beds, 1) * 340) + ((n % 6) * 55)
               else 620 + ((n % 9) * 240)
             end;

    pid := pg_temp.demo_uuid('property', n);

    insert into public.property_passports (
      id, region_code, property_type, category, project_id,
      tower, unit_number, floor, total_floors,
      carpet_area, built_up_area, super_built_up_area, plot_area,
      bedrooms, bathrooms, balconies, facing, age_years,
      ownership_type, status, verification_status, verification_score,
      last_verified_at, next_verification_at, created_by, is_demo
    ) values (
      pid, regions[idx], ptype, pcat, null,
      case when ptype = 'PLOT' then null else 'Tower ' || chr(65 + (n % 6)) end,
      (200 + n)::text,
      case when ptype = 'PLOT' then null else 1 + (n % 16) end,
      case when ptype = 'PLOT' then null else 18 + (n % 8) end,
      case when ptype = 'PLOT' then null else round(area * 0.71, 2) end,
      case when ptype = 'PLOT' then null else area end,
      case when ptype = 'PLOT' then null else round(area * 1.19, 2) end,
      case when ptype = 'PLOT' then area else null end,
      beds,
      case when is_res then greatest(1, coalesce(beds, 1) - 1)::smallint
           when ptype = 'PLOT' then null else 2::smallint end,
      case when is_res then (n % 3)::smallint else null end,
      (array['NORTH','EAST','SOUTH','WEST','NORTH_EAST','SOUTH_EAST','NORTH_WEST','SOUTH_WEST']::public.facing_direction[])[1 + (n % 8)],
      case when ptype = 'PLOT' then null else (n % 12)::smallint end,
      'FREEHOLD', 'ACTIVE', 'APPROVED', 68 + (n % 32),
      now() - interval '8 days', now() + interval '82 days',
      pg_temp.demo_uuid('agent', 1 + (n % 20)), true
    );

    insert into public.property_addresses (
      property_id, address_line1, locality, city, state, pincode, country,
      latitude, longitude, is_exact_location_public
    ) values (
      pid,
      case when ptype = 'PLOT' then 'Plot ' || (200 + n)
           else 'Tower ' || chr(65 + (n % 6)) || ', Unit ' || (200 + n) end,
      locs[idx], cities[idx], states[idx], pins[idx], 'IN',
      lats[idx] + ((n % 40) * 0.0009), lngs[idx] + ((n % 40) * 0.0009), false
    );

    insert into public.property_amenities (property_id, amenity_key)
    select pid, k from unnest(
      case when pcat = 'COMMERCIAL' then array['lift','power_backup','security_24x7','covered_parking']
           when pcat = 'LAND' then array['security_24x7']
           else array['lift','power_backup','security_24x7','covered_parking','park'] end) k
    on conflict do nothing;

    if is_res and n % 2 = 1 then
      insert into public.property_amenities (property_id, amenity_key)
      select pid, k from unnest(array['gym','swimming_pool','clubhouse','kids_play_area']) k on conflict do nothing;
    end if;

    insert into public.property_nearby_places (property_id, place_type, name, distance_km, travel_minutes) values
      (pid, 'METRO',     'Metro Station',             round((0.5 + (n % 6) * 0.35)::numeric, 2), 4 + (n % 11)),
      (pid, 'SCHOOL',    'International School',       round((0.9 + (n % 5) * 0.45)::numeric, 2), 7 + (n % 9)),
      (pid, 'HOSPITAL',  'Multi-speciality Hospital',  round((1.1 + (n % 7) * 0.5)::numeric, 2), 8 + (n % 13)),
      (pid, 'MALL',      'Shopping Mall',              round((1.6 + (n % 4) * 0.8)::numeric, 2), 12 + (n % 8)),
      (pid, 'OFFICE_HUB','Business Park',              round((2.2 + (n % 5) * 0.95)::numeric, 2), 15 + (n % 15));

    insert into public.property_media (property_id, media_type, external_url, caption, alt_text, sort_order, is_primary)
    values (pid, 'IMAGE',
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + (n % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      '[Demo] Living area', 'Demo property photograph', 0, true);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 90 more listings over those passports, spread across all 20 agents
-- ---------------------------------------------------------------------------
do $$
declare
  n integer;
  pid uuid; lid uuid;
  agent_row public.agents%rowtype;
  pp public.property_passports%rowtype;
  addr public.property_addresses%rowtype;
  ltype public.listing_type;
  price numeric;
  prop_index integer;
  status public.listing_status;
  is_res boolean;
begin
  for n in 41..130 loop
    -- 60 passports, 90 listings: 30 of them are a SECOND agent listing a
    -- property someone else already listed, which is the network effect.
    prop_index := 31 + ((n - 41) % 60);
    pid := pg_temp.demo_uuid('property', prop_index);
    lid := pg_temp.demo_uuid('listing', n);

    select * into pp   from public.property_passports where id = pid;
    select * into addr from public.property_addresses where property_id = pid;
    select * into agent_row from public.agents
     where user_id = pg_temp.demo_uuid('agent', 1 + (n % 20));

    is_res := pp.category = 'RESIDENTIAL';
    ltype  := case when n % 4 = 0 then 'RENT' else 'SALE' end;
    price  := case
                when ltype = 'RENT' then
                  case when is_res then 16000 + (coalesce(pp.bedrooms, 1) * 9500) + ((n % 7) * 2200)
                       else 55000 + ((n % 9) * 12000) end
                else
                  case when pp.category = 'LAND' then 3800000 + ((n % 11) * 640000)
                       when is_res then 3900000 + (coalesce(pp.bedrooms, 1) * 2250000) + ((n % 12) * 410000)
                       else 9500000 + ((n % 10) * 1250000) end
              end;

    -- Nearly all live: this data exists to populate search.
    status := case when n % 23 = 0 then 'SUBMITTED' else 'VERIFIED' end;

    insert into public.listings (
      id, property_id, agent_id, title, slug, description, highlights,
      listing_type, status, price, is_negotiable, maintenance_charge,
      security_deposit, brokerage_type, brokerage_value,
      property_type, category, bedrooms, bathrooms, balconies,
      built_up_area, carpet_area, floor, total_floors, facing, furnishing,
      age_years, possession_status, available_from,
      covered_parking, open_parking, power_backup, water_supply,
      city, locality, state, pincode, latitude, longitude,
      cover_image_url, youtube_url, virtual_tour_url,
      is_shareable, submitted_at, reviewed_by, reviewed_at,
      verification_score, published_at, expires_at,
      view_count, enquiry_count, is_demo
    ) values (
      lid, pid, agent_row.id,
      case when is_res
           then pp.bedrooms || ' BHK ' ||
                replace(initcap(replace(pp.property_type::text, '_', ' ')), 'Bhk', 'BHK') ||
                ' in ' || addr.locality || ', ' || addr.city
           else initcap(replace(pp.property_type::text, '_', ' ')) ||
                ' space in ' || addr.locality || ', ' || addr.city
      end,
      lower(regexp_replace(
        coalesce(pp.bedrooms::text || '-bhk-', '') ||
        replace(lower(pp.property_type::text), '_', '-') || '-' ||
        addr.locality || '-' || addr.city || '-' || right(lid::text, 8),
        '[^a-z0-9]+', '-', 'g')),
      '[Demo] ' ||
        case when is_res
             then 'A ' || pp.bedrooms || ' BHK ' || lower(replace(pp.property_type::text, '_', ' '))
             else initcap(replace(pp.property_type::text, '_', ' ')) end ||
        ' of ' || coalesce(pp.built_up_area, pp.plot_area) || ' sq ft in ' ||
        addr.locality || ', ' || addr.city || '. ' ||
        case when ltype = 'RENT' then 'Available on rent. ' else 'Available for sale. ' end ||
        'Verified on the network with a complete property passport.',
      case when pp.category = 'COMMERCIAL'
           then array['Verified property passport', 'Ready to fit out', 'On a main arterial road']
           when pp.category = 'LAND'
           then array['Verified property passport', 'Clear demarcation', 'Gated layout']
           else array['Verified property passport', 'Gated community', 'Close to metro and schools']
      end,
      ltype, status, price, true,
      case when ltype = 'SALE' and is_res then 2400 + (coalesce(pp.bedrooms, 1) * 850) else null end,
      case when ltype = 'RENT' then price * 2 else null end,
      'PERCENT', case when ltype = 'RENT' then 100 else 1.5 end,
      pp.property_type, pp.category, pp.bedrooms, pp.bathrooms, pp.balconies,
      pp.built_up_area, pp.carpet_area, pp.floor, pp.total_floors, pp.facing,
      case when is_res
           then (array['UNFURNISHED','SEMI_FURNISHED','FULLY_FURNISHED']::public.furnishing_status[])[1 + (n % 3)]
           else 'UNFURNISHED'::public.furnishing_status end,
      pp.age_years,
      (array['READY_TO_MOVE','READY_TO_MOVE','READY_TO_MOVE','RESALE','UNDER_CONSTRUCTION','NEW_LAUNCH']::public.possession_status[])[1 + (n % 6)],
      current_date + ((n % 45) || ' days')::interval,
      case when pp.category = 'LAND' then 0 else 1 + (n % 2) end, (n % 3),
      'FULL', 'Municipal + Borewell',
      addr.city, addr.locality, addr.state, addr.pincode, addr.latitude, addr.longitude,
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + (n % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      case when n % 7 = 0 then 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' else null end,
      -- No placeholder tour URL: example.com cannot be embedded, so it would
      -- render as "this content is blocked" or a dead link. Demo media comes
      -- from youtube_url above, which is on the embed allowlist.
      null,
      true,
      now() - interval '9 days',
      case when status = 'VERIFIED' then pg_temp.demo_uuid('admin', 1) else null end,
      case when status = 'VERIFIED' then now() - interval '8 days' else null end,
      case when status = 'VERIFIED' then 70 + (n % 30) else 0 end,
      case when status = 'VERIFIED' then now() - ((n % 30) || ' days')::interval else null end,
      now() + interval '90 days',
      25 + (n * 11) % 900, (n % 12), true
    );

    insert into public.listing_media (listing_id, media_type, external_url, caption, sort_order, is_primary)
    select lid, 'IMAGE',
      'https://images.unsplash.com/photo-' ||
        (array['1560448204-e02f11c3d0e2','1502672260266-1c1ef2d93688','1512917774080-9991f1c4c750',
               '1493809842364-78817add7ffb','1522708323590-d24dbb6b0267','1567496898669-ee935f5f647a'])[1 + ((n + g) % 6)]
        || '?auto=format&fit=crop&w=1600&q=70',
      '[Demo] Photo ' || g, g, g = 0
    from generate_series(0, 3) g;
  end loop;
end $$;

-- ===========================================================================
-- Summary
-- ===========================================================================
do $$
declare
  rec record;
begin
  raise notice '--- Demo seed complete ---';
  for rec in
    select 'agents' as entity, count(*) from public.agents where is_demo
    union all select 'customers', count(*) from public.customers where is_demo
    union all select 'investors', count(*) from public.investors where is_demo
    union all select 'property passports', count(*) from public.property_passports where is_demo
    union all select 'listings', count(*) from public.listings where is_demo
    union all select 'listings (live)', count(*) from public.listings where is_demo and status = 'VERIFIED'
    union all select 'inventory shares', count(*) from public.listing_shares
    union all select 'requirements', count(*) from public.customer_requirements where is_demo
    union all select 'leads', count(*) from public.leads where is_demo
    union all select 'visits', count(*) from public.visits where is_demo
    union all select 'qualified visits', count(*) from public.visits where is_demo and is_qualified
    union all select 'deals', count(*) from public.deals where is_demo
    union all select 'commission ledger entries', count(*) from public.commission_ledger
  loop
    raise notice '  % : %', rpad(rec.entity, 28), rec.count;
  end loop;
end $$;

commit;
