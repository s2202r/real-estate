-- ===========================================================================
-- Additional demo inventory  (add-on, not a reseed)
-- ===========================================================================
-- Run this when supabase/seed.sql has ALREADY been applied and you want the
-- wider inventory added on top: ten more agents, sixty more property
-- passports across all ten supported cities, and ninety more listings —
-- including commercial space and plots.
--
-- It is the same section 14 that seed.sql now ends with, extracted so an
-- existing database can pick it up WITHOUT losing anything. Nothing here
-- touches a row that seed.sql created: every identifier is at a fresh index
-- (agents 11-20, passports 31-90, listings 41-130).
--
-- If your database has no demo data at all, run supabase/seed.sql instead —
-- it already includes this section.
-- ===========================================================================

-- pgcrypto lives in the `extensions` schema on hosted Supabase and in `public`
-- on a plain Postgres, so crypt()/gen_salt() are resolved from either.
set search_path = public, extensions, pg_temp;

begin;

do $$
begin
  if to_regclass('public.user_roles') is null then
    raise exception using
      message = 'Schema not found: the migrations have not been applied to this database.',
      detail  = 'This file only inserts demo data; it does not create tables.',
      hint    = 'Run supabase/schema.sql first, then supabase/seed.sql, then this file.';
  end if;

  if not exists (select 1 from public.profiles where is_demo limit 1) then
    raise exception using
      message = 'No demo data found in this database.',
      detail  = 'This file adds inventory alongside what seed.sql creates; it does not create the base cohort.',
      hint    = 'Run supabase/seed.sql first — it already contains everything in this file.';
  end if;

  -- Fixed identifiers again, so say so up front rather than failing on a
  -- primary key violation two hundred rows in.
  if exists (select 1 from public.agents a
              join public.profiles p on p.id = a.user_id
             where p.email = 'agent11@demo.getmespace.test') then
    raise exception using
      message = 'This additional inventory is already present.',
      detail  = 'agent11@demo.getmespace.test exists, so this file has been run before.',
      hint    = 'Nothing to do.';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- Helpers, repeated here because pg_temp functions live for one session only
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
      null,
      case when n % 9 = 0 then 'https://example.com/demo-virtual-tour' else null end,
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

commit;

do $$
declare
  rec record;
begin
  raise notice '--- Additional inventory loaded ---';
  for rec in
    select 'agents' as entity, count(*) from public.agents where is_demo
    union all select 'property passports', count(*) from public.property_passports where is_demo
    union all select 'listings', count(*) from public.listings where is_demo
    union all select 'listings (live)', count(*) from public.listings where is_demo and status = 'VERIFIED'
  loop
    raise notice '  % : %', rpad(rec.entity, 22), rec.count;
  end loop;
end $$;
