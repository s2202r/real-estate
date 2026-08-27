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
