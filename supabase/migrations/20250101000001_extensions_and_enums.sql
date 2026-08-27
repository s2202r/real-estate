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
