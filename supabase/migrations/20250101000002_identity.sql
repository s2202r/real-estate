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

