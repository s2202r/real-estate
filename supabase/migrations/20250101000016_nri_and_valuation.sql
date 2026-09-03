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
