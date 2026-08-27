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
