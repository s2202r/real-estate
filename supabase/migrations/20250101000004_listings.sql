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
