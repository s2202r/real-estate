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
