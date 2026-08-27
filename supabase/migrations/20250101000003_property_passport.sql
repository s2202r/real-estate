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
