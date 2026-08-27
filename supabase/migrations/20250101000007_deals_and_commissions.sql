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
