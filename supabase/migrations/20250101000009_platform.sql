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
