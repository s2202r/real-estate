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

-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000001_extensions_and_enums.sql
-- ===========================================================================

-- ===========================================================================
-- 0001 · Extensions, domains and enumerated types
-- ===========================================================================
-- Every enum used by the platform is declared here so that later migrations
-- never invent a status string ad hoc. Statuses are part of the domain model,
-- not free text.
-- ===========================================================================

create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy search / duplicate detection
create extension if not exists "unaccent";      -- search normalisation
create extension if not exists "btree_gist";    -- exclusion constraints
create extension if not exists "citext";        -- case-insensitive email

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
-- Financial values are NUMERIC, never floating point. Arithmetic happens in the
-- application in integer minor units (paise); this domain is the storage form.
-- ---------------------------------------------------------------------------
do $$ begin
  create domain public.money_amount as numeric(14,2)
    check (value >= 0);
exception when duplicate_object then null; end $$;

do $$ begin
  create domain public.currency_code as char(3)
    check (value ~ '^[A-Z]{3}$');
exception when duplicate_object then null; end $$;

do $$ begin
  create domain public.percentage as numeric(7,4)
    check (value >= 0 and value <= 100);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'customer', 'agent', 'investor', 'admin'
);

create type public.admin_role as enum (
  'super_admin', 'operations_admin', 'verification_admin',
  'finance_admin', 'support_admin', 'content_admin'
);

create type public.account_status as enum (
  'ACTIVE', 'PENDING', 'SUSPENDED', 'DEACTIVATED'
);

create type public.verification_level as enum (
  'NONE', 'IDENTITY_VERIFIED', 'BUSINESS_VERIFIED', 'RERA_VERIFIED', 'PLATFORM_TRUSTED'
);

create type public.verification_status as enum (
  'NOT_SUBMITTED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'
);

create type public.agent_badge as enum (
  'IDENTITY_VERIFIED', 'RERA_VERIFIED', 'TRUSTED_AGENT', 'TOP_PERFORMER'
);

create type public.document_type as enum (
  'PAN', 'AADHAAR', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID',
  'GST_CERTIFICATE', 'BUSINESS_REGISTRATION', 'BANK_PROOF',
  'RERA_CERTIFICATE', 'SALE_DEED', 'REGISTRY', 'MUTATION',
  'ALLOTMENT_LETTER', 'POSSESSION_LETTER', 'BUILDER_NOC',
  'OCCUPANCY_CERTIFICATE', 'COMPLETION_CERTIFICATE',
  'FLOOR_PLAN', 'BROCHURE', 'ENCUMBRANCE_CERTIFICATE',
  'PROPERTY_TAX_RECEIPT', 'AGREEMENT', 'OTHER'
);

-- ---------------------------------------------------------------------------
-- Property
-- ---------------------------------------------------------------------------
create type public.property_type as enum (
  'APARTMENT', 'INDEPENDENT_HOUSE', 'VILLA', 'BUILDER_FLOOR', 'PENTHOUSE',
  'STUDIO', 'PLOT', 'FARMHOUSE', 'OFFICE', 'SHOP', 'SHOWROOM',
  'WAREHOUSE', 'INDUSTRIAL', 'CO_WORKING', 'SERVICED_APARTMENT', 'OTHER'
);

create type public.property_category as enum (
  'RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND'
);

create type public.property_status as enum (
  'DRAFT', 'PENDING_VERIFICATION', 'ACTIVE', 'RESERVED', 'UNDER_NEGOTIATION',
  'BOOKED', 'SOLD', 'RENTED', 'EXPIRED', 'SUSPENDED', 'ARCHIVED'
);

create type public.ownership_type as enum (
  'FREEHOLD', 'LEASEHOLD', 'POWER_OF_ATTORNEY', 'CO_OPERATIVE_SOCIETY', 'UNKNOWN'
);

create type public.facing_direction as enum (
  'NORTH', 'SOUTH', 'EAST', 'WEST',
  'NORTH_EAST', 'NORTH_WEST', 'SOUTH_EAST', 'SOUTH_WEST'
);

create type public.furnishing_status as enum (
  'UNFURNISHED', 'SEMI_FURNISHED', 'FULLY_FURNISHED'
);

create type public.possession_status as enum (
  'READY_TO_MOVE', 'UNDER_CONSTRUCTION', 'NEW_LAUNCH', 'RESALE'
);

create type public.nearby_place_type as enum (
  'METRO', 'BUS_STOP', 'RAILWAY_STATION', 'AIRPORT', 'SCHOOL', 'COLLEGE',
  'HOSPITAL', 'MALL', 'MARKET', 'HIGHWAY', 'OFFICE_HUB', 'RESTAURANT',
  'PARK', 'BANK', 'ATM', 'GYM', 'PLACE_OF_WORSHIP', 'OTHER'
);

create type public.media_type as enum (
  'IMAGE', 'VIDEO', 'YOUTUBE', 'INSTAGRAM_REEL', 'VIRTUAL_TOUR',
  'TOUR_360', 'FLOOR_PLAN', 'BROCHURE'
);

-- ---------------------------------------------------------------------------
-- Listing
-- ---------------------------------------------------------------------------
create type public.listing_type as enum ('SALE', 'RENT', 'LEASE');

create type public.listing_status as enum (
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED',
  'SUSPENDED', 'EXPIRED', 'SOLD', 'RENTED'
);

create type public.share_status as enum (
  'REQUESTED', 'APPROVED', 'REJECTED', 'REVOKED', 'EXPIRED'
);

-- ---------------------------------------------------------------------------
-- Demand, leads and CRM
-- ---------------------------------------------------------------------------
create type public.requirement_status as enum (
  'ACTIVE', 'FULFILLED', 'PAUSED', 'EXPIRED', 'CANCELLED'
);

create type public.lead_stage as enum (
  'NEW', 'CONTACTED', 'QUALIFIED', 'PROPERTY_SHARED', 'VISIT_REQUESTED',
  'VISIT_SCHEDULED', 'VISIT_COMPLETED', 'INTERESTED', 'NEGOTIATION',
  'BOOKING', 'CLOSED_WON', 'CLOSED_LOST', 'FOLLOW_UP'
);

create type public.lead_source as enum (
  'ORGANIC_WEBSITE', 'DIRECT_AGENT_REFERRAL', 'AGENT_INVENTORY_SHARE',
  'ADVERTISEMENT', 'SOCIAL_MEDIA', 'WHATSAPP', 'DIRECT_ENQUIRY',
  'CUSTOMER_SEARCH', 'REQUIREMENT_MATCH', 'CALLBACK_REQUEST', 'OTHER'
);

create type public.crm_task_type as enum (
  'CALL', 'MEETING', 'VISIT', 'FOLLOW_UP', 'DOCUMENT', 'PAYMENT', 'OTHER'
);

create type public.crm_task_status as enum (
  'OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED', 'OVERDUE'
);

-- ---------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------
create type public.visit_type as enum ('PHYSICAL', 'VIRTUAL', 'LIVE_VIDEO');

create type public.visit_status as enum (
  'REQUESTED', 'OFFERED', 'ASSIGNED', 'CONFIRMED', 'IN_PROGRESS',
  'COMPLETED', 'QUALIFIED', 'CANCELLED', 'NO_SHOW', 'EXPIRED', 'REJECTED'
);

create type public.visit_outcome as enum (
  'INTERESTED', 'NEEDS_FOLLOW_UP', 'NOT_INTERESTED', 'PRICE_MISMATCH',
  'LOCATION_MISMATCH', 'PROPERTY_MISMATCH', 'NEGOTIATION_STARTED', 'NOT_RECORDED'
);

create type public.checkin_actor as enum ('CUSTOMER', 'AGENT');

-- ---------------------------------------------------------------------------
-- Deals and commissions
-- ---------------------------------------------------------------------------
create type public.deal_status as enum (
  'INITIATED', 'NEGOTIATION', 'AGREED', 'BOOKED', 'AGREEMENT_SIGNED',
  'REGISTRATION_PENDING', 'CLOSED_WON', 'CLOSED_LOST', 'CANCELLED', 'DISPUTED'
);

create type public.deal_participant_role as enum (
  'LISTING_AGENT', 'SALES_AGENT', 'VISITING_AGENT', 'REFERRAL_AGENT',
  'INVESTOR', 'PLATFORM', 'SELLER', 'BUYER'
);

create type public.commission_pool_mode as enum (
  'PERCENT_OF_TRANSACTION', 'FIXED_AMOUNT'
);

create type public.visit_distribution_model as enum (
  'LATEST_WEIGHTED', 'WEIGHTED_SCORE', 'EQUAL', 'CUSTOM'
);

create type public.commission_status as enum (
  'PENDING', 'CALCULATED', 'APPROVED', 'PAYMENT_PROCESSING',
  'PAID', 'DISPUTED', 'CANCELLED'
);

create type public.ledger_entry_type as enum (
  'EARNING', 'ADJUSTMENT', 'REVERSAL', 'PAYOUT'
);

create type public.payment_status as enum (
  'INITIATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Investor / exclusive inventory  (feature-flagged; see docs/LEGAL_REVIEW.md L1)
-- ---------------------------------------------------------------------------
create type public.exclusive_status as enum (
  'AVAILABLE', 'INVESTOR_INTERESTED', 'UNDER_NEGOTIATION',
  'EXCLUSIVE', 'EXPIRED', 'RELEASED', 'SOLD'
);

create type public.agreement_type as enum (
  'EXCLUSIVE_MARKETING_RIGHTS', 'INVENTORY_RESERVATION',
  'DISTRIBUTION_RIGHTS', 'CONTRACTUAL_RIGHTS'
);

create type public.agreement_status as enum (
  'DRAFT', 'PENDING_LEGAL_REVIEW', 'PENDING_SIGNATURE',
  'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED'
);

-- ---------------------------------------------------------------------------
-- Platform
-- ---------------------------------------------------------------------------
create type public.notification_channel as enum (
  'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'
);

create type public.notification_status as enum (
  'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'SKIPPED'
);

create type public.review_subject as enum ('AGENT', 'VISIT', 'PROPERTY');

create type public.moderation_status as enum (
  'PENDING', 'APPROVED', 'REJECTED', 'FLAGGED'
);

create type public.dispute_category as enum (
  'LEAD_OWNERSHIP', 'PROPERTY_OWNERSHIP', 'VISIT_ATTRIBUTION',
  'COMMISSION', 'DEAL_ATTRIBUTION', 'CONDUCT', 'OTHER'
);

create type public.dispute_status as enum (
  'OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED', 'ESCALATED'
);

create type public.duplicate_status as enum (
  'PENDING', 'CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'MERGED'
);


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000002_identity.sql
-- ===========================================================================

-- ===========================================================================
-- 0002 · Identity: profiles, roles, agents, customers, investors
-- ===========================================================================
-- One Supabase auth user → one profile → zero or more roles.
-- An account can be BOTH an agent and an investor. Agent sub-roles (listing /
-- sales / visiting / referral) are NOT account types: they are derived per deal
-- from participation records.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles — mirrors auth.users with application-level attributes
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  display_name      text,
  email             citext,
  phone             text,
  phone_country     text not null default '+91',
  avatar_url        text,
  locale            text not null default 'en-IN',
  timezone          text not null default 'Asia/Kolkata',
  country           char(2) not null default 'IN',
  city              text,
  status            public.account_status not null default 'ACTIVE',
  email_verified_at timestamptz,
  phone_verified_at timestamptz,
  -- DPDP: explicit, revocable consent per purpose.
  consent_marketing boolean not null default false,
  consent_terms_at  timestamptz,
  consent_privacy_at timestamptz,
  last_seen_at      timestamptz,
  is_demo           boolean not null default false,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_phone_format check (phone is null or phone ~ '^[0-9]{6,14}$')
);
create index profiles_email_idx  on public.profiles (email);
create index profiles_phone_idx  on public.profiles (phone);
create index profiles_status_idx on public.profiles (status);
comment on table public.profiles is 'Application profile for every authenticated user. Contact columns are PII: exposure is controlled by RLS and by the contact-masking service.';

-- ---------------------------------------------------------------------------
-- roles / user_roles
-- ---------------------------------------------------------------------------
create table public.roles (
  key         public.app_role primary key,
  label       text not null,
  description text not null
);

insert into public.roles (key, label, description) values
  ('customer', 'Customer', 'Searches properties, posts requirements, books visits.'),
  ('agent',    'Agent',    'Lists inventory, works leads, conducts visits, earns commission.'),
  ('investor', 'Investor', 'Participates in exclusive inventory arrangements.'),
  ('admin',    'Admin',    'Operates and moderates the platform.');

create table public.user_roles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        public.app_role not null references public.roles(key),
  admin_role  public.admin_role,
  granted_by  uuid references public.profiles(id),
  granted_at  timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (user_id, role),
  -- admin_role is meaningful only for the admin role
  constraint user_roles_admin_role_scope check (
    (role = 'admin') or (admin_role is null)
  )
);
create index user_roles_user_idx on public.user_roles (user_id) where revoked_at is null;
create index user_roles_role_idx on public.user_roles (role)    where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Authorisation helpers used by RLS across the whole schema.
-- SECURITY DEFINER with a pinned search_path so they cannot be shadowed.
-- ---------------------------------------------------------------------------
create or replace function public.has_role(check_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = check_role
      and ur.revoked_at is null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin');
$$;

create or replace function public.has_admin_role(check_admin_role public.admin_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'admin'
      and ur.revoked_at is null
      and (ur.admin_role = check_admin_role or ur.admin_role = 'super_admin')
  );
$$;

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
create table public.agents (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references public.profiles(id) on delete cascade,
  slug                  text not null unique,
  agency_name           text,
  bio                   text,
  headline              text,
  experience_years      integer not null default 0 check (experience_years between 0 and 70),
  languages             text[] not null default array['English','Hindi'],
  specializations       public.property_type[] not null default '{}',
  service_cities        text[] not null default '{}',
  service_localities    text[] not null default '{}',
  -- Visit marketplace configuration (§17 of the brief)
  max_visit_distance_km numeric(5,1) not null default 15 check (max_visit_distance_km > 0),
  accepts_visit_requests boolean not null default true,
  working_hours         jsonb not null default
    '{"mon":["09:00","19:00"],"tue":["09:00","19:00"],"wed":["09:00","19:00"],"thu":["09:00","19:00"],"fri":["09:00","19:00"],"sat":["10:00","18:00"],"sun":[]}'::jsonb,
  base_latitude         numeric(10,7),
  base_longitude        numeric(10,7),
  -- Verification. Badges are granted by admins only; never self-claimed.
  verification_level    public.verification_level not null default 'NONE',
  badges                public.agent_badge[] not null default '{}',
  -- Derived performance metrics, recomputed by the platform (never user-set).
  trust_score           numeric(5,2) not null default 0 check (trust_score between 0 and 100),
  rating_average        numeric(3,2) not null default 0 check (rating_average between 0 and 5),
  rating_count          integer not null default 0,
  response_rate         numeric(5,2) not null default 0 check (response_rate between 0 and 100),
  response_time_minutes integer,
  visit_completion_rate numeric(5,2) not null default 0 check (visit_completion_rate between 0 and 100),
  cancellation_rate     numeric(5,2) not null default 0 check (cancellation_rate between 0 and 100),
  conversion_rate       numeric(5,2) not null default 0 check (conversion_rate between 0 and 100),
  active_lead_count     integer not null default 0,
  closed_deal_count     integer not null default 0,
  complaint_count       integer not null default 0,
  risk_score            numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  status                public.account_status not null default 'PENDING',
  is_demo               boolean not null default false,
  joined_at             timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index agents_slug_idx      on public.agents (slug);
create index agents_cities_idx    on public.agents using gin (service_cities);
create index agents_locality_idx  on public.agents using gin (service_localities);
create index agents_special_idx   on public.agents using gin (specializations);
create index agents_visit_idx     on public.agents (accepts_visit_requests, status) where accepts_visit_requests;
create index agents_trust_idx     on public.agents (trust_score desc);
comment on column public.agents.badges is 'Granted exclusively by admin verification workflows. An agent can never write this column (enforced by RLS).';

-- ---------------------------------------------------------------------------
-- agent verification: submissions, documents, RERA
-- ---------------------------------------------------------------------------
create table public.agent_verifications (
  id                uuid primary key default gen_random_uuid(),
  agent_id          uuid not null references public.agents(id) on delete cascade,
  level             public.verification_level not null,
  status            public.verification_status not null default 'SUBMITTED',
  -- Business verification payload
  legal_name        text,
  business_name     text,
  business_address  text,
  gst_number        text,
  pan_number        text,
  -- Bank details are write-once, read-restricted (finance admins only).
  bank_account_name text,
  bank_account_last4 text,
  bank_ifsc         text,
  submitted_at      timestamptz not null default now(),
  reviewed_by       uuid references public.profiles(id),
  reviewed_at       timestamptz,
  review_notes      text,
  rejection_reason  text,
  expires_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (agent_id, level)
);
create index agent_verifications_status_idx on public.agent_verifications (status, submitted_at);

create table public.agent_documents (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.agents(id) on delete cascade,
  verification_id uuid references public.agent_verifications(id) on delete set null,
  document_type  public.document_type not null,
  storage_bucket text not null default 'agent-documents',
  storage_path   text not null,
  file_name      text not null,
  mime_type      text not null,
  file_size      integer not null check (file_size > 0),
  checksum       text,
  status         public.verification_status not null default 'SUBMITTED',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  review_notes   text,
  -- Phase 3: OCR / tamper signals. Never an assertion of legal authenticity.
  extracted_data jsonb,
  risk_score     numeric(5,2),
  uploaded_at    timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index agent_documents_agent_idx on public.agent_documents (agent_id);
create index agent_documents_status_idx on public.agent_documents (status);

create table public.agent_rera_records (
  id                 uuid primary key default gen_random_uuid(),
  agent_id           uuid not null references public.agents(id) on delete cascade,
  rera_number        text not null,
  state              text not null,
  authority          text,
  registered_name    text,
  valid_from         date,
  valid_until        date,
  status             public.verification_status not null default 'SUBMITTED',
  verified_by        uuid references public.profiles(id),
  verified_at        timestamptz,
  verification_notes text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (agent_id, rera_number, state)
);
create index agent_rera_state_idx on public.agent_rera_records (state, status);

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null unique references public.profiles(id) on delete cascade,
  preferred_cities       text[] not null default '{}',
  preferred_localities   text[] not null default '{}',
  budget_min             public.money_amount,
  budget_max             public.money_amount,
  currency               public.currency_code not null default 'INR',
  purchase_intent        text,
  preferred_contact_time text,
  -- Privacy: the customer decides whether the agent network may see them at all.
  allow_agent_contact    boolean not null default true,
  allow_requirement_discovery boolean not null default true,
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint customers_budget_order check (
    budget_min is null or budget_max is null or budget_max >= budget_min
  )
);
create index customers_cities_idx on public.customers using gin (preferred_cities);

-- ---------------------------------------------------------------------------
-- investors  (module ships disabled; see docs/LEGAL_REVIEW.md L1)
-- ---------------------------------------------------------------------------
create table public.investors (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null unique references public.profiles(id) on delete cascade,
  entity_name          text,
  entity_type          text,
  investment_cities    text[] not null default '{}',
  preferred_property_types public.property_type[] not null default '{}',
  ticket_size_min      public.money_amount,
  ticket_size_max      public.money_amount,
  currency             public.currency_code not null default 'INR',
  target_holding_months integer check (target_holding_months is null or target_holding_months > 0),
  target_return_percent public.percentage,
  risk_appetite        text,
  verification_status  public.verification_status not null default 'NOT_SUBMITTED',
  verification_level   public.verification_level not null default 'NONE',
  is_accredited        boolean not null default false,
  status               public.account_status not null default 'PENDING',
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint investors_ticket_order check (
    ticket_size_min is null or ticket_size_max is null or ticket_size_max >= ticket_size_min
  )
);

create table public.investor_verifications (
  id               uuid primary key default gen_random_uuid(),
  investor_id      uuid not null references public.investors(id) on delete cascade,
  level            public.verification_level not null,
  status           public.verification_status not null default 'SUBMITTED',
  pan_number       text,
  entity_registration_number text,
  submitted_at     timestamptz not null default now(),
  reviewed_by      uuid references public.profiles(id),
  reviewed_at      timestamptz,
  review_notes     text,
  rejection_reason text,
  created_at       timestamptz not null default now(),
  unique (investor_id, level)
);

-- ---------------------------------------------------------------------------
-- Role-scoped identity helpers.
-- Declared here, after agents/customers/investors exist, because SQL-language
-- function bodies are parsed and validated at creation time.
-- ---------------------------------------------------------------------------
create or replace function public.current_agent_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id from public.agents a where a.user_id = auth.uid();
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select c.id from public.customers c where c.user_id = auth.uid();
$$;

create or replace function public.current_investor_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select i.id from public.investors i where i.user_id = auth.uid();
$$;



-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000003_property_passport.sql
-- ===========================================================================

-- ===========================================================================
-- 0003 · Property Passport
-- ===========================================================================
-- THE core differentiator. One physical property → one permanent row → one
-- permanent reference code (PROP-NCR-0001827). Many agents, many listings over
-- many years, all pointing at the same passport. Listing history, price history,
-- visit history and verification history accumulate against the passport and
-- survive the deletion of any individual listing.
-- ===========================================================================

-- Region codes used in passport reference numbers (NCR, MUM, BLR, ...).
create table public.regions (
  code       text primary key,
  name       text not null,
  country    char(2) not null default 'IN',
  state      text,
  cities     text[] not null default '{}',
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.regions (code, name, state, cities) values
  ('NCR', 'National Capital Region', 'Delhi NCR',
     array['Delhi','Noida','Greater Noida','Ghaziabad','Gurgaon','Faridabad']),
  ('MUM', 'Mumbai Metropolitan Region', 'Maharashtra',
     array['Mumbai','Navi Mumbai','Thane']),
  ('BLR', 'Bengaluru', 'Karnataka', array['Bengaluru']),
  ('LKO', 'Lucknow', 'Uttar Pradesh', array['Lucknow']),
  ('PNQ', 'Pune', 'Maharashtra', array['Pune']),
  ('HYD', 'Hyderabad', 'Telangana', array['Hyderabad']),
  ('CHN', 'Chennai', 'Tamil Nadu', array['Chennai']);

-- Monotonic per-region counter backing the passport reference code.
create table public.reference_counters (
  scope      text primary key,
  next_value bigint not null default 1
);

-- ---------------------------------------------------------------------------
-- projects — optional grouping (a society/township). Many passports per project.
-- ---------------------------------------------------------------------------
create table public.projects (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  name             text not null,
  developer_name   text,
  region_code      text references public.regions(code),
  city             text not null,
  locality         text not null,
  state            text not null,
  pincode          text,
  latitude         numeric(10,7),
  longitude        numeric(10,7),
  rera_number      text,
  rera_state       text,
  total_towers     integer,
  total_units      integer,
  possession_date  date,
  amenities        text[] not null default '{}',
  description      text,
  cover_image_url  text,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index projects_city_idx     on public.projects (city, locality);
create index projects_name_trgm    on public.projects using gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- property_passports — the permanent identity of a physical property
-- ---------------------------------------------------------------------------
create table public.property_passports (
  id                    uuid primary key default gen_random_uuid(),
  -- Permanent, human-readable, never reused. e.g. PROP-NCR-0001827
  reference_code        text not null unique,
  region_code           text not null references public.regions(code),

  property_type         public.property_type not null,
  category              public.property_category not null,

  project_id            uuid references public.projects(id) on delete set null,
  building              text,
  tower                 text,
  unit_number           text,
  floor                 integer,
  total_floors          integer,

  -- Areas in sq ft. Carpet ≤ built-up ≤ super built-up is enforced below.
  carpet_area           numeric(12,2) check (carpet_area is null or carpet_area > 0),
  built_up_area         numeric(12,2) check (built_up_area is null or built_up_area > 0),
  super_built_up_area   numeric(12,2) check (super_built_up_area is null or super_built_up_area > 0),
  plot_area             numeric(12,2) check (plot_area is null or plot_area > 0),
  area_unit             text not null default 'SQFT',
  dimensions            text,

  bedrooms              smallint check (bedrooms is null or bedrooms between 0 and 30),
  bathrooms             smallint check (bathrooms is null or bathrooms between 0 and 30),
  balconies             smallint check (balconies is null or balconies between 0 and 30),
  facing                public.facing_direction,
  age_years             smallint check (age_years is null or age_years between 0 and 200),

  ownership_type        public.ownership_type not null default 'UNKNOWN',
  -- Ownership identity is deliberately minimal and access-controlled.
  owner_name            text,
  owner_contact_masked  text,

  rera_number           text,
  rera_state            text,

  status                public.property_status not null default 'DRAFT',
  verification_status   public.verification_status not null default 'NOT_SUBMITTED',
  verification_score    numeric(5,2) not null default 0 check (verification_score between 0 and 100),
  last_verified_at      timestamptz,
  next_verification_at  timestamptz,

  -- Denormalised counters, maintained by triggers. Cheap reads for hot lists.
  listing_count         integer not null default 0,
  active_listing_count  integer not null default 0,
  view_count            integer not null default 0,
  enquiry_count         integer not null default 0,
  visit_count           integer not null default 0,
  favourite_count       integer not null default 0,

  -- Duplicate detection support
  fingerprint           text,
  duplicate_of          uuid references public.property_passports(id) on delete set null,

  risk_score            numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  created_by            uuid references public.profiles(id),
  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint passports_area_order check (
    carpet_area is null or built_up_area is null or carpet_area <= built_up_area
  ),
  constraint passports_floor_order check (
    floor is null or total_floors is null or floor <= total_floors
  ),
  constraint passports_not_self_duplicate check (duplicate_of is null or duplicate_of <> id)
);
create index passports_status_idx      on public.property_passports (status);
create index passports_type_idx        on public.property_passports (property_type, category);
create index passports_project_idx     on public.property_passports (project_id);
create index passports_fingerprint_idx on public.property_passports (fingerprint);
create index passports_verification_idx on public.property_passports (verification_status)
  where verification_status in ('SUBMITTED','UNDER_REVIEW');
comment on table public.property_passports is
  'One row per physical property, forever. Listings reference this; deleting a listing never deletes the passport or its accumulated history.';

-- Uniqueness of a physical unit within a project. Partial: only when we know
-- enough to assert identity.
create unique index passports_unit_identity_idx
  on public.property_passports (project_id, coalesce(tower,''), unit_number)
  where project_id is not null and unit_number is not null;

-- ---------------------------------------------------------------------------
-- property_addresses — 1:1, split out because it is queried and indexed apart
-- ---------------------------------------------------------------------------
create table public.property_addresses (
  property_id     uuid primary key references public.property_passports(id) on delete cascade,
  address_line1   text,
  address_line2   text,
  landmark        text,
  locality        text not null,
  sub_locality    text,
  city            text not null,
  district        text,
  state           text not null,
  pincode         text,
  country         char(2) not null default 'IN',
  latitude        numeric(10,7),
  longitude       numeric(10,7),
  google_place_id text,
  map_url         text,
  -- Full address is PII-adjacent: exposure is decided by the listing's policy.
  is_exact_location_public boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint addresses_lat_range check (latitude  is null or latitude  between -90 and 90),
  constraint addresses_lng_range check (longitude is null or longitude between -180 and 180)
);
create index addresses_city_idx     on public.property_addresses (city, locality);
create index addresses_pincode_idx  on public.property_addresses (pincode);
create index addresses_geo_idx      on public.property_addresses (latitude, longitude);
create index addresses_locality_trgm on public.property_addresses using gin (locality gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- media, documents, amenities, nearby places
-- ---------------------------------------------------------------------------
create table public.property_media (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.property_passports(id) on delete cascade,
  media_type     public.media_type not null,
  storage_bucket text,
  storage_path   text,
  external_url   text,
  caption        text,
  alt_text       text,
  width          integer,
  height         integer,
  file_size      integer,
  mime_type      text,
  -- Perceptual hash for duplicate-image detection (Phase 2/3).
  image_hash     text,
  sort_order     integer not null default 0,
  is_primary     boolean not null default false,
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  -- Media is either stored by us or referenced externally, never neither.
  constraint property_media_location check (
    (storage_path is not null) or (external_url is not null)
  )
);
create index property_media_property_idx on public.property_media (property_id, sort_order);
create index property_media_hash_idx     on public.property_media (image_hash) where image_hash is not null;
create unique index property_media_one_primary_idx
  on public.property_media (property_id) where is_primary;

create table public.property_documents (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references public.property_passports(id) on delete cascade,
  document_type  public.document_type not null,
  storage_bucket text not null default 'property-documents',
  storage_path   text not null,
  file_name      text not null,
  mime_type      text not null,
  file_size      integer not null check (file_size > 0),
  checksum       text,
  -- Visibility ladder: private → agents with granted access → admin-only.
  -- Nothing in this table is ever publicly readable.
  visibility     text not null default 'PRIVATE'
                   check (visibility in ('PRIVATE','AGENTS_WITH_ACCESS','ADMIN_ONLY')),
  status         public.verification_status not null default 'SUBMITTED',
  reviewed_by    uuid references public.profiles(id),
  reviewed_at    timestamptz,
  review_notes   text,
  extracted_data jsonb,
  risk_score     numeric(5,2),
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now()
);
create index property_documents_property_idx on public.property_documents (property_id);
comment on column public.property_documents.status is
  'Reflects platform review only. It is NEVER an assertion of the legal authenticity of title. See docs/LEGAL_REVIEW.md L8.';

create table public.amenities (
  key        text primary key,
  label      text not null,
  category   text not null,
  icon       text,
  sort_order integer not null default 0
);

create table public.property_amenities (
  property_id  uuid not null references public.property_passports(id) on delete cascade,
  amenity_key  text not null references public.amenities(key) on delete cascade,
  notes        text,
  primary key (property_id, amenity_key)
);

create table public.property_nearby_places (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.property_passports(id) on delete cascade,
  place_type    public.nearby_place_type not null,
  name          text not null,
  distance_km   numeric(6,2) not null check (distance_km >= 0),
  travel_minutes integer check (travel_minutes is null or travel_minutes >= 0),
  google_place_id text,
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index nearby_property_idx on public.property_nearby_places (property_id, place_type);

-- ---------------------------------------------------------------------------
-- verification and price history — append-only trails on the passport
-- ---------------------------------------------------------------------------
create table public.property_verifications (
  id                 uuid primary key default gen_random_uuid(),
  property_id        uuid not null references public.property_passports(id) on delete cascade,
  status             public.verification_status not null,
  score              numeric(5,2) check (score is null or score between 0 and 100),
  checklist          jsonb not null default '{}'::jsonb,
  notes              text,
  rejection_reason   text,
  reviewed_by        uuid references public.profiles(id),
  reviewed_at        timestamptz not null default now(),
  next_verification_at timestamptz,
  created_at         timestamptz not null default now()
);
create index property_verifications_property_idx on public.property_verifications (property_id, reviewed_at desc);

create table public.property_price_history (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.property_passports(id) on delete cascade,
  listing_id   uuid,
  listing_type public.listing_type not null,
  price        public.money_amount not null,
  currency     public.currency_code not null default 'INR',
  price_per_sqft numeric(12,2),
  recorded_at  timestamptz not null default now(),
  source       text not null default 'LISTING'
);
create index price_history_property_idx on public.property_price_history (property_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- duplicate detection queue — surfaced to admins, never auto-merged
-- ---------------------------------------------------------------------------
create table public.property_duplicate_candidates (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.property_passports(id) on delete cascade,
  candidate_id    uuid not null references public.property_passports(id) on delete cascade,
  confidence      numeric(5,2) not null check (confidence between 0 and 100),
  signals         jsonb not null default '{}'::jsonb,
  status          public.duplicate_status not null default 'PENDING',
  reviewed_by     uuid references public.profiles(id),
  reviewed_at     timestamptz,
  resolution_notes text,
  created_at      timestamptz not null default now(),
  constraint duplicate_distinct check (property_id <> candidate_id),
  unique (property_id, candidate_id)
);
create index duplicate_status_idx on public.property_duplicate_candidates (status, confidence desc);
comment on table public.property_duplicate_candidates is
  'Candidates are queued for human adjudication. The platform never auto-merges passports.';


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000004_listings.sql
-- ===========================================================================

-- ===========================================================================
-- 0004 · Listings, moderation, agent-to-agent sharing, favourites
-- ===========================================================================
-- A listing is ONE AGENT'S OFFER against a property passport. Several agents
-- may hold concurrent listings for the same passport; that is a feature, not a
-- duplicate. Every listing is moderated before it becomes publicly visible.
-- ===========================================================================

create table public.listings (
  id                    uuid primary key default gen_random_uuid(),
  reference_code        text not null unique,          -- LIST-NCR-000123
  property_id           uuid not null references public.property_passports(id) on delete cascade,
  agent_id              uuid not null references public.agents(id) on delete cascade,

  title                 text not null check (char_length(title) between 10 and 160),
  slug                  text not null,
  description           text,
  highlights            text[] not null default '{}',
  seo_description       text,

  listing_type          public.listing_type not null,
  status                public.listing_status not null default 'DRAFT',

  -- Money. NUMERIC only; arithmetic happens in the application in paise.
  price                 public.money_amount not null,
  currency              public.currency_code not null default 'INR',
  is_negotiable         boolean not null default true,
  price_per_sqft        numeric(12,2),
  maintenance_charge    public.money_amount,
  maintenance_period    text check (maintenance_period is null or
                          maintenance_period in ('MONTHLY','QUARTERLY','YEARLY','ONE_TIME')),
  security_deposit      public.money_amount,
  booking_amount        public.money_amount,
  brokerage_type        text not null default 'PERCENT'
                          check (brokerage_type in ('PERCENT','FIXED','NONE')),
  brokerage_value       numeric(12,2) not null default 0 check (brokerage_value >= 0),
  brokerage_notes       text,

  -- Denormalised from the passport at listing time so search stays single-table
  -- fast, and so a listing keeps the attributes it was published with.
  property_type         public.property_type not null,
  category              public.property_category not null,
  bedrooms              smallint,
  bathrooms             smallint,
  balconies             smallint,
  built_up_area         numeric(12,2),
  carpet_area           numeric(12,2),
  plot_area             numeric(12,2),
  floor                 integer,
  total_floors          integer,
  facing                public.facing_direction,
  furnishing            public.furnishing_status not null default 'UNFURNISHED',
  age_years             smallint,
  possession_status     public.possession_status not null default 'READY_TO_MOVE',
  available_from        date,

  covered_parking       smallint not null default 0 check (covered_parking >= 0),
  open_parking          smallint not null default 0 check (open_parking >= 0),
  power_backup          text check (power_backup is null or
                          power_backup in ('NONE','PARTIAL','FULL')),
  water_supply          text,

  city                  text not null,
  locality              text not null,
  state                 text not null,
  pincode               text,
  latitude              numeric(10,7),
  longitude             numeric(10,7),

  -- Media convenience pointers (canonical media lives in listing_media)
  cover_image_url       text,
  video_url             text,
  youtube_url           text,
  instagram_reel_url    text,
  virtual_tour_url      text,
  tour_360_url          text,
  floor_plan_url        text,
  brochure_url          text,

  -- Sharing / exclusivity
  is_shareable          boolean not null default true,
  is_exclusive          boolean not null default false,
  exclusive_until       timestamptz,

  -- Moderation trail (§9 of the brief)
  submitted_at          timestamptz,
  reviewed_by           uuid references public.profiles(id),
  reviewed_at           timestamptz,
  verification_notes    text,
  rejection_reason      text,
  verification_score    numeric(5,2) not null default 0 check (verification_score between 0 and 100),
  next_verification_at  timestamptz,
  published_at          timestamptz,
  expires_at            timestamptz,

  view_count            integer not null default 0,
  enquiry_count         integer not null default 0,
  favourite_count       integer not null default 0,
  share_count           integer not null default 0,

  is_demo               boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint listings_price_positive check (price > 0),
  -- Rent-only fields must not appear on a sale listing.
  constraint listings_deposit_scope check (
    security_deposit is null or listing_type in ('RENT','LEASE')
  ),
  constraint listings_exclusive_window check (
    not is_exclusive or exclusive_until is not null
  )
);

create unique index listings_slug_idx on public.listings (slug);
create index listings_property_idx    on public.listings (property_id);
create index listings_agent_idx       on public.listings (agent_id, status);
create index listings_status_idx      on public.listings (status);
-- The hot path: public search over verified listings.
create index listings_search_idx on public.listings
  (city, locality, listing_type, property_type, price)
  where status = 'VERIFIED';
create index listings_price_idx  on public.listings (price)     where status = 'VERIFIED';
create index listings_bedrooms_idx on public.listings (bedrooms) where status = 'VERIFIED';
create index listings_published_idx on public.listings (published_at desc) where status = 'VERIFIED';
create index listings_geo_idx    on public.listings (latitude, longitude) where status = 'VERIFIED';
create index listings_moderation_idx on public.listings (submitted_at)
  where status in ('SUBMITTED','UNDER_REVIEW');
create index listings_title_trgm on public.listings using gin (title gin_trgm_ops);
create index listings_exclusive_idx on public.listings (is_exclusive) where is_exclusive;

comment on table public.listings is
  'An agent offer against a property passport. Public visibility requires status = VERIFIED (enforced in RLS, not in the UI).';

-- ---------------------------------------------------------------------------
-- listing media
-- ---------------------------------------------------------------------------
create table public.listing_media (
  id             uuid primary key default gen_random_uuid(),
  listing_id     uuid not null references public.listings(id) on delete cascade,
  property_media_id uuid references public.property_media(id) on delete set null,
  media_type     public.media_type not null,
  storage_bucket text,
  storage_path   text,
  external_url   text,
  caption        text,
  alt_text       text,
  sort_order     integer not null default 0,
  is_primary     boolean not null default false,
  created_at     timestamptz not null default now(),
  constraint listing_media_location check (
    (storage_path is not null) or (external_url is not null) or (property_media_id is not null)
  )
);
create index listing_media_listing_idx on public.listing_media (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- listing_status_history — append-only moderation/lifecycle trail
-- ---------------------------------------------------------------------------
create table public.listing_status_history (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references public.listings(id) on delete cascade,
  from_status   public.listing_status,
  to_status     public.listing_status not null,
  changed_by    uuid references public.profiles(id),
  reason        text,
  notes         text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index listing_history_idx on public.listing_status_history (listing_id, created_at desc);

-- ---------------------------------------------------------------------------
-- listing_shares — agent-to-agent inventory sharing (§14)
-- ---------------------------------------------------------------------------
-- Agent B discovers Agent A's inventory and requests access. Agent A approves.
-- Only then may Agent B share it with a customer or register a lead against it.
-- ---------------------------------------------------------------------------
create table public.listing_shares (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references public.listings(id) on delete cascade,
  owner_agent_id     uuid not null references public.agents(id) on delete cascade,
  requester_agent_id uuid not null references public.agents(id) on delete cascade,
  status             public.share_status not null default 'REQUESTED',
  request_message    text,
  response_message   text,
  -- Commission share promised to the requesting agent, if agreed up front.
  agreed_share_percent public.percentage,
  requested_at       timestamptz not null default now(),
  responded_at       timestamptz,
  revoked_at         timestamptz,
  expires_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint shares_distinct_agents check (owner_agent_id <> requester_agent_id),
  unique (listing_id, requester_agent_id)
);
create index shares_owner_idx     on public.listing_shares (owner_agent_id, status);
create index shares_requester_idx on public.listing_shares (requester_agent_id, status);

-- Convenience predicate reused by RLS on leads, visits and documents.
create or replace function public.agent_has_listing_access(target_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.listings l
    where l.id = target_listing_id
      and l.agent_id = public.current_agent_id()
  ) or exists (
    select 1 from public.listing_shares s
    where s.listing_id = target_listing_id
      and s.requester_agent_id = public.current_agent_id()
      and s.status = 'APPROVED'
      and (s.expires_at is null or s.expires_at > now())
      and s.revoked_at is null
  );
$$;

-- ---------------------------------------------------------------------------
-- listing_referrals — records that agent B introduced a customer to a listing
-- ---------------------------------------------------------------------------
create table public.listing_referrals (
  id                 uuid primary key default gen_random_uuid(),
  listing_id         uuid not null references public.listings(id) on delete cascade,
  share_id           uuid references public.listing_shares(id) on delete set null,
  referring_agent_id uuid not null references public.agents(id) on delete cascade,
  receiving_agent_id uuid references public.agents(id) on delete set null,
  customer_id        uuid references public.customers(id) on delete set null,
  lead_id            uuid,
  source             public.lead_source not null default 'AGENT_INVENTORY_SHARE',
  notes              text,
  created_at         timestamptz not null default now()
);
create index referrals_listing_idx  on public.listing_referrals (listing_id);
create index referrals_agent_idx    on public.listing_referrals (referring_agent_id);
create index referrals_customer_idx on public.listing_referrals (customer_id);

-- ---------------------------------------------------------------------------
-- favourites and saved searches
-- ---------------------------------------------------------------------------
create table public.favorites (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  listing_id  uuid not null references public.listings(id) on delete cascade,
  property_id uuid not null references public.property_passports(id) on delete cascade,
  notes       text,
  created_at  timestamptz not null default now(),
  unique (customer_id, listing_id)
);
create index favorites_customer_idx on public.favorites (customer_id, created_at desc);

create table public.saved_searches (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers(id) on delete cascade,
  name          text not null,
  filters       jsonb not null,
  alert_enabled boolean not null default false,
  alert_frequency text not null default 'DAILY'
                  check (alert_frequency in ('INSTANT','DAILY','WEEKLY')),
  last_alerted_at timestamptz,
  created_at    timestamptz not null default now()
);
create index saved_searches_customer_idx on public.saved_searches (customer_id);


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000005_demand_and_crm.sql
-- ===========================================================================

-- ===========================================================================
-- 0005 · Demand marketplace, leads, attribution and CRM
-- ===========================================================================
-- The demand side is a first-class citizen: customers publish requirements and
-- agents discover them (subject to the customer's privacy setting). Leads carry
-- a full, append-only attribution trail so commission can be defended later.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- customer_requirements (§11)
-- ---------------------------------------------------------------------------
create table public.customer_requirements (
  id                 uuid primary key default gen_random_uuid(),
  reference_code     text not null unique,             -- REQ-NCR-000123
  customer_id        uuid not null references public.customers(id) on delete cascade,
  title              text,
  property_type      public.property_type[] not null default '{}',
  category           public.property_category not null default 'RESIDENTIAL',
  listing_type       public.listing_type not null,
  city               text not null,
  localities         text[] not null default '{}',
  state              text,
  budget_min         public.money_amount,
  budget_max         public.money_amount not null,
  currency           public.currency_code not null default 'INR',
  min_area           numeric(12,2),
  max_area           numeric(12,2),
  bedrooms_min       smallint,
  bedrooms_max       smallint,
  bathrooms_min      smallint,
  facing             public.facing_direction[] not null default '{}',
  furnishing         public.furnishing_status[] not null default '{}',
  possession         public.possession_status[] not null default '{}',
  required_by        date,
  amenities          text[] not null default '{}',
  preferences        text,
  -- Privacy: even when discovery is on, contact details are never included.
  is_discoverable    boolean not null default true,
  status             public.requirement_status not null default 'ACTIVE',
  match_count        integer not null default 0,
  expires_at         timestamptz,
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint requirements_budget_order check (
    budget_min is null or budget_max >= budget_min
  ),
  constraint requirements_area_order check (
    min_area is null or max_area is null or max_area >= min_area
  ),
  constraint requirements_bedroom_order check (
    bedrooms_min is null or bedrooms_max is null or bedrooms_max >= bedrooms_min
  )
);
create index requirements_customer_idx on public.customer_requirements (customer_id, status);
create index requirements_discovery_idx on public.customer_requirements (city, listing_type, budget_max)
  where status = 'ACTIVE' and is_discoverable;
create index requirements_localities_idx on public.customer_requirements using gin (localities);

-- Cached match scores between requirements and listings (§12).
create table public.requirement_matches (
  id             uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete cascade,
  listing_id     uuid not null references public.listings(id) on delete cascade,
  score          numeric(5,2) not null check (score between 0 and 100),
  breakdown      jsonb not null default '{}'::jsonb,
  algorithm_version text not null default 'rules-v1',
  is_dismissed   boolean not null default false,
  computed_at    timestamptz not null default now(),
  unique (requirement_id, listing_id)
);
create index requirement_matches_idx on public.requirement_matches (requirement_id, score desc);

-- ---------------------------------------------------------------------------
-- leads (§15) — a customer↔property relationship owned by an agent
-- ---------------------------------------------------------------------------
create table public.leads (
  id                  uuid primary key default gen_random_uuid(),
  reference_code      text not null unique,            -- LEAD-NCR-000123
  customer_id         uuid not null references public.customers(id) on delete cascade,
  property_id         uuid references public.property_passports(id) on delete set null,
  listing_id          uuid references public.listings(id) on delete set null,
  requirement_id      uuid references public.customer_requirements(id) on delete set null,

  -- Attribution triangle. Distinct roles, possibly the same agent.
  listing_agent_id    uuid references public.agents(id) on delete set null,
  sales_agent_id      uuid references public.agents(id) on delete set null,
  referral_agent_id   uuid references public.agents(id) on delete set null,

  source              public.lead_source not null default 'ORGANIC_WEBSITE',
  source_detail       text,
  stage               public.lead_stage not null default 'NEW',
  priority            text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH')),
  message             text,
  budget              public.money_amount,
  currency            public.currency_code not null default 'INR',

  -- Contact access gate. Until an agent accepts the lead, contact stays masked.
  is_contact_unlocked boolean not null default false,
  contact_unlocked_at timestamptz,
  contact_unlocked_by uuid references public.profiles(id),

  accepted_at         timestamptz,
  first_response_at   timestamptz,
  last_activity_at    timestamptz not null default now(),
  next_follow_up_at   timestamptz,
  closed_at           timestamptz,
  lost_reason         text,
  score               numeric(5,2) not null default 0 check (score between 0 and 100),
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index leads_customer_idx  on public.leads (customer_id, created_at desc);
create index leads_sales_agent_idx on public.leads (sales_agent_id, stage);
create index leads_listing_agent_idx on public.leads (listing_agent_id, stage);
create index leads_listing_idx   on public.leads (listing_id);
create index leads_stage_idx     on public.leads (stage, last_activity_at desc);
create index leads_followup_idx  on public.leads (next_follow_up_at)
  where stage not in ('CLOSED_WON','CLOSED_LOST');
-- One open lead per customer/listing/sales-agent triple; closed ones may repeat.
create unique index leads_open_unique_idx
  on public.leads (customer_id, listing_id, sales_agent_id)
  where stage not in ('CLOSED_WON','CLOSED_LOST') and listing_id is not null;

-- ---------------------------------------------------------------------------
-- lead_events — APPEND ONLY. The attribution record of record.
-- ---------------------------------------------------------------------------
create table public.lead_events (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  event_type  text not null,
  from_stage  public.lead_stage,
  to_stage    public.lead_stage,
  actor_id    uuid references public.profiles(id),
  actor_role  text,
  agent_id    uuid references public.agents(id) on delete set null,
  source      public.lead_source,
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index lead_events_lead_idx on public.lead_events (lead_id, created_at desc);
comment on table public.lead_events is 'Append-only. Never updated or deleted; current lead state is a projection of this log.';

-- ---------------------------------------------------------------------------
-- contact_access_logs — who saw a customer''s real phone/email, and when (§47)
-- ---------------------------------------------------------------------------
create table public.contact_access_logs (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete set null,
  accessed_by uuid not null references public.profiles(id) on delete cascade,
  agent_id    uuid references public.agents(id) on delete set null,
  field       text not null check (field in ('PHONE','EMAIL','BOTH')),
  reason      text,
  ip_address  inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index contact_access_customer_idx on public.contact_access_logs (customer_id, created_at desc);
create index contact_access_actor_idx    on public.contact_access_logs (accessed_by, created_at desc);

-- ---------------------------------------------------------------------------
-- CRM (§27)
-- ---------------------------------------------------------------------------
create table public.crm_contacts (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.agents(id) on delete cascade,
  customer_id    uuid references public.customers(id) on delete set null,
  -- Off-platform contacts an agent tracks privately.
  full_name      text not null,
  phone          text,
  email          citext,
  city           text,
  locality       text,
  tags           text[] not null default '{}',
  requirement_summary text,
  budget_min     public.money_amount,
  budget_max     public.money_amount,
  preferred_property_types public.property_type[] not null default '{}',
  notes          text,
  last_contacted_at timestamptz,
  is_demo        boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index crm_contacts_agent_idx on public.crm_contacts (agent_id, updated_at desc);

create table public.crm_tasks (
  id            uuid primary key default gen_random_uuid(),
  agent_id      uuid not null references public.agents(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete cascade,
  contact_id    uuid references public.crm_contacts(id) on delete cascade,
  visit_id      uuid,
  task_type     public.crm_task_type not null default 'FOLLOW_UP',
  title         text not null,
  description   text,
  due_at        timestamptz not null,
  remind_at     timestamptz,
  status        public.crm_task_status not null default 'OPEN',
  completed_at  timestamptz,
  outcome       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index crm_tasks_agent_idx on public.crm_tasks (agent_id, status, due_at);
create index crm_tasks_lead_idx  on public.crm_tasks (lead_id);

create table public.crm_notes (
  id          uuid primary key default gen_random_uuid(),
  agent_id    uuid not null references public.agents(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  contact_id  uuid references public.crm_contacts(id) on delete cascade,
  visit_id    uuid,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index crm_notes_agent_idx on public.crm_notes (agent_id, created_at desc);
create index crm_notes_lead_idx  on public.crm_notes (lead_id, created_at desc);


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000006_visits.sql
-- ===========================================================================

-- ===========================================================================
-- 0006 · Visit marketplace, qualification and attribution
-- ===========================================================================
-- A visit is the unit of contributed effort that earns money. Because it earns
-- money, a visit only becomes QUALIFIED when multiple independent signals agree:
-- agent check-in, customer confirmation (OTP or in-app), minimum dwell time and
-- — for physical visits — a GPS fix inside the property geofence.
-- ===========================================================================

create table public.visits (
  id                  uuid primary key default gen_random_uuid(),
  reference_code      text not null unique,            -- VISIT-NCR-000123
  customer_id         uuid not null references public.customers(id) on delete cascade,
  property_id         uuid not null references public.property_passports(id) on delete cascade,
  listing_id          uuid references public.listings(id) on delete set null,
  lead_id             uuid references public.leads(id) on delete set null,

  visit_type          public.visit_type not null default 'PHYSICAL',
  status              public.visit_status not null default 'REQUESTED',

  requested_date      date not null,
  requested_time      time not null,
  requested_window_minutes integer not null default 60 check (requested_window_minutes > 0),
  scheduled_at        timestamptz,

  -- Agents. The preferred agent may decline; the assigned agent is whoever
  -- actually took the job from the visit marketplace.
  preferred_agent_id  uuid references public.agents(id) on delete set null,
  assigned_agent_id   uuid references public.agents(id) on delete set null,
  listing_agent_id    uuid references public.agents(id) on delete set null,
  assigned_at         timestamptz,

  -- Qualification signals
  started_at          timestamptz,
  ended_at            timestamptz,
  duration_minutes    integer generated always as (
    case when started_at is not null and ended_at is not null
      then greatest(0, (extract(epoch from (ended_at - started_at)) / 60)::integer)
      else null end
  ) stored,
  agent_confirmed_at    timestamptz,
  customer_confirmed_at timestamptz,
  otp_code_hash       text,
  otp_expires_at      timestamptz,
  otp_verified_at     timestamptz,
  geofence_passed     boolean,
  geofence_distance_m numeric(10,2),

  is_qualified        boolean not null default false,
  qualified_at        timestamptz,
  qualification_reasons jsonb not null default '{}'::jsonb,
  disqualification_reason text,

  outcome             public.visit_outcome not null default 'NOT_RECORDED',
  interest_level      smallint check (interest_level is null or interest_level between 1 and 5),
  agent_notes         text,
  customer_notes      text,
  cancellation_reason text,
  cancelled_by        uuid references public.profiles(id),
  cancelled_at        timestamptz,

  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint visits_time_order check (ended_at is null or started_at is null or ended_at >= started_at),
  constraint visits_qualified_needs_time check (not is_qualified or qualified_at is not null)
);
create index visits_customer_idx  on public.visits (customer_id, requested_date desc);
create index visits_property_idx  on public.visits (property_id, created_at desc);
create index visits_agent_idx     on public.visits (assigned_agent_id, status);
create index visits_status_idx    on public.visits (status, requested_date);
create index visits_lead_idx      on public.visits (lead_id);
-- Attribution query: qualifying visits for a property/customer pair, newest first.
create index visits_attribution_idx on public.visits (property_id, customer_id, ended_at desc)
  where is_qualified;

comment on column public.visits.otp_code_hash is
  'Only a hash of the OTP is stored. The plaintext is transmitted to the customer and never persisted.';

-- ---------------------------------------------------------------------------
-- visit_assignments — the visit marketplace offer log (§17)
-- ---------------------------------------------------------------------------
-- When the preferred agent is unavailable, nearby available agents are offered
-- the visit. Every offer and response is recorded, so "who was asked" is never
-- in doubt during a dispute.
-- ---------------------------------------------------------------------------
create table public.visit_assignments (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits(id) on delete cascade,
  agent_id      uuid not null references public.agents(id) on delete cascade,
  status        text not null default 'OFFERED'
                  check (status in ('OFFERED','ACCEPTED','DECLINED','EXPIRED','WITHDRAWN')),
  offer_rank    integer not null default 1,
  distance_km   numeric(6,2),
  match_score   numeric(5,2),
  offered_at    timestamptz not null default now(),
  responded_at  timestamptz,
  expires_at    timestamptz,
  decline_reason text,
  created_at    timestamptz not null default now(),
  unique (visit_id, agent_id)
);
create index visit_assignments_agent_idx on public.visit_assignments (agent_id, status, offered_at desc);
create index visit_assignments_visit_idx on public.visit_assignments (visit_id, offer_rank);

-- ---------------------------------------------------------------------------
-- visit_checkins — APPEND ONLY evidence trail
-- ---------------------------------------------------------------------------
create table public.visit_checkins (
  id            uuid primary key default gen_random_uuid(),
  visit_id      uuid not null references public.visits(id) on delete cascade,
  actor         public.checkin_actor not null,
  actor_id      uuid references public.profiles(id),
  action        text not null check (action in ('CHECK_IN','CHECK_OUT')),
  latitude      numeric(10,7),
  longitude     numeric(10,7),
  accuracy_m    numeric(8,2),
  distance_from_property_m numeric(10,2),
  within_geofence boolean,
  device_info   jsonb not null default '{}'::jsonb,
  ip_address    inet,
  created_at    timestamptz not null default now()
);
create index visit_checkins_visit_idx on public.visit_checkins (visit_id, created_at);
comment on table public.visit_checkins is
  'Append-only evidence for visit qualification and, ultimately, for commission disputes.';

-- ---------------------------------------------------------------------------
-- visit_feedback — customer rating of the visit and the agent
-- ---------------------------------------------------------------------------
create table public.visit_feedback (
  id                 uuid primary key default gen_random_uuid(),
  visit_id           uuid not null unique references public.visits(id) on delete cascade,
  customer_id        uuid not null references public.customers(id) on delete cascade,
  agent_id           uuid references public.agents(id) on delete set null,
  did_visit_happen   boolean not null,
  rating             smallint check (rating is null or rating between 1 and 5),
  agent_rating       smallint check (agent_rating is null or agent_rating between 1 and 5),
  property_matched_listing boolean,
  interest_level     smallint check (interest_level is null or interest_level between 1 and 5),
  comments           text,
  moderation_status  public.moderation_status not null default 'PENDING',
  created_at         timestamptz not null default now()
);
create index visit_feedback_agent_idx on public.visit_feedback (agent_id);

-- ---------------------------------------------------------------------------
-- visit_attributions — the frozen contribution record used by the commission
-- engine. Computed once, at deal close, from qualified visits.
-- ---------------------------------------------------------------------------
create table public.visit_attributions (
  id                  uuid primary key default gen_random_uuid(),
  deal_id             uuid,
  visit_id            uuid not null references public.visits(id) on delete cascade,
  agent_id            uuid not null references public.agents(id) on delete cascade,
  tier                text not null check (tier in ('LATEST','PREVIOUS','EARLIER')),
  visit_rank          integer not null,
  contribution_score  numeric(6,3) not null default 0,
  score_breakdown     jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  unique (deal_id, visit_id)
);
create index visit_attributions_deal_idx on public.visit_attributions (deal_id, visit_rank);

-- Late FK wiring for tables declared earlier.
alter table public.crm_tasks
  add constraint crm_tasks_visit_fk foreign key (visit_id)
  references public.visits(id) on delete set null;
alter table public.crm_notes
  add constraint crm_notes_visit_fk foreign key (visit_id)
  references public.visits(id) on delete set null;
alter table public.property_price_history
  add constraint price_history_listing_fk foreign key (listing_id)
  references public.listings(id) on delete set null;
alter table public.listing_referrals
  add constraint listing_referrals_lead_fk foreign key (lead_id)
  references public.leads(id) on delete set null;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000007_deals_and_commissions.sql
-- ===========================================================================

-- ===========================================================================
-- 0007 · Deals, commission rules, calculations and the ledger
-- ===========================================================================
-- Financial rules encoded here:
--   * All money is NUMERIC(14,2) with an explicit currency. Never float.
--   * Commission rules are DATA. The resolved policy is SNAPSHOTTED into each
--     calculation so that editing a rule can never rewrite history.
--   * Ledger rows are immutable once PAID; corrections are reversal/adjustment
--     entries, never in-place edits.
-- ===========================================================================

create table public.deals (
  id                   uuid primary key default gen_random_uuid(),
  reference_code       text not null unique,          -- DEAL-NCR-000456
  customer_id          uuid not null references public.customers(id) on delete restrict,
  property_id          uuid not null references public.property_passports(id) on delete restrict,
  listing_id           uuid references public.listings(id) on delete set null,
  lead_id              uuid references public.leads(id) on delete set null,

  listing_type         public.listing_type not null,
  status               public.deal_status not null default 'INITIATED',

  asking_price         public.money_amount,
  negotiated_price     public.money_amount,
  final_price          public.money_amount,
  booking_amount       public.money_amount,
  currency             public.currency_code not null default 'INR',

  -- Commission pool. Either derived from the policy or explicitly agreed.
  commission_pool      public.money_amount,
  commission_pool_source text not null default 'POLICY'
                         check (commission_pool_source in ('POLICY','MANUAL')),

  seller_name          text,
  seller_contact_masked text,

  expected_closure_date date,
  booked_at            timestamptz,
  closed_at            timestamptz,
  lost_reason          text,
  notes                text,

  created_by           uuid references public.profiles(id),
  is_demo              boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint deals_closed_needs_price check (
    status <> 'CLOSED_WON' or final_price is not null
  )
);
create index deals_customer_idx on public.deals (customer_id);
create index deals_property_idx on public.deals (property_id);
create index deals_status_idx   on public.deals (status, created_at desc);

-- ---------------------------------------------------------------------------
-- deal_participants — who is in the deal, in which role, with which entitlement
-- ---------------------------------------------------------------------------
create table public.deal_participants (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,
  role            public.deal_participant_role not null,
  agent_id        uuid references public.agents(id) on delete set null,
  investor_id     uuid references public.investors(id) on delete set null,
  user_id         uuid references public.profiles(id) on delete set null,
  -- Optional override of the policy share for this participant only.
  override_percent public.percentage,
  override_amount  public.money_amount,
  contribution_notes text,
  added_by        uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  -- A participant slot must identify someone, unless it is the platform itself.
  constraint deal_participants_identity check (
    role = 'PLATFORM' or agent_id is not null or investor_id is not null or user_id is not null
  ),
  -- One agent cannot hold the same role twice on one deal.
  unique (deal_id, role, agent_id)
);
create index deal_participants_deal_idx  on public.deal_participants (deal_id);
create index deal_participants_agent_idx on public.deal_participants (agent_id);

-- ---------------------------------------------------------------------------
-- deal_events — APPEND ONLY timeline / audit trail
-- ---------------------------------------------------------------------------
create table public.deal_events (
  id          uuid primary key default gen_random_uuid(),
  deal_id     uuid not null references public.deals(id) on delete cascade,
  event_type  text not null,
  from_status public.deal_status,
  to_status   public.deal_status,
  actor_id    uuid references public.profiles(id),
  amount      public.money_amount,
  currency    public.currency_code,
  notes       text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index deal_events_deal_idx on public.deal_events (deal_id, created_at desc);

create table public.deal_documents (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references public.deals(id) on delete cascade,
  document_type public.document_type not null,
  storage_bucket text not null default 'agreements',
  storage_path  text not null,
  file_name     text not null,
  mime_type     text not null,
  file_size     integer not null check (file_size > 0),
  uploaded_by   uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index deal_documents_deal_idx on public.deal_documents (deal_id);

-- ---------------------------------------------------------------------------
-- commission_rules — CONFIGURATION, not code (§22)
-- ---------------------------------------------------------------------------
-- `policy` holds the full machine-readable policy document consumed by
-- src/lib/domain/commission.ts. Shape is validated by Zod
-- (CommissionPolicySchema) before it is ever persisted.
-- ---------------------------------------------------------------------------
create table public.commission_rules (
  id                  uuid primary key default gen_random_uuid(),
  code                text not null,
  name                text not null,
  description         text,
  version             integer not null default 1,

  -- Scope. NULL means "applies to everything at this level".
  listing_type        public.listing_type,
  property_category   public.property_category,
  city                text,
  region_code         text references public.regions(code),
  min_transaction_value public.money_amount,
  max_transaction_value public.money_amount,

  pool_mode           public.commission_pool_mode not null default 'PERCENT_OF_TRANSACTION',
  pool_percent        public.percentage,
  pool_fixed_amount   public.money_amount,
  min_pool_amount     public.money_amount,
  max_pool_amount     public.money_amount,

  visit_model         public.visit_distribution_model not null default 'LATEST_WEIGHTED',

  -- Full policy document: role shares, visit tiers, score weights, caps/floors,
  -- unallocated-share strategy.
  policy              jsonb not null,

  currency            public.currency_code not null default 'INR',
  priority            integer not null default 100,
  is_active           boolean not null default true,
  effective_from      timestamptz not null default now(),
  effective_until     timestamptz,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  unique (code, version),
  constraint commission_rules_pool_config check (
    (pool_mode = 'PERCENT_OF_TRANSACTION' and pool_percent is not null)
    or (pool_mode = 'FIXED_AMOUNT' and pool_fixed_amount is not null)
  ),
  constraint commission_rules_effective_window check (
    effective_until is null or effective_until > effective_from
  )
);
create index commission_rules_active_idx on public.commission_rules
  (is_active, priority, effective_from desc) where is_active;
comment on table public.commission_rules is
  'Commission percentages live here as data. Nothing in application code hard-codes a split.';

-- ---------------------------------------------------------------------------
-- commission_calculations — one immutable calculation per deal version
-- ---------------------------------------------------------------------------
create table public.commission_calculations (
  id                 uuid primary key default gen_random_uuid(),
  deal_id            uuid not null references public.deals(id) on delete cascade,
  rule_id            uuid references public.commission_rules(id) on delete set null,
  version            integer not null default 1,

  transaction_value  public.money_amount not null,
  commission_pool    public.money_amount not null,
  currency           public.currency_code not null default 'INR',

  -- The policy AS APPLIED. Editing commission_rules later cannot change this.
  policy_snapshot    jsonb not null,
  -- Ordered, human-readable derivation shown verbatim in the UI.
  explanation        jsonb not null default '[]'::jsonb,
  engine_version     text not null default 'commission-v1',

  status             public.commission_status not null default 'CALCULATED',
  is_current         boolean not null default true,
  superseded_by      uuid references public.commission_calculations(id) on delete set null,

  calculated_by      uuid references public.profiles(id),
  calculated_at      timestamptz not null default now(),
  approved_by        uuid references public.profiles(id),
  approved_at        timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),

  unique (deal_id, version)
);
create index commission_calculations_deal_idx on public.commission_calculations (deal_id, version desc);
create unique index commission_calculations_current_idx
  on public.commission_calculations (deal_id) where is_current;

-- ---------------------------------------------------------------------------
-- commission_distributions — per participant, per calculation
-- ---------------------------------------------------------------------------
create table public.commission_distributions (
  id               uuid primary key default gen_random_uuid(),
  calculation_id   uuid not null references public.commission_calculations(id) on delete cascade,
  deal_id          uuid not null references public.deals(id) on delete cascade,
  participant_id   uuid references public.deal_participants(id) on delete set null,
  role             public.deal_participant_role not null,
  agent_id         uuid references public.agents(id) on delete set null,
  investor_id      uuid references public.investors(id) on delete set null,
  user_id          uuid references public.profiles(id) on delete set null,
  visit_id         uuid references public.visits(id) on delete set null,

  share_percent    public.percentage,
  amount           public.money_amount not null,
  currency         public.currency_code not null default 'INR',
  -- Amount in integer minor units, exactly as the engine computed it. This is
  -- the reconciliation column: the sum of these equals the pool in paise.
  amount_minor     bigint not null check (amount_minor >= 0),

  tier             text,
  contribution_score numeric(6,3),
  calculation_basis jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);
create index commission_distributions_calc_idx  on public.commission_distributions (calculation_id);
create index commission_distributions_agent_idx on public.commission_distributions (agent_id);

-- ---------------------------------------------------------------------------
-- commission_ledger — the financial record of record (§23)
-- ---------------------------------------------------------------------------
create table public.commission_ledger (
  id                uuid primary key default gen_random_uuid(),
  reference_code    text not null unique,             -- COMM-NCR-000789
  deal_id           uuid not null references public.deals(id) on delete restrict,
  calculation_id    uuid references public.commission_calculations(id) on delete set null,
  distribution_id   uuid references public.commission_distributions(id) on delete set null,

  user_id           uuid references public.profiles(id) on delete set null,
  agent_id          uuid references public.agents(id) on delete set null,
  investor_id       uuid references public.investors(id) on delete set null,
  role              public.deal_participant_role not null,

  entry_type        public.ledger_entry_type not null default 'EARNING',
  amount            public.money_amount not null,
  amount_minor      bigint not null,
  currency          public.currency_code not null default 'INR',

  status            public.commission_status not null default 'CALCULATED',
  calculation_rule  text,
  -- Reversal/adjustment entries point at the row they correct.
  reverses_entry_id uuid references public.commission_ledger(id) on delete set null,
  adjustment_reason text,

  approved_by       uuid references public.profiles(id),
  approved_at       timestamptz,
  paid_at           timestamptz,
  payment_id        uuid,
  payment_reference text,
  dispute_id        uuid,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- Reversals are negative; earnings are positive. Signs are enforced, not hoped for.
  constraint ledger_sign_matches_type check (
    (entry_type in ('EARNING','PAYOUT') and amount_minor >= 0)
    or (entry_type in ('REVERSAL') and amount_minor <= 0)
    or (entry_type = 'ADJUSTMENT')
  ),
  constraint ledger_reversal_needs_target check (
    entry_type <> 'REVERSAL' or reverses_entry_id is not null
  )
);
create index ledger_deal_idx   on public.commission_ledger (deal_id);
create index ledger_agent_idx  on public.commission_ledger (agent_id, status, created_at desc);
create index ledger_user_idx   on public.commission_ledger (user_id, status);
create index ledger_status_idx on public.commission_ledger (status, created_at desc);
comment on table public.commission_ledger is
  'Append-mostly. A PAID row is never rewritten; corrections are ADJUSTMENT or REVERSAL entries.';

-- ---------------------------------------------------------------------------
-- payments — a REFERENCE to settlement performed by a licensed processor.
-- The platform holds no funds. See docs/LEGAL_REVIEW.md L4.
-- ---------------------------------------------------------------------------
create table public.payments (
  id                uuid primary key default gen_random_uuid(),
  reference_code    text not null unique,
  deal_id           uuid references public.deals(id) on delete set null,
  payee_user_id     uuid references public.profiles(id) on delete set null,
  amount            public.money_amount not null,
  amount_minor      bigint not null,
  currency          public.currency_code not null default 'INR',
  status            public.payment_status not null default 'INITIATED',
  processor         text,
  processor_reference text,
  initiated_by      uuid references public.profiles(id),
  initiated_at      timestamptz not null default now(),
  completed_at      timestamptz,
  failure_reason    text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index payments_deal_idx on public.payments (deal_id);
create index payments_payee_idx on public.payments (payee_user_id, status);

alter table public.commission_ledger
  add constraint ledger_payment_fk foreign key (payment_id)
  references public.payments(id) on delete set null;

alter table public.visit_attributions
  add constraint visit_attributions_deal_fk foreign key (deal_id)
  references public.deals(id) on delete cascade;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000008_investor_module.sql
-- ===========================================================================

-- ===========================================================================
-- 0008 · Investor / exclusive inventory  (FEATURE-FLAGGED, LEGALLY GATED)
-- ===========================================================================
-- READ docs/LEGAL_REVIEW.md item L1 BEFORE ENABLING.
--
-- This module deliberately does NOT model "an investor buys 25% of a property
-- and resells it". That construction risks characterisation as an unregistered
-- collective investment scheme, an agreement to sell attracting stamp duty, or
-- a benami arrangement.
--
-- What is modelled instead: CONFIGURABLE CONTRACTUAL RIGHTS over inventory
-- (exclusive marketing, reservation, distribution), with the agreement type,
-- economics and documents as data — subject to legal sign-off per deployment.
--
-- The application gates every route and query in this module behind
-- ENABLE_INVESTOR_MODULE, which defaults to false.
-- ===========================================================================

create table public.investor_opportunities (
  id                  uuid primary key default gen_random_uuid(),
  reference_code      text not null unique,           -- OPP-NCR-000123
  property_id         uuid not null references public.property_passports(id) on delete cascade,
  listing_id          uuid references public.listings(id) on delete set null,
  created_by          uuid references public.profiles(id),

  title               text not null,
  summary             text,
  agreement_type      public.agreement_type not null default 'EXCLUSIVE_MARKETING_RIGHTS',

  -- Economics. All NUMERIC; all computed server-side; all indicative until an
  -- agreement is legally executed.
  seller_price        public.money_amount not null,
  capital_amount      public.money_amount not null,
  target_exit_price   public.money_amount not null,
  expected_margin     public.money_amount,
  platform_fee_percent public.percentage not null default 0,
  currency            public.currency_code not null default 'INR',
  holding_period_months integer check (holding_period_months is null or holding_period_months > 0),

  status              public.exclusive_status not null default 'AVAILABLE',
  -- Eligibility rules evaluated server-side (city, ticket size, accreditation).
  eligibility         jsonb not null default '{}'::jsonb,
  risk_notes          text,
  -- Mandatory, non-removable disclaimer rendered wherever this is displayed.
  legal_disclaimer    text not null default
    'Indicative economics only. This is not an offer of securities, nor an agreement to sell or transfer any interest in immovable property. Any arrangement is subject to a separate written agreement and applicable law.',

  opens_at            timestamptz,
  closes_at           timestamptz,
  is_demo             boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint opportunities_exit_above_seller check (target_exit_price >= seller_price),
  constraint opportunities_capital_positive check (capital_amount > 0)
);
create index opportunities_status_idx   on public.investor_opportunities (status, created_at desc);
create index opportunities_property_idx on public.investor_opportunities (property_id);

create table public.investor_interests (
  id             uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.investor_opportunities(id) on delete cascade,
  investor_id    uuid not null references public.investors(id) on delete cascade,
  status         text not null default 'INTERESTED'
                   check (status in ('INTERESTED','SHORTLISTED','WITHDRAWN','SELECTED','REJECTED')),
  proposed_capital public.money_amount,
  message        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (opportunity_id, investor_id)
);

-- ---------------------------------------------------------------------------
-- agreements — the contractual instrument. Never auto-activated.
-- ---------------------------------------------------------------------------
create table public.agreements (
  id                 uuid primary key default gen_random_uuid(),
  reference_code     text not null unique,            -- AGR-NCR-000123
  agreement_type     public.agreement_type not null,
  status             public.agreement_status not null default 'DRAFT',

  opportunity_id     uuid references public.investor_opportunities(id) on delete set null,
  property_id        uuid references public.property_passports(id) on delete set null,
  investor_id        uuid references public.investors(id) on delete set null,
  deal_id            uuid references public.deals(id) on delete set null,

  template_key       text,
  terms              jsonb not null default '{}'::jsonb,
  capital_amount     public.money_amount,
  exit_price         public.money_amount,
  expected_margin    public.money_amount,
  platform_fee_percent public.percentage,
  investor_share_percent public.percentage,
  currency           public.currency_code not null default 'INR',

  starts_on          date,
  ends_on            date,
  signed_at          timestamptz,
  terminated_at      timestamptz,
  termination_reason text,

  -- A human must record legal clearance. There is no code path that sets this.
  legal_reviewed_by  uuid references public.profiles(id),
  legal_reviewed_at  timestamptz,
  legal_review_notes text,

  storage_bucket     text default 'agreements',
  storage_path       text,
  created_by         uuid references public.profiles(id),
  is_demo            boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint agreements_date_order check (ends_on is null or starts_on is null or ends_on >= starts_on),
  -- An agreement cannot become ACTIVE without a recorded legal review.
  constraint agreements_active_requires_legal_review check (
    status <> 'ACTIVE' or legal_reviewed_at is not null
  )
);
create index agreements_investor_idx on public.agreements (investor_id, status);
create index agreements_property_idx on public.agreements (property_id);
comment on constraint agreements_active_requires_legal_review on public.agreements is
  'Structural guarantee that no exclusive-inventory agreement goes live without recorded human legal review.';

-- ---------------------------------------------------------------------------
-- exclusive_inventory — an ACTIVE agreement projected onto a property
-- ---------------------------------------------------------------------------
create table public.exclusive_inventory (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references public.property_passports(id) on delete cascade,
  listing_id      uuid references public.listings(id) on delete set null,
  agreement_id    uuid not null references public.agreements(id) on delete cascade,
  investor_id     uuid references public.investors(id) on delete set null,
  status          public.exclusive_status not null default 'EXCLUSIVE',
  starts_on       date not null,
  ends_on         date not null,
  -- Which agents may transact this inventory, and on what terms.
  access_policy   text not null default 'REQUEST_REQUIRED'
                    check (access_policy in ('OPEN_TO_NETWORK','REQUEST_REQUIRED','INVITE_ONLY')),
  agent_commission_percent public.percentage,
  released_at     timestamptz,
  release_reason  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint exclusive_date_order check (ends_on >= starts_on)
);
create index exclusive_property_idx on public.exclusive_inventory (property_id, status);
create index exclusive_expiry_idx   on public.exclusive_inventory (ends_on) where status = 'EXCLUSIVE';
-- A property can hold only one live exclusivity window at a time.
create unique index exclusive_one_active_idx
  on public.exclusive_inventory (property_id) where status = 'EXCLUSIVE';

create table public.investor_positions (
  id                uuid primary key default gen_random_uuid(),
  investor_id       uuid not null references public.investors(id) on delete cascade,
  agreement_id      uuid not null references public.agreements(id) on delete cascade,
  property_id       uuid references public.property_passports(id) on delete set null,
  deal_id           uuid references public.deals(id) on delete set null,
  capital_deployed  public.money_amount not null default 0,
  expected_return   public.money_amount,
  realised_return   public.money_amount,
  currency          public.currency_code not null default 'INR',
  status            text not null default 'ACTIVE'
                      check (status in ('ACTIVE','EXITED','WRITTEN_OFF','CANCELLED')),
  entered_on        date not null default current_date,
  exited_on         date,
  settlement_notes  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index investor_positions_idx on public.investor_positions (investor_id, status);


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000009_platform.sql
-- ===========================================================================

-- ===========================================================================
-- 0009 · Platform services: notifications, reviews, disputes, audit, config
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- notifications (§38) — channel-agnostic. Business code emits EVENTS; adapters
-- decide how to deliver them.
-- ---------------------------------------------------------------------------
create table public.notification_templates (
  key             text primary key,               -- e.g. 'visit.reminder'
  name            text not null,
  description     text,
  channels        public.notification_channel[] not null default array['IN_APP']::public.notification_channel[],
  subject_template text,
  body_template   text not null,
  -- Variables the template expects; validated before send.
  variables       text[] not null default '{}',
  -- WhatsApp/SMS require pre-registered provider templates (DLT / Meta).
  provider_template_id text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  template_key  text references public.notification_templates(key) on delete set null,
  channel       public.notification_channel not null default 'IN_APP',
  event_type    text not null,
  title         text not null,
  body          text not null,
  action_url    text,
  entity_type   text,
  entity_id     uuid,
  payload       jsonb not null default '{}'::jsonb,
  status        public.notification_status not null default 'QUEUED',
  scheduled_for timestamptz,
  sent_at       timestamptz,
  read_at       timestamptz,
  failure_reason text,
  provider      text,
  provider_message_id text,
  attempts      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index notifications_user_idx    on public.notifications (user_id, created_at desc);
create index notifications_unread_idx  on public.notifications (user_id) where read_at is null;
create index notifications_queue_idx   on public.notifications (status, scheduled_for)
  where status = 'QUEUED';

create table public.notification_preferences (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  in_app_enabled     boolean not null default true,
  email_enabled      boolean not null default true,
  -- Off by default: TRAI DLT / WhatsApp Business Policy consent required first.
  sms_enabled        boolean not null default false,
  whatsapp_enabled   boolean not null default false,
  push_enabled       boolean not null default false,
  sms_consent_at     timestamptz,
  whatsapp_consent_at timestamptz,
  quiet_hours_start  time,
  quiet_hours_end    time,
  muted_events       text[] not null default '{}',
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reviews (§37) — moderated. No anonymous public accusations.
-- ---------------------------------------------------------------------------
create table public.reviews (
  id                uuid primary key default gen_random_uuid(),
  subject_type      public.review_subject not null,
  agent_id          uuid references public.agents(id) on delete cascade,
  property_id       uuid references public.property_passports(id) on delete cascade,
  visit_id          uuid references public.visits(id) on delete set null,
  deal_id           uuid references public.deals(id) on delete set null,
  author_id         uuid not null references public.profiles(id) on delete cascade,
  customer_id       uuid references public.customers(id) on delete set null,
  rating            smallint not null check (rating between 1 and 5),
  title             text,
  body              text,
  -- A review must be tied to a real interaction; verified reviews rank higher.
  is_verified_interaction boolean not null default false,
  moderation_status public.moderation_status not null default 'PENDING',
  moderated_by      uuid references public.profiles(id),
  moderated_at      timestamptz,
  moderation_notes  text,
  rejection_reason  text,
  agent_response    text,
  agent_responded_at timestamptz,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint reviews_subject_target check (
    (subject_type = 'AGENT'    and agent_id is not null) or
    (subject_type = 'VISIT'    and visit_id is not null) or
    (subject_type = 'PROPERTY' and property_id is not null)
  )
);
create index reviews_agent_idx      on public.reviews (agent_id, moderation_status);
create index reviews_moderation_idx on public.reviews (moderation_status, created_at)
  where moderation_status = 'PENDING';
comment on table public.reviews is
  'Every review is moderated before publication. Authorship is always recorded; anonymous public accusations are not supported.';

-- ---------------------------------------------------------------------------
-- disputes (§68)
-- ---------------------------------------------------------------------------
create table public.disputes (
  id               uuid primary key default gen_random_uuid(),
  reference_code   text not null unique,            -- DSP-NCR-000123
  category         public.dispute_category not null,
  status           public.dispute_status not null default 'OPEN',
  priority         text not null default 'MEDIUM' check (priority in ('LOW','MEDIUM','HIGH','CRITICAL')),

  raised_by        uuid not null references public.profiles(id) on delete cascade,
  raised_by_agent_id uuid references public.agents(id) on delete set null,
  against_user_id  uuid references public.profiles(id) on delete set null,
  against_agent_id uuid references public.agents(id) on delete set null,

  -- Polymorphic subject, constrained to known entity types.
  entity_type      text not null check (entity_type in
                     ('LEAD','LISTING','PROPERTY','VISIT','DEAL','COMMISSION','AGREEMENT')),
  entity_id        uuid not null,

  title            text not null,
  description      text not null,
  claimed_amount   public.money_amount,
  currency         public.currency_code not null default 'INR',

  assigned_to      uuid references public.profiles(id) on delete set null,
  admin_decision   text,
  resolution       text,
  resolved_by      uuid references public.profiles(id),
  resolved_at      timestamptz,
  escalated_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index disputes_status_idx  on public.disputes (status, priority, created_at desc);
create index disputes_entity_idx  on public.disputes (entity_type, entity_id);
create index disputes_raiser_idx  on public.disputes (raised_by);

alter table public.commission_ledger
  add constraint ledger_dispute_fk foreign key (dispute_id)
  references public.disputes(id) on delete set null;

create table public.dispute_evidence (
  id             uuid primary key default gen_random_uuid(),
  dispute_id     uuid not null references public.disputes(id) on delete cascade,
  submitted_by   uuid not null references public.profiles(id) on delete cascade,
  description    text,
  storage_bucket text,
  storage_path   text,
  file_name      text,
  mime_type      text,
  file_size      integer,
  created_at     timestamptz not null default now()
);
create index dispute_evidence_idx on public.dispute_evidence (dispute_id);

create table public.dispute_events (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references public.disputes(id) on delete cascade,
  event_type  text not null,
  from_status public.dispute_status,
  to_status   public.dispute_status,
  actor_id    uuid references public.profiles(id),
  notes       text,
  created_at  timestamptz not null default now()
);
create index dispute_events_idx on public.dispute_events (dispute_id, created_at desc);

-- ---------------------------------------------------------------------------
-- audit_logs (§45) — APPEND ONLY. UPDATE/DELETE are revoked in 0011.
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id           bigserial primary key,
  actor_id     uuid references public.profiles(id) on delete set null,
  actor_role   text,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  entity_code  text,
  before_state jsonb,
  after_state  jsonb,
  diff         jsonb,
  reason       text,
  ip_address   inet,
  user_agent   text,
  request_id   text,
  created_at   timestamptz not null default now()
);
create index audit_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_actor_idx  on public.audit_logs (actor_id, created_at desc);
create index audit_action_idx on public.audit_logs (action, created_at desc);
comment on table public.audit_logs is
  'Append-only. No application role holds UPDATE or DELETE on this table.';

-- ---------------------------------------------------------------------------
-- analytics_events (§56)
-- ---------------------------------------------------------------------------
create table public.analytics_events (
  id          bigserial primary key,
  event_name  text not null,
  user_id     uuid references public.profiles(id) on delete set null,
  session_id  text,
  entity_type text,
  entity_id   uuid,
  properties  jsonb not null default '{}'::jsonb,
  city        text,
  source      text,
  created_at  timestamptz not null default now()
);
create index analytics_name_idx   on public.analytics_events (event_name, created_at desc);
create index analytics_entity_idx on public.analytics_events (entity_type, entity_id);
create index analytics_user_idx   on public.analytics_events (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- configuration
-- ---------------------------------------------------------------------------
create table public.admin_settings (
  key         text primary key,
  value       jsonb not null,
  category    text not null default 'general',
  label       text not null,
  description text,
  is_public   boolean not null default false,   -- readable by anon/authenticated
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

create table public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  label       text not null,
  description text,
  -- Optional gradual rollout / role targeting.
  rollout_percent integer not null default 100 check (rollout_percent between 0 and 100),
  target_roles public.app_role[] not null default '{}',
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, label, description) values
  ('ENABLE_INVESTOR_MODULE',     false, 'Investor module',
     'Exclusive inventory and investor economics. Blocked on legal sign-off (docs/LEGAL_REVIEW.md L1).'),
  ('ENABLE_AI_SEARCH',           true,  'AI natural-language search', 'Parse free-text queries into structured filters.'),
  ('ENABLE_AI_LISTING_ASSISTANT',true,  'AI listing assistant', 'Draft listing copy for agent approval.'),
  ('ENABLE_VIRTUAL_TOURS',       true,  'Virtual tours', 'Video, 360 and live tour support.'),
  ('ENABLE_WHATSAPP',            false, 'WhatsApp notifications', 'Requires approved Business templates.'),
  ('ENABLE_SMS',                 false, 'SMS notifications', 'Requires TRAI DLT registration.'),
  ('ENABLE_PUSH',                false, 'Push notifications', 'Requires VAPID/FCM configuration.'),
  ('ENABLE_DOCUMENT_AI',         false, 'Document OCR', 'Phase 3. Risk signals only; never a legal authenticity claim.'),
  ('ENABLE_PROPERTY_VALUATION',  false, 'Property valuation', 'Phase 3. Requires disclaimer review.'),
  ('ENABLE_NRI_MODE',            false, 'NRI mode', 'Phase 3.'),
  ('ENABLE_MARKETING_KIT',       true,  'Marketing kit', 'Generate social/WhatsApp/brochure assets for a listing.');

-- ---------------------------------------------------------------------------
-- api_keys — partner access to /api/v1 (§53). Only a hash is stored.
-- ---------------------------------------------------------------------------
create table public.api_keys (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  key_prefix    text not null unique,
  key_hash      text not null,
  owner_user_id uuid references public.profiles(id) on delete cascade,
  scopes        text[] not null default '{}',
  rate_limit_per_minute integer not null default 60,
  last_used_at  timestamptz,
  expires_at    timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- idempotency_keys — replay protection for unsafe API calls (§62)
-- ---------------------------------------------------------------------------
create table public.idempotency_keys (
  key            text primary key,
  user_id        uuid references public.profiles(id) on delete cascade,
  endpoint       text not null,
  request_hash   text not null,
  response_status integer,
  response_body  jsonb,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null default (now() + interval '24 hours')
);
create index idempotency_expiry_idx on public.idempotency_keys (expires_at);


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000010_functions_and_triggers.sql
-- ===========================================================================

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


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000011_rls_policies.sql
-- ===========================================================================

-- ===========================================================================
-- 0011 · Row Level Security
-- ===========================================================================
-- RLS is THE authorisation boundary. Application checks are defence in depth;
-- if they were all removed, these policies would still hold the line.
--
-- Guiding rules:
--   * Deny by default. RLS is enabled on every table in `public`.
--   * Customers see only their own data.
--   * Agents see their own inventory, their own CRM, inventory explicitly
--     shared with them, visits assigned to them, and their own money.
--   * Investors see only their own positions.
--   * Admins see everything, scoped by admin sub-role where it matters.
--   * The public sees VERIFIED listings and nothing else.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','user_roles','agents','agent_verifications','agent_documents',
    'agent_rera_records','customers','investors','investor_verifications',
    'regions','reference_counters','projects','property_passports','property_addresses',
    'property_media','property_documents','amenities','property_amenities',
    'property_nearby_places','property_verifications','property_price_history',
    'property_duplicate_candidates','listings','listing_media','listing_status_history',
    'listing_shares','listing_referrals','favorites','saved_searches',
    'customer_requirements','requirement_matches','leads','lead_events',
    'contact_access_logs','crm_contacts','crm_tasks','crm_notes',
    'visits','visit_assignments','visit_checkins','visit_feedback','visit_attributions',
    'deals','deal_participants','deal_events','deal_documents',
    'commission_rules','commission_calculations','commission_distributions',
    'commission_ledger','payments',
    'investor_opportunities','investor_interests','agreements','exclusive_inventory',
    'investor_positions',
    'notification_templates','notifications','notification_preferences',
    'reviews','disputes','dispute_evidence','dispute_events',
    'audit_logs','analytics_events','admin_settings','feature_flags',
    'api_keys','idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference data — world readable, admin writable
-- ---------------------------------------------------------------------------
create policy "roles readable" on public.roles for select using (true);
create policy "regions readable" on public.regions for select using (true);
create policy "amenities readable" on public.amenities for select using (true);
create policy "regions admin write" on public.regions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "amenities admin write" on public.amenities for all
  using (public.is_admin()) with check (public.is_admin());

-- Feature flags are readable so the UI can render consistently; only admins write.
create policy "flags readable" on public.feature_flags for select using (true);
create policy "flags admin write" on public.feature_flags for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

create policy "public settings readable" on public.admin_settings for select
  using (is_public or public.is_admin());
create policy "settings admin write" on public.admin_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- reference_counters is machinery: nobody reads or writes it directly. The
-- SECURITY DEFINER function next_reference() is the only access path.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles select own" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin manage" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Roles: readable by the owner and admins; only admins may grant or revoke.
create policy "user_roles select own" on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_roles admin manage" on public.user_roles for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

-- ---------------------------------------------------------------------------
-- Guard-trigger context helper
-- ---------------------------------------------------------------------------
-- The guard triggers below stop an END USER from writing columns that the
-- platform owns (badges, moderation decisions, visit qualification). They must
-- NOT block the platform itself: the service-role client, migrations, seeds and
-- background jobs legitimately write exactly those columns after running the
-- domain rules.
--
-- Those contexts have no end-user JWT, so `auth.uid()` is null. That is a safe
-- discriminator: an anonymous browser request also has a null uid, but RLS
-- gives `anon` no UPDATE path to any of these tables in the first place, so it
-- can never reach a guard trigger.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_context()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is null;
$$;

-- ---------------------------------------------------------------------------
-- agents — professional profiles are public; performance internals are not.
-- (The public surface is the `public_agents` view defined at the end.)
-- ---------------------------------------------------------------------------
create policy "agents readable" on public.agents for select
  using (status = 'ACTIVE' or user_id = auth.uid() or public.is_admin());

-- An agent may edit their own profile, but NEVER their own badges, trust score
-- or verification level. Those columns are admin-only; a column-level guard is
-- added below via a BEFORE UPDATE trigger since RLS is row-level.
create policy "agents update own" on public.agents for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agents admin manage" on public.agents for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_agent_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then
    return new;
  end if;
  -- Verification standing is granted by the platform, never self-claimed (§10).
  new.verification_level    := old.verification_level;
  new.badges                := old.badges;
  new.trust_score           := old.trust_score;
  new.rating_average        := old.rating_average;
  new.rating_count          := old.rating_count;
  new.response_rate         := old.response_rate;
  new.visit_completion_rate := old.visit_completion_rate;
  new.cancellation_rate     := old.cancellation_rate;
  new.conversion_rate       := old.conversion_rate;
  new.closed_deal_count     := old.closed_deal_count;
  new.complaint_count       := old.complaint_count;
  new.risk_score            := old.risk_score;
  new.status                := old.status;
  return new;
end;
$$;
create trigger agents_guard_self_promotion
  before update on public.agents
  for each row execute function public.guard_agent_self_promotion();

-- Verification submissions: agent reads/creates own, admin reviews.
create policy "agent_verifications own" on public.agent_verifications for select
  using (agent_id = public.current_agent_id() or public.has_admin_role('verification_admin'));
create policy "agent_verifications insert own" on public.agent_verifications for insert
  with check (agent_id = public.current_agent_id());
create policy "agent_verifications update own pending" on public.agent_verifications for update
  using (agent_id = public.current_agent_id() and status in ('SUBMITTED','REJECTED'))
  with check (agent_id = public.current_agent_id());
create policy "agent_verifications admin" on public.agent_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

create policy "agent_documents own" on public.agent_documents for select
  using (agent_id = public.current_agent_id() or public.has_admin_role('verification_admin'));
create policy "agent_documents insert own" on public.agent_documents for insert
  with check (agent_id = public.current_agent_id());
create policy "agent_documents delete own pending" on public.agent_documents for delete
  using (agent_id = public.current_agent_id() and status = 'SUBMITTED');
create policy "agent_documents admin" on public.agent_documents for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- RERA records are publicly checkable once approved: that is the point of them.
create policy "rera readable" on public.agent_rera_records for select
  using (status = 'APPROVED' or agent_id = public.current_agent_id() or public.is_admin());
create policy "rera insert own" on public.agent_rera_records for insert
  with check (agent_id = public.current_agent_id());
create policy "rera admin" on public.agent_rera_records for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- ---------------------------------------------------------------------------
-- customers — the strictest table in the schema (§47)
-- ---------------------------------------------------------------------------
-- Agents deliberately have NO direct select on customers. They reach customer
-- data only through leads they own, and contact details only after an audited
-- unlock. There is no policy here that grants the agent network bulk access.
-- ---------------------------------------------------------------------------
create policy "customers select own" on public.customers for select
  using (user_id = auth.uid() or public.is_admin());
create policy "customers insert own" on public.customers for insert
  with check (user_id = auth.uid());
create policy "customers update own" on public.customers for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers admin" on public.customers for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- investors
-- ---------------------------------------------------------------------------
create policy "investors select own" on public.investors for select
  using (user_id = auth.uid() or public.is_admin());
create policy "investors insert own" on public.investors for insert
  with check (user_id = auth.uid());
create policy "investors update own" on public.investors for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "investors admin" on public.investors for all
  using (public.is_admin()) with check (public.is_admin());

create policy "investor_verifications own" on public.investor_verifications for select
  using (investor_id = public.current_investor_id() or public.has_admin_role('verification_admin'));
create policy "investor_verifications insert own" on public.investor_verifications for insert
  with check (investor_id = public.current_investor_id());
create policy "investor_verifications admin" on public.investor_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- ---------------------------------------------------------------------------
-- Property passport
-- ---------------------------------------------------------------------------
-- A passport is publicly visible only when it carries at least one VERIFIED
-- listing. Drafts and rejected inventory stay private to their creator.
-- ---------------------------------------------------------------------------
create policy "projects readable" on public.projects for select using (true);
create policy "projects agent create" on public.projects for insert
  with check (public.has_role('agent') or public.is_admin());
create policy "projects admin manage" on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

create policy "passports public read" on public.property_passports for select
  using (
    exists (select 1 from public.listings l
             where l.property_id = property_passports.id and l.status = 'VERIFIED')
    or created_by = auth.uid()
    or exists (select 1 from public.listings l
                where l.property_id = property_passports.id
                  and l.agent_id = public.current_agent_id())
    or public.is_admin()
  );
create policy "passports agent create" on public.property_passports for insert
  with check ((public.has_role('agent') and created_by = auth.uid()) or public.is_admin());
create policy "passports agent update own" on public.property_passports for update
  using (
    public.is_admin()
    or (created_by = auth.uid() and status in ('DRAFT','PENDING_VERIFICATION'))
    or exists (select 1 from public.listings l
                where l.property_id = property_passports.id
                  and l.agent_id = public.current_agent_id())
  )
  with check (public.is_admin() or created_by = auth.uid()
              or exists (select 1 from public.listings l
                          where l.property_id = property_passports.id
                            and l.agent_id = public.current_agent_id()));
create policy "passports admin" on public.property_passports for all
  using (public.is_admin()) with check (public.is_admin());

-- Passport child tables inherit the passport's visibility.
create or replace function public.can_read_property(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.property_passports p where p.id = target)
     and (
       exists (select 1 from public.listings l where l.property_id = target and l.status = 'VERIFIED')
       or exists (select 1 from public.property_passports p where p.id = target and p.created_by = auth.uid())
       or exists (select 1 from public.listings l where l.property_id = target and l.agent_id = public.current_agent_id())
       or public.is_admin()
     );
$$;

create or replace function public.can_write_property(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (select 1 from public.property_passports p
                  where p.id = target and p.created_by = auth.uid())
      or exists (select 1 from public.listings l
                  where l.property_id = target and l.agent_id = public.current_agent_id());
$$;

create policy "addresses read" on public.property_addresses for select
  using (public.can_read_property(property_id));
create policy "addresses write" on public.property_addresses for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "property_media read" on public.property_media for select
  using (public.can_read_property(property_id));
create policy "property_media write" on public.property_media for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "property_amenities read" on public.property_amenities for select
  using (public.can_read_property(property_id));
create policy "property_amenities write" on public.property_amenities for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "nearby read" on public.property_nearby_places for select
  using (public.can_read_property(property_id));
create policy "nearby write" on public.property_nearby_places for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "price_history read" on public.property_price_history for select
  using (public.can_read_property(property_id));
create policy "price_history admin" on public.property_price_history for all
  using (public.is_admin()) with check (public.is_admin());

-- Property DOCUMENTS never follow the public read path. Title documents are
-- visible to the uploading agent, agents with granted access, and admins.
create policy "property_documents restricted read" on public.property_documents for select
  using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or (visibility = 'AGENTS_WITH_ACCESS' and exists (
          select 1 from public.listings l
           where l.property_id = property_documents.property_id
             and public.agent_has_listing_access(l.id)))
  );
create policy "property_documents write" on public.property_documents for insert
  with check (public.can_write_property(property_id) and uploaded_by = auth.uid());
create policy "property_documents admin" on public.property_documents for all
  using (public.is_admin()) with check (public.is_admin());

create policy "property_verifications read" on public.property_verifications for select
  using (public.can_read_property(property_id) or public.is_admin());
create policy "property_verifications admin write" on public.property_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

create policy "duplicates admin only" on public.property_duplicate_candidates for all
  using (public.has_admin_role('operations_admin')) with check (public.has_admin_role('operations_admin'));

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
-- The single most important read policy on the platform: the public sees
-- VERIFIED listings only. Draft, rejected and suspended inventory is invisible.
-- ---------------------------------------------------------------------------
create policy "listings public read verified" on public.listings for select
  using (
    status = 'VERIFIED'
    or agent_id = public.current_agent_id()
    or public.agent_has_listing_access(id)
    or public.is_admin()
  );
create policy "listings agent insert" on public.listings for insert
  with check (agent_id = public.current_agent_id());
-- An agent may edit their own listing, but not one that is locked in review.
create policy "listings agent update own" on public.listings for update
  using (agent_id = public.current_agent_id() and status <> 'UNDER_REVIEW')
  with check (agent_id = public.current_agent_id());
create policy "listings agent delete draft" on public.listings for delete
  using (agent_id = public.current_agent_id() and status = 'DRAFT');
create policy "listings admin" on public.listings for all
  using (public.is_admin()) with check (public.is_admin());

-- An agent must not self-approve. Moderation columns are admin-only.
create or replace function public.guard_listing_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then
    return new;
  end if;
  -- Agents may move DRAFT/REJECTED -> SUBMITTED, or archive their own listing.
  -- Everything else on the moderation path belongs to admins.
  if new.status is distinct from old.status
     and not (
       (old.status in ('DRAFT','REJECTED','EXPIRED') and new.status = 'SUBMITTED')
       or (old.status = 'DRAFT'    and new.status = 'DRAFT')
       or (old.status = 'VERIFIED' and new.status in ('SOLD','RENTED','EXPIRED'))
       or (old.status = 'SUBMITTED' and new.status = 'DRAFT')
     )
  then
    raise exception 'listings: agents cannot move a listing from % to %', old.status, new.status
      using errcode = 'insufficient_privilege';
  end if;

  new.reviewed_by         := old.reviewed_by;
  new.reviewed_at         := old.reviewed_at;
  new.verification_notes  := old.verification_notes;
  new.verification_score  := old.verification_score;
  new.next_verification_at := old.next_verification_at;
  new.is_exclusive        := old.is_exclusive;
  new.exclusive_until     := old.exclusive_until;
  return new;
end;
$$;
create trigger listings_guard_self_approval
  before update on public.listings
  for each row execute function public.guard_listing_self_approval();

create policy "listing_media read" on public.listing_media for select
  using (exists (select 1 from public.listings l where l.id = listing_id
                  and (l.status = 'VERIFIED' or l.agent_id = public.current_agent_id()
                       or public.agent_has_listing_access(l.id) or public.is_admin())));
create policy "listing_media write" on public.listing_media for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.agent_id = public.current_agent_id())
         or public.is_admin())
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.agent_id = public.current_agent_id())
              or public.is_admin());

create policy "listing_history read" on public.listing_status_history for select
  using (exists (select 1 from public.listings l where l.id = listing_id
                  and (l.agent_id = public.current_agent_id() or public.is_admin())));
-- History is written by triggers only; no client INSERT policy exists.

-- Inventory sharing: both sides of the request can see it.
create policy "shares visible to parties" on public.listing_shares for select
  using (owner_agent_id = public.current_agent_id()
         or requester_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "shares requester creates" on public.listing_shares for insert
  with check (requester_agent_id = public.current_agent_id());
-- Only the OWNER may approve or reject; the requester may withdraw.
create policy "shares owner responds" on public.listing_shares for update
  using (owner_agent_id = public.current_agent_id() or requester_agent_id = public.current_agent_id())
  with check (owner_agent_id = public.current_agent_id() or requester_agent_id = public.current_agent_id());

create or replace function public.guard_share_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  -- The requesting agent must never be able to approve their own request.
  if new.status is distinct from old.status
     and new.status in ('APPROVED','REJECTED')
     and old.owner_agent_id <> public.current_agent_id() then
    raise exception 'listing_shares: only the owning agent may approve or reject a share request'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger shares_guard_response
  before update on public.listing_shares
  for each row execute function public.guard_share_response();

create policy "referrals visible to parties" on public.listing_referrals for select
  using (referring_agent_id = public.current_agent_id()
         or receiving_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "referrals agent create" on public.listing_referrals for insert
  with check (referring_agent_id = public.current_agent_id());

-- ---------------------------------------------------------------------------
-- Customer-owned collections
-- ---------------------------------------------------------------------------
create policy "favorites own" on public.favorites for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id());

create policy "saved_searches own" on public.saved_searches for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id());

-- ---------------------------------------------------------------------------
-- Requirements (demand marketplace)
-- ---------------------------------------------------------------------------
-- Agents may discover ACTIVE, discoverable requirements — but the customer's
-- identity and contact details live in `customers`/`profiles`, which agents
-- cannot read. Discovery exposes the requirement, never the person.
-- ---------------------------------------------------------------------------
create policy "requirements owner" on public.customer_requirements for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id() or public.is_admin());
create policy "requirements agent discovery" on public.customer_requirements for select
  using (
    status = 'ACTIVE' and is_discoverable and public.has_role('agent')
    and exists (select 1 from public.customers c
                 where c.id = customer_requirements.customer_id
                   and c.allow_requirement_discovery)
  );

create policy "matches visible" on public.requirement_matches for select
  using (
    exists (select 1 from public.customer_requirements r
             where r.id = requirement_id and r.customer_id = public.current_customer_id())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.agent_id = public.current_agent_id())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Leads — the attribution core
-- ---------------------------------------------------------------------------
create policy "leads visible to parties" on public.leads for select
  using (
    customer_id = public.current_customer_id()
    or sales_agent_id = public.current_agent_id()
    or listing_agent_id = public.current_agent_id()
    or referral_agent_id = public.current_agent_id()
    or public.is_admin()
  );
create policy "leads customer create" on public.leads for insert
  with check (customer_id = public.current_customer_id() or public.has_role('agent') or public.is_admin());
create policy "leads agent update" on public.leads for update
  using (sales_agent_id = public.current_agent_id()
         or listing_agent_id = public.current_agent_id()
         or public.is_admin())
  with check (sales_agent_id = public.current_agent_id()
              or listing_agent_id = public.current_agent_id()
              or public.is_admin());

create policy "lead_events visible to parties" on public.lead_events for select
  using (exists (select 1 from public.leads l where l.id = lead_id
                  and (l.customer_id = public.current_customer_id()
                       or l.sales_agent_id = public.current_agent_id()
                       or l.listing_agent_id = public.current_agent_id()
                       or public.is_admin())));
create policy "lead_events insert by parties" on public.lead_events for insert
  with check (exists (select 1 from public.leads l where l.id = lead_id
                       and (l.sales_agent_id = public.current_agent_id()
                            or l.listing_agent_id = public.current_agent_id()
                            or l.customer_id = public.current_customer_id()
                            or public.is_admin())));
-- No UPDATE or DELETE policy: lead_events is append-only.

-- A customer can audit exactly who accessed their contact details.
create policy "contact_access customer visibility" on public.contact_access_logs for select
  using (customer_id = public.current_customer_id()
         or accessed_by = auth.uid()
         or public.is_admin());
-- Writes happen through the service layer (service role) only.

-- ---------------------------------------------------------------------------
-- CRM — strictly private to the owning agent
-- ---------------------------------------------------------------------------
create policy "crm_contacts own" on public.crm_contacts for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());
create policy "crm_tasks own" on public.crm_tasks for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());
create policy "crm_notes own" on public.crm_notes for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());

-- ---------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------
create policy "visits visible to parties" on public.visits for select
  using (
    customer_id = public.current_customer_id()
    or assigned_agent_id = public.current_agent_id()
    or listing_agent_id = public.current_agent_id()
    or preferred_agent_id = public.current_agent_id()
    -- An agent offered the job may see it while the offer stands.
    or exists (select 1 from public.visit_assignments va
                where va.visit_id = visits.id
                  and va.agent_id = public.current_agent_id())
    or public.is_admin()
  );
create policy "visits customer create" on public.visits for insert
  with check (customer_id = public.current_customer_id() or public.has_role('agent') or public.is_admin());
create policy "visits parties update" on public.visits for update
  using (customer_id = public.current_customer_id()
         or assigned_agent_id = public.current_agent_id()
         or listing_agent_id = public.current_agent_id()
         or public.is_admin())
  with check (customer_id = public.current_customer_id()
              or assigned_agent_id = public.current_agent_id()
              or listing_agent_id = public.current_agent_id()
              or public.is_admin());

-- Qualification decides money, so it is never client-writable. Only the
-- service role (which bypasses RLS) may set it, after the domain predicate runs.
create or replace function public.guard_visit_qualification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  if new.is_qualified is distinct from old.is_qualified
     or new.qualified_at is distinct from old.qualified_at
     or new.geofence_passed is distinct from old.geofence_passed then
    raise exception 'visits: qualification is computed by the platform and cannot be set directly'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger visits_guard_qualification
  before update on public.visits
  for each row execute function public.guard_visit_qualification();

create policy "visit_assignments visible" on public.visit_assignments for select
  using (agent_id = public.current_agent_id()
         or exists (select 1 from public.visits v where v.id = visit_id
                     and (v.customer_id = public.current_customer_id()
                          or v.listing_agent_id = public.current_agent_id()))
         or public.is_admin());
create policy "visit_assignments agent responds" on public.visit_assignments for update
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id() or public.is_admin());

create policy "visit_checkins visible" on public.visit_checkins for select
  using (exists (select 1 from public.visits v where v.id = visit_id
                  and (v.customer_id = public.current_customer_id()
                       or v.assigned_agent_id = public.current_agent_id()
                       or public.is_admin())));
create policy "visit_checkins insert by parties" on public.visit_checkins for insert
  with check (exists (select 1 from public.visits v where v.id = visit_id
                       and (v.customer_id = public.current_customer_id()
                            or v.assigned_agent_id = public.current_agent_id())));
-- Append-only: no UPDATE/DELETE policy.

create policy "visit_feedback visible" on public.visit_feedback for select
  using (customer_id = public.current_customer_id()
         or agent_id = public.current_agent_id()
         or public.is_admin());
create policy "visit_feedback customer writes" on public.visit_feedback for insert
  with check (customer_id = public.current_customer_id());

create policy "visit_attributions visible" on public.visit_attributions for select
  using (agent_id = public.current_agent_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Deals and money
-- ---------------------------------------------------------------------------
create policy "deals visible to participants" on public.deals for select
  using (
    customer_id = public.current_customer_id()
    or created_by = auth.uid()
    or exists (select 1 from public.deal_participants dp
                where dp.deal_id = deals.id
                  and (dp.agent_id = public.current_agent_id()
                       or dp.investor_id = public.current_investor_id()))
    or public.is_admin()
  );
create policy "deals agent create" on public.deals for insert
  with check (public.has_role('agent') or public.is_admin());
create policy "deals participant update" on public.deals for update
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = deals.id and dp.agent_id = public.current_agent_id()))
  with check (public.is_admin()
              or exists (select 1 from public.deal_participants dp
                          where dp.deal_id = deals.id and dp.agent_id = public.current_agent_id()));

create policy "deal_participants visible" on public.deal_participants for select
  using (agent_id = public.current_agent_id()
         or investor_id = public.current_investor_id()
         or user_id = auth.uid()
         or exists (select 1 from public.deals d where d.id = deal_id
                     and (d.customer_id = public.current_customer_id() or d.created_by = auth.uid()))
         or public.is_admin());
create policy "deal_participants manage" on public.deal_participants for all
  using (public.is_admin()
         or exists (select 1 from public.deals d where d.id = deal_id and d.created_by = auth.uid()))
  with check (public.is_admin()
              or exists (select 1 from public.deals d where d.id = deal_id and d.created_by = auth.uid()));

create policy "deal_events visible" on public.deal_events for select
  using (exists (select 1 from public.deals d where d.id = deal_id
                  and (d.customer_id = public.current_customer_id() or d.created_by = auth.uid()))
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
         or public.is_admin());

create policy "deal_documents visible" on public.deal_documents for select
  using (exists (select 1 from public.deal_participants dp
                  where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
         or public.is_admin());
create policy "deal_documents upload" on public.deal_documents for insert
  with check (uploaded_by = auth.uid() and (
    exists (select 1 from public.deal_participants dp
             where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
    or public.is_admin()));

-- Commission rules are readable by agents (transparency is the product) but
-- writable only by finance admins.
create policy "commission_rules readable" on public.commission_rules for select
  using (is_active or public.is_admin());
create policy "commission_rules finance admin" on public.commission_rules for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

create policy "calculations visible to participants" on public.commission_calculations for select
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = commission_calculations.deal_id
                       and dp.agent_id = public.current_agent_id()));
create policy "calculations finance admin" on public.commission_calculations for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- An agent sees the WHOLE breakdown of a deal they participate in. That is
-- deliberate: transparent distribution is the product promise.
create policy "distributions visible to participants" on public.commission_distributions for select
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = commission_distributions.deal_id
                       and dp.agent_id = public.current_agent_id()));
create policy "distributions finance admin" on public.commission_distributions for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- The ledger, by contrast, is strictly personal money.
create policy "ledger own entries" on public.commission_ledger for select
  using (user_id = auth.uid()
         or agent_id = public.current_agent_id()
         or investor_id = public.current_investor_id()
         or public.has_admin_role('finance_admin'));
create policy "ledger finance admin" on public.commission_ledger for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

create policy "payments own" on public.payments for select
  using (payee_user_id = auth.uid() or public.has_admin_role('finance_admin'));
create policy "payments finance admin" on public.payments for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- ---------------------------------------------------------------------------
-- Investor module (module itself is feature-flagged in the application)
-- ---------------------------------------------------------------------------
create policy "opportunities investor read" on public.investor_opportunities for select
  using ((public.has_role('investor') and status in ('AVAILABLE','INVESTOR_INTERESTED','UNDER_NEGOTIATION'))
         or public.is_admin());
create policy "opportunities admin" on public.investor_opportunities for all
  using (public.is_admin()) with check (public.is_admin());

create policy "interests own" on public.investor_interests for all
  using (investor_id = public.current_investor_id() or public.is_admin())
  with check (investor_id = public.current_investor_id());

create policy "agreements own" on public.agreements for select
  using (investor_id = public.current_investor_id() or public.is_admin());
create policy "agreements admin" on public.agreements for all
  using (public.is_admin()) with check (public.is_admin());

-- Exclusivity is public knowledge (the badge is a selling point); the
-- commercial terms behind it are not.
create policy "exclusive readable" on public.exclusive_inventory for select
  using (status = 'EXCLUSIVE' or investor_id = public.current_investor_id() or public.is_admin());
create policy "exclusive admin" on public.exclusive_inventory for all
  using (public.is_admin()) with check (public.is_admin());

create policy "positions own" on public.investor_positions for select
  using (investor_id = public.current_investor_id() or public.has_admin_role('finance_admin'));
create policy "positions admin" on public.investor_positions for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- ---------------------------------------------------------------------------
-- Notifications, reviews, disputes
-- ---------------------------------------------------------------------------
create policy "templates readable" on public.notification_templates for select
  using (public.is_admin());
create policy "templates admin" on public.notification_templates for all
  using (public.has_admin_role('content_admin')) with check (public.has_admin_role('content_admin'));

create policy "notifications own" on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());
-- A user may only mark their own notifications read; creation is server-side.
create policy "notifications mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notification_preferences own" on public.notification_preferences for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- Only APPROVED reviews are public.
create policy "reviews public read approved" on public.reviews for select
  using (moderation_status = 'APPROVED'
         or author_id = auth.uid()
         or agent_id = public.current_agent_id()
         or public.is_admin());
create policy "reviews author create" on public.reviews for insert
  with check (author_id = auth.uid());
create policy "reviews author edit pending" on public.reviews for update
  using (author_id = auth.uid() and moderation_status = 'PENDING')
  with check (author_id = auth.uid());
create policy "reviews admin moderate" on public.reviews for all
  using (public.has_admin_role('content_admin')) with check (public.has_admin_role('content_admin'));

-- An agent may respond to a review about them, but may not alter its content.
create or replace function public.guard_review_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  if old.agent_id is not null and old.agent_id = public.current_agent_id()
     and old.author_id <> auth.uid() then
    new.rating            := old.rating;
    new.title             := old.title;
    new.body              := old.body;
    new.moderation_status := old.moderation_status;
  end if;
  return new;
end;
$$;
create trigger reviews_guard_response
  before update on public.reviews
  for each row execute function public.guard_review_response();

create policy "disputes visible to parties" on public.disputes for select
  using (raised_by = auth.uid()
         or against_user_id = auth.uid()
         or against_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "disputes raise" on public.disputes for insert
  with check (raised_by = auth.uid());
create policy "disputes admin" on public.disputes for all
  using (public.has_admin_role('support_admin')) with check (public.has_admin_role('support_admin'));

create policy "evidence visible to parties" on public.dispute_evidence for select
  using (submitted_by = auth.uid()
         or exists (select 1 from public.disputes d where d.id = dispute_id
                     and (d.raised_by = auth.uid() or d.against_user_id = auth.uid()))
         or public.is_admin());
create policy "evidence submit" on public.dispute_evidence for insert
  with check (submitted_by = auth.uid());

create policy "dispute_events visible" on public.dispute_events for select
  using (exists (select 1 from public.disputes d where d.id = dispute_id
                  and (d.raised_by = auth.uid() or d.against_user_id = auth.uid()))
         or public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit logs — APPEND ONLY, and readable only by admins
-- ---------------------------------------------------------------------------
create policy "audit admin read" on public.audit_logs for select
  using (public.is_admin());
create policy "audit insert authenticated" on public.audit_logs for insert
  with check (auth.uid() is not null);
-- No UPDATE/DELETE policies exist. Additionally, revoke the privileges outright
-- so that a future permissive policy cannot silently make history editable.
revoke update, delete on public.audit_logs from anon, authenticated;
revoke update, delete on public.lead_events from anon, authenticated;
revoke update, delete on public.visit_checkins from anon, authenticated;
revoke update, delete on public.deal_events from anon, authenticated;
revoke update, delete on public.listing_status_history from anon, authenticated;
revoke update, delete on public.property_price_history from anon, authenticated;
revoke update, delete on public.contact_access_logs from anon, authenticated;

create policy "analytics insert" on public.analytics_events for insert
  with check (true);
create policy "analytics admin read" on public.analytics_events for select
  using (public.is_admin());

create policy "api_keys own" on public.api_keys for select
  using (owner_user_id = auth.uid() or public.is_admin());
create policy "api_keys admin" on public.api_keys for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

-- idempotency_keys is service-role machinery; no client policy is granted.

-- ---------------------------------------------------------------------------
-- Public views — the curated projections the marketing site reads.
-- ---------------------------------------------------------------------------
-- This view is intentionally SECURITY DEFINER (security_invoker = false).
-- `profiles` is locked down to owner-and-admin, so a security-invoker view
-- would return nothing to an anonymous visitor and public agent pages would be
-- empty. Rather than loosening RLS on a table that holds phone numbers and
-- email addresses, we expose one narrow, hand-picked column list here. Every
-- column below is safe to publish; contact details and internal performance
-- metrics are absent by construction.
-- ---------------------------------------------------------------------------
create view public.public_agents
with (security_invoker = false) as
select
  a.id, a.slug, a.agency_name, a.headline, a.bio,
  a.experience_years, a.languages, a.specializations,
  a.service_cities, a.service_localities,
  a.verification_level, a.badges,
  a.rating_average, a.rating_count, a.closed_deal_count, a.joined_at,
  p.full_name, p.display_name, p.avatar_url, p.city
from public.agents a
join public.profiles p on p.id = a.user_id
where a.status = 'ACTIVE';

comment on view public.public_agents is
  'Public agent surface. Deliberately excludes trust_score, response_rate, conversion_rate, risk_score, complaint_count and all contact details (§13).';

grant select on public.public_agents to anon, authenticated;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000012_storage.sql
-- ===========================================================================

-- ===========================================================================
-- 0012 · Storage buckets and object policies
-- ===========================================================================
-- Public buckets hold marketing imagery only. Anything that could identify a
-- person or evidence a title is PRIVATE and served exclusively through
-- short-lived signed URLs minted server-side after an authorisation check.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media',     'property-media',     true,  209715200,
     array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']),
  ('avatars',            'avatars',            true,  5242880,
     array['image/jpeg','image/png','image/webp','image/avif']),
  ('marketing-assets',   'marketing-assets',   true,  52428800,
     array['image/jpeg','image/png','image/webp','image/avif','application/pdf']),
  ('property-documents', 'property-documents', false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('agent-documents',    'agent-documents',    false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('user-documents',     'user-documents',     false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('agreements',         'agreements',         false, 26214400,
     array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Convention: every private object is stored under a path whose FIRST segment
-- is the owning user's uuid — `<user_id>/<entity>/<filename>`. Ownership is
-- therefore verifiable from the path alone.
-- ---------------------------------------------------------------------------

-- Public buckets: anyone may read; only authenticated users may write, and only
-- into their own prefix.
drop policy if exists "public buckets are readable" on storage.objects;
create policy "public buckets are readable"
  on storage.objects for select
  using (bucket_id in ('property-media','avatars','marketing-assets'));

drop policy if exists "authenticated upload to own prefix in public buckets" on storage.objects;
create policy "authenticated upload to own prefix in public buckets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owners update their public objects" on storage.objects;
create policy "owners update their public objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owners delete their public objects" on storage.objects;
create policy "owners delete their public objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private buckets: owner-only read, plus admin. No anonymous access at all.
drop policy if exists "owners read their private objects" on storage.objects;
create policy "owners read their private objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "owners upload their private objects" on storage.objects;
create policy "owners upload their private objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "owners delete their private objects" on storage.objects;
create policy "owners delete their private objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Verification and finance admins need read access to review submitted
-- documents; that access is audited in the application layer.
drop policy if exists "verification admins read documents" on storage.objects;
create policy "verification admins read documents"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and (public.has_admin_role('verification_admin') or public.has_admin_role('finance_admin'))
  );


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000013_platform_defaults.sql
-- ===========================================================================

-- ===========================================================================
-- 0013 · Platform defaults (not demo data)
-- ===========================================================================
-- The default commission policy, the amenity catalogue and the notification
-- templates ship with the product. Demo records live in supabase/seed.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Amenity catalogue
-- ---------------------------------------------------------------------------
insert into public.amenities (key, label, category, icon, sort_order) values
  ('lift',              'Lift',                    'building',  'ArrowUpDown',  10),
  ('power_backup',      'Power Backup',            'building',  'BatteryCharging', 20),
  ('security_24x7',     '24x7 Security',           'safety',    'ShieldCheck',  30),
  ('cctv',              'CCTV Surveillance',       'safety',    'Cctv',         40),
  ('gated_community',   'Gated Community',         'safety',    'Fence',        50),
  ('covered_parking',   'Covered Parking',         'parking',   'CarFront',     60),
  ('visitor_parking',   'Visitor Parking',         'parking',   'Car',          70),
  ('swimming_pool',     'Swimming Pool',           'lifestyle', 'Waves',        80),
  ('gym',               'Gymnasium',               'lifestyle', 'Dumbbell',     90),
  ('clubhouse',         'Clubhouse',               'lifestyle', 'Building2',   100),
  ('park',              'Landscaped Park',         'lifestyle', 'Trees',       110),
  ('kids_play_area',    'Children''s Play Area',    'lifestyle', 'ToyBrick',    120),
  ('jogging_track',     'Jogging Track',           'lifestyle', 'Footprints',  130),
  ('indoor_games',      'Indoor Games',            'lifestyle', 'Gamepad2',    140),
  ('community_hall',    'Community Hall',          'lifestyle', 'Users',       150),
  ('water_24x7',        '24x7 Water Supply',       'utility',   'Droplets',    160),
  ('rain_water',        'Rainwater Harvesting',    'utility',   'CloudRain',   170),
  ('sewage_treatment',  'Sewage Treatment Plant',  'utility',   'Recycle',     180),
  ('waste_management',  'Waste Management',        'utility',   'Trash2',      190),
  ('fire_safety',       'Fire Safety',             'safety',    'Flame',       200),
  ('intercom',          'Intercom',                'building',  'PhoneCall',   210),
  ('maintenance_staff', 'Maintenance Staff',       'building',  'Wrench',      220),
  ('vastu_compliant',   'Vastu Compliant',         'other',     'Compass',     230),
  ('pet_friendly',      'Pet Friendly',            'other',     'PawPrint',    240),
  ('wheelchair_access', 'Wheelchair Accessible',   'other',     'Accessibility', 250),
  ('ev_charging',       'EV Charging',             'utility',   'Plug',        260),
  ('modular_kitchen',   'Modular Kitchen',         'interior',  'CookingPot',  270),
  ('wardrobes',         'Fitted Wardrobes',        'interior',  'DoorClosed',  280),
  ('air_conditioning',  'Air Conditioning',        'interior',  'AirVent',     290),
  ('piped_gas',         'Piped Gas',               'utility',   'Flame',       300)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Default commission policy
-- ---------------------------------------------------------------------------
-- Percentages live HERE, as data. No application file hard-codes a split.
-- The `policy` document is validated by CommissionPolicySchema (Zod) before it
-- is written, and is snapshotted into every calculation that uses it.
-- ---------------------------------------------------------------------------
insert into public.commission_rules (
  code, name, description, version,
  listing_type, pool_mode, pool_percent,
  min_pool_amount, visit_model, policy, priority, is_active
) values (
  'default-sale', 'Default sale commission', 'Platform default for SALE transactions in India.', 1,
  'SALE', 'PERCENT_OF_TRANSACTION', 2.0000,
  25000.00, 'LATEST_WEIGHTED',
  jsonb_build_object(
    'roleShares', jsonb_build_object(
      'LISTING_AGENT', 20,
      'SALES_AGENT',   40,
      'VISIT_POOL',    15,
      'PLATFORM',      25
    ),
    'visitModel', 'LATEST_WEIGHTED',
    'visitTiers', jsonb_build_object(
      'latest',   50,
      'previous', 25,
      'earlier',  25
    ),
    'scoreWeights', jsonb_build_object(
      'recency',              0.35,
      'customerConfirmation', 0.20,
      'duration',             0.15,
      'outcome',              0.15,
      'interest',             0.10,
      'negotiation',          0.05
    ),
    'unallocatedStrategy', 'PLATFORM',
    'targetVisitMinutes', 30,
    'floors', jsonb_build_object(),
    'caps',   jsonb_build_object()
  ),
  100, true
)
on conflict (code, version) do nothing;

insert into public.commission_rules (
  code, name, description, version,
  listing_type, pool_mode, pool_fixed_amount,
  visit_model, policy, priority, is_active
) values (
  'default-rent', 'Default rental commission', 'Platform default for RENT and LEASE transactions.', 1,
  'RENT', 'FIXED_AMOUNT', 0.00,
  'LATEST_WEIGHTED',
  jsonb_build_object(
    'roleShares', jsonb_build_object(
      'LISTING_AGENT', 30,
      'SALES_AGENT',   35,
      'VISIT_POOL',    15,
      'PLATFORM',      20
    ),
    'visitModel', 'LATEST_WEIGHTED',
    'visitTiers', jsonb_build_object('latest', 60, 'previous', 25, 'earlier', 15),
    'scoreWeights', jsonb_build_object(
      'recency', 0.35, 'customerConfirmation', 0.20, 'duration', 0.15,
      'outcome', 0.15, 'interest', 0.10, 'negotiation', 0.05
    ),
    'unallocatedStrategy', 'PLATFORM',
    'targetVisitMinutes', 20,
    'floors', jsonb_build_object(),
    'caps',   jsonb_build_object()
  ),
  100, true
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Notification templates
-- ---------------------------------------------------------------------------
insert into public.notification_templates (key, name, description, channels, subject_template, body_template, variables) values
  ('lead.received', 'New lead received', 'Sent to the agent when a customer enquires.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New enquiry for {{propertyTitle}}',
    'You have a new enquiry for {{propertyTitle}} from a customer in {{city}}. Respond quickly to improve your response rate.',
    array['propertyTitle','city']),
  ('listing.approved', 'Listing approved', 'Sent to the agent when moderation passes.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your listing is live',
    '{{listingTitle}} has been verified and is now live on {{appName}}.',
    array['listingTitle','appName']),
  ('listing.rejected', 'Listing rejected', 'Sent to the agent when moderation fails.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Action needed on your listing',
    '{{listingTitle}} could not be verified. Reason: {{reason}}. You can edit and resubmit it.',
    array['listingTitle','reason']),
  ('visit.booked', 'Visit requested', 'Sent when a customer requests a site visit.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New visit request for {{propertyTitle}}',
    'A customer has requested a {{visitType}} visit on {{visitDate}} at {{visitTime}}.',
    array['propertyTitle','visitType','visitDate','visitTime']),
  ('visit.opportunity', 'Visit opportunity', 'Offered to nearby available agents.',
    array['IN_APP','PUSH']::public.notification_channel[],
    'New property visit opportunity',
    'A visit is available {{distanceKm}} km away on {{visitDate}} at {{visitTime}}. Accept to become the visiting agent.',
    array['distanceKm','visitDate','visitTime']),
  ('visit.accepted', 'Visit accepted', 'Sent to the customer when an agent accepts.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your visit is confirmed',
    '{{agentName}} will show you {{propertyTitle}} on {{visitDate}} at {{visitTime}}.',
    array['agentName','propertyTitle','visitDate','visitTime']),
  ('visit.reminder', 'Visit reminder', 'Sent ahead of a scheduled visit.',
    array['IN_APP','EMAIL','WHATSAPP']::public.notification_channel[],
    'Reminder: property visit tomorrow',
    'Your property visit is scheduled for {{visitDate}} at {{visitTime}} at {{propertyTitle}}.',
    array['visitDate','visitTime','propertyTitle']),
  ('visit.completed', 'Visit completed', 'Requests feedback after a visit.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'How was your visit?',
    'Tell us how your visit to {{propertyTitle}} went. Your feedback confirms the visit and helps other customers.',
    array['propertyTitle']),
  ('deal.updated', 'Deal updated', 'Sent to deal participants on status change.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Deal {{dealCode}} is now {{status}}',
    'Deal {{dealCode}} for {{propertyTitle}} moved to {{status}}.',
    array['dealCode','status','propertyTitle']),
  ('commission.generated', 'Commission calculated', 'Sent when a payout is computed.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Commission calculated for {{dealCode}}',
    'Your commission of {{amount}} for deal {{dealCode}} has been calculated. Open the deal to see the full breakdown.',
    array['amount','dealCode']),
  ('commission.approved', 'Commission approved', 'Sent when finance approves a payout.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Commission approved',
    'Your commission of {{amount}} for deal {{dealCode}} has been approved for payout.',
    array['amount','dealCode']),
  ('payment.completed', 'Payment completed', 'Sent when settlement succeeds.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Payment sent',
    '{{amount}} has been paid against deal {{dealCode}}. Reference: {{reference}}.',
    array['amount','dealCode','reference']),
  ('share.requested', 'Inventory access requested', 'Sent to the listing owner.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    '{{agentName}} requested access to your listing',
    '{{agentName}} would like to share {{listingTitle}} with a customer. Approve or decline the request.',
    array['agentName','listingTitle']),
  ('share.approved', 'Inventory access approved', 'Sent to the requesting agent.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Access approved',
    'You now have access to {{listingTitle}}. You can share it with your customers and request visits.',
    array['listingTitle']),
  ('requirement.match', 'New matching properties', 'Sent to the customer.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    '{{count}} new properties match your requirement',
    'We found {{count}} properties matching "{{requirementTitle}}".',
    array['count','requirementTitle']),
  ('agent.verified', 'Verification approved', 'Sent when an agent passes verification.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'You are verified',
    'Your {{level}} verification is approved. The badge now appears on your public profile.',
    array['level']),
  ('dispute.updated', 'Dispute updated', 'Sent to dispute parties.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Dispute {{disputeCode}} updated',
    'Dispute {{disputeCode}} is now {{status}}.',
    array['disputeCode','status']),
  ('investor.opportunity', 'New investor opportunity', 'Sent to eligible investors.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New exclusive inventory opportunity',
    '{{opportunityTitle}} is now open. Indicative economics only; subject to a separate written agreement.',
    array['opportunityTitle']),
  ('exclusive.expiring', 'Exclusive inventory expiring', 'Sent before an exclusivity window closes.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Exclusive rights expiring soon',
    'Exclusive rights for {{propertyTitle}} expire on {{endsOn}}.',
    array['propertyTitle','endsOn'])
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Operational settings
-- ---------------------------------------------------------------------------
insert into public.admin_settings (key, value, category, label, description, is_public) values
  ('visit.geofence_radius_meters', '200'::jsonb, 'visits', 'Visit geofence radius (m)',
     'Maximum distance from the property at which a physical check-in counts.', false),
  ('visit.min_duration_minutes', '10'::jsonb, 'visits', 'Minimum meaningful visit duration',
     'A visit shorter than this cannot be qualified for commission.', false),
  ('visit.offer_expiry_minutes', '30'::jsonb, 'visits', 'Visit offer expiry',
     'How long a visiting-agent offer stays open before rolling to the next agent.', false),
  ('visit.max_offer_rounds', '5'::jsonb, 'visits', 'Maximum offer rounds', 'How many agents are offered a visit before escalation.', false),
  ('leads.contact_reveal_daily_limit', '25'::jsonb, 'privacy', 'Contact reveals per agent per day',
     'Rate limit on unmasking customer contact details.', false),
  ('listings.expiry_days', '90'::jsonb, 'listings', 'Listing expiry (days)', 'Days before a verified listing expires and must be refreshed.', false),
  ('listings.reverification_days', '30'::jsonb, 'listings', 'Re-verification interval (days)', 'How often a live listing must be re-confirmed by its agent.', false),
  ('duplicates.auto_flag_threshold', '75'::jsonb, 'moderation', 'Duplicate flag threshold',
     'Confidence at or above which a listing is queued for duplicate review. Never auto-merged.', false),
  ('platform.support_email', '"support@getmespace.in"'::jsonb, 'general', 'Support email', 'Shown in the footer and on error pages.', true),
  ('platform.grievance_officer', '{"name":"","email":"","phone":""}'::jsonb, 'legal', 'Grievance officer',
     'Required under the Consumer Protection (E-Commerce) Rules 2020 and IT Rules 2021. Must be completed before launch.', true)
on conflict (key) do nothing;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000014_social_profiles.sql
-- ===========================================================================

-- ===========================================================================
-- 0014 · Agent social profiles
-- ===========================================================================
-- Agents asked to link the accounts they already publish inventory on, so a
-- customer can see their work before enquiring.
--
-- These are SELF-DECLARED and the UI must say so. Verification badges are
-- granted by the platform after review and can never be self-claimed (§13);
-- a link an agent typed in is evidence a customer can weigh for themselves,
-- not a claim this platform is making on their behalf. The columns live apart
-- from `badges` and `verification_level` for that reason.
--
-- Each column takes a full URL rather than a handle: a handle has to be
-- rebuilt into a URL somewhere, and every place that does it is a chance to
-- build the wrong one.
-- ===========================================================================

alter table public.agents
  add column if not exists website_url   text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url   text,
  add column if not exists linkedin_url  text,
  add column if not exists facebook_url  text;

-- A cheap structural guard. The application validates that each URL is on the
-- host it claims to be — an "Instagram" link that points somewhere else is a
-- way to launder an arbitrary link through a trusted-looking label — but the
-- database still refuses anything that is not plainly an https URL.
alter table public.agents
  drop constraint if exists agents_social_urls_https;

-- The length bound is a separate test rather than a repetition count: Postgres
-- caps regex repetition at 255, so `{3,300}` is rejected as invalid.
alter table public.agents
  add constraint agents_social_urls_https check (
    (website_url   is null or (website_url   ~ '^https://[^\s]+$' and length(website_url)   between 12 and 300)) and
    (instagram_url is null or (instagram_url ~ '^https://[^\s]+$' and length(instagram_url) between 12 and 300)) and
    (youtube_url   is null or (youtube_url   ~ '^https://[^\s]+$' and length(youtube_url)   between 12 and 300)) and
    (linkedin_url  is null or (linkedin_url  ~ '^https://[^\s]+$' and length(linkedin_url)  between 12 and 300)) and
    (facebook_url  is null or (facebook_url  ~ '^https://[^\s]+$' and length(facebook_url)  between 12 and 300))
  );

comment on column public.agents.instagram_url is
  'Self-declared profile link. NOT a verification signal — see the badges column.';

-- ---------------------------------------------------------------------------
-- The public surface has to expose them, or the profile page cannot read them.
-- ---------------------------------------------------------------------------
drop view if exists public.public_agents;

create view public.public_agents
with (security_invoker = false) as
select
  a.id, a.slug, a.agency_name, a.headline, a.bio,
  a.experience_years, a.languages, a.specializations,
  a.service_cities, a.service_localities,
  a.verification_level, a.badges,
  a.rating_average, a.rating_count, a.closed_deal_count, a.joined_at,
  a.website_url, a.instagram_url, a.youtube_url, a.linkedin_url, a.facebook_url,
  p.full_name, p.display_name, p.avatar_url, p.city
from public.agents a
join public.profiles p on p.id = a.user_id
where a.status = 'ACTIVE';

comment on view public.public_agents is
  'Public agent surface. Deliberately excludes trust_score, response_rate, conversion_rate, risk_score, complaint_count and all contact details (§13). Social links here are self-declared, not verified.';

grant select on public.public_agents to anon, authenticated;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000015_admin_notifications.sql
-- ===========================================================================

-- ===========================================================================
-- 0015 · Notification templates for administrative actions
-- ===========================================================================
-- Three things an administrator can now do that the person on the other end
-- must hear about:
--
--   * an admin corrected a field on their listing,
--   * their agent account was suspended,
--   * their agent account was reinstated.
--
-- Someone else changing your listing, or stopping your account, without a word
-- is how a marketplace loses the people who supply it. Suspension in
-- particular carries the REASON in the message: an agent who cannot find out
-- why has nothing to act on and nothing to appeal.
-- ===========================================================================

insert into public.notification_templates
  (key, name, description, channels, subject_template, body_template, variables)
values
  ('listing.updated', 'Listing edited by the platform',
    'Sent to the agent when an administrator corrects a field on their listing.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'A change was made to your listing',
    'An administrator updated {{listingTitle}}. Reason: {{reason}}. Open your listing to review the change — if it looks wrong, reply and we will put it back.',
    array['listingTitle','reason']),

  ('agent.suspended', 'Agent account suspended',
    'Sent to the agent when their account is suspended.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your account has been suspended',
    'Your agent account on {{appName}} has been suspended. Reason: {{reason}}. Your existing listings are unaffected while this is reviewed. Reply to this message to appeal.',
    array['reason','appName']),

  ('agent.reinstated', 'Agent account reinstated',
    'Sent to the agent when a suspension is lifted.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your account is active again',
    'Your agent account on {{appName}} has been reinstated. Note: {{reason}}. You are back in the directory and can list again.',
    array['reason','appName'])
on conflict (key) do nothing;


-- ===========================================================================
-- SOURCE: supabase/migrations/20250101000016_nri_and_valuation.sql
-- ===========================================================================

-- ===========================================================================
-- NRI mode and the indicative valuation
-- ===========================================================================
-- Adds what a non-resident buyer needs, and nothing that pretends to more:
--
--   1. A customer can say they are buying from abroad, in which timezone they
--      live, and which currency they think in.
--   2. Exchange rates, set by an administrator and stamped with the date they
--      were set. NO RATES ARE SEEDED. A conversion appears only once somebody
--      has entered a real rate — an invented one shown to a buyer is worse
--      than no conversion, because it looks exactly like a real one.
--
-- Remote and live-video visits needed nothing here: `visit_type` has carried
-- PHYSICAL / VIRTUAL / LIVE_VIDEO since the first migration.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1 · Customer preferences
-- ---------------------------------------------------------------------------
alter table public.customers
  add column if not exists is_nri boolean not null default false,
  -- IANA zone. Site visits happen at the property and are therefore scheduled
  -- in the PROPERTY's zone; this is used to show the buyer the same instant on
  -- their own clock, which is the part that gets misread.
  add column if not exists preferred_timezone text not null default 'Asia/Kolkata',
  -- Display only. Every transaction on this platform is in rupees.
  add column if not exists display_currency public.currency_code not null default 'INR';

comment on column public.customers.preferred_timezone is
  'IANA zone for DISPLAYING visit times. Visits are scheduled in the property''s zone.';
comment on column public.customers.display_currency is
  'Second currency shown alongside the rupee price. Display only; never a settlement currency.';

-- The zone is validated in the APPLICATION, not here. A CHECK cannot hold a
-- subquery, and `pg_timezone_names` is not the same list as the browser's
-- `Intl.supportedValuesOf("timeZone")` — a database check could reject a zone
-- the renderer accepts, or pass one it does not. The list that matters is the
-- one that formats the date, so that is the list to validate against. See
-- src/lib/domain/timezones.ts.

-- ---------------------------------------------------------------------------
-- 2 · Exchange rates
-- ---------------------------------------------------------------------------
create table if not exists public.exchange_rates (
  id              uuid primary key default gen_random_uuid(),
  base_currency   public.currency_code not null,
  quote_currency  public.currency_code not null,
  -- Units of quote per one unit of base. Wide enough for INR->USD (0.0120)
  -- and USD->INR (83.15) without losing a digit either way.
  rate            numeric(18,8) not null check (rate > 0),
  -- The date the rate is FOR, which is the whole point of the row: a figure
  -- shown without its age invites reliance it cannot bear.
  as_of           date not null,
  source          text,
  updated_by      uuid references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint exchange_rates_distinct_pair check (base_currency <> quote_currency),
  constraint exchange_rates_unique_pair unique (base_currency, quote_currency)
);

comment on table public.exchange_rates is
  'Indicative rates for DISPLAY only, set by an administrator. Not a quote, not a feed, and never a settlement rate.';

create index if not exists exchange_rates_pair_idx
  on public.exchange_rates (base_currency, quote_currency);

-- FORCED, not merely enabled. Every other table in `public` is forced, and
-- supabase/tests/security.test.sql asserts it: without it the table's owner
-- bypasses its own policies, which is exactly the footgun that assertion
-- exists to catch.
alter table public.exchange_rates enable row level security;
alter table public.exchange_rates force row level security;

-- Readable by everyone: the converted figure appears on a public property page,
-- and the rate behind it should be as inspectable as the price.
drop policy if exists "exchange_rates readable" on public.exchange_rates;
create policy "exchange_rates readable" on public.exchange_rates for select
  using (true);

-- Written only by a finance admin, the same role that owns commission rules.
drop policy if exists "exchange_rates finance admin" on public.exchange_rates;
create policy "exchange_rates finance admin" on public.exchange_rates for all
  using (public.has_admin_role('finance_admin'))
  with check (public.has_admin_role('finance_admin'));

drop trigger if exists exchange_rates_touch on public.exchange_rates;
create trigger exchange_rates_touch
  before update on public.exchange_rates
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 3 · Flags
-- ---------------------------------------------------------------------------
-- Both modules now have code behind them, so the descriptions stop saying
-- "Phase 3". Neither is switched on here: the environment remains the ceiling.
update public.feature_flags
   set description = 'Second-currency prices, visit times in the buyer''s timezone, and NRI paperwork guidance.'
 where key = 'ENABLE_NRI_MODE';

update public.feature_flags
   set description = 'Indicative price range from verified comparables in the same locality. Never a valuation.'
 where key = 'ENABLE_PROPERTY_VALUATION';

