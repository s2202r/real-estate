-- ===========================================================================
-- 0014 · Agent social profiles
-- ===========================================================================
-- Agents asked to link the accounts they already publish inventory on, so a
-- customer can see their work before enquiring.
--
-- These are SELF-DECLARED and the UI must say so. Verification badges are
-- granted by the platform after review and can never be self-claimed (§13);
-- a link an agent typed in is evidence a customer can weigh for themselves,
-- not a claim this platform is making on their behalf. The columns live apart
-- from `badges` and `verification_level` for that reason.
--
-- Each column takes a full URL rather than a handle: a handle has to be
-- rebuilt into a URL somewhere, and every place that does it is a chance to
-- build the wrong one.
-- ===========================================================================

alter table public.agents
  add column if not exists website_url   text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url   text,
  add column if not exists linkedin_url  text,
  add column if not exists facebook_url  text;

-- A cheap structural guard. The application validates that each URL is on the
-- host it claims to be — an "Instagram" link that points somewhere else is a
-- way to launder an arbitrary link through a trusted-looking label — but the
-- database still refuses anything that is not plainly an https URL.
alter table public.agents
  drop constraint if exists agents_social_urls_https;

-- The length bound is a separate test rather than a repetition count: Postgres
-- caps regex repetition at 255, so `{3,300}` is rejected as invalid.
alter table public.agents
  add constraint agents_social_urls_https check (
    (website_url   is null or (website_url   ~ '^https://[^\s]+$' and length(website_url)   between 12 and 300)) and
    (instagram_url is null or (instagram_url ~ '^https://[^\s]+$' and length(instagram_url) between 12 and 300)) and
    (youtube_url   is null or (youtube_url   ~ '^https://[^\s]+$' and length(youtube_url)   between 12 and 300)) and
    (linkedin_url  is null or (linkedin_url  ~ '^https://[^\s]+$' and length(linkedin_url)  between 12 and 300)) and
    (facebook_url  is null or (facebook_url  ~ '^https://[^\s]+$' and length(facebook_url)  between 12 and 300))
  );

comment on column public.agents.instagram_url is
  'Self-declared profile link. NOT a verification signal — see the badges column.';

-- ---------------------------------------------------------------------------
-- The public surface has to expose them, or the profile page cannot read them.
-- ---------------------------------------------------------------------------
drop view if exists public.public_agents;

create view public.public_agents
with (security_invoker = false) as
select
  a.id, a.slug, a.agency_name, a.headline, a.bio,
  a.experience_years, a.languages, a.specializations,
  a.service_cities, a.service_localities,
  a.verification_level, a.badges,
  a.rating_average, a.rating_count, a.closed_deal_count, a.joined_at,
  a.website_url, a.instagram_url, a.youtube_url, a.linkedin_url, a.facebook_url,
  p.full_name, p.display_name, p.avatar_url, p.city
from public.agents a
join public.profiles p on p.id = a.user_id
where a.status = 'ACTIVE';

comment on view public.public_agents is
  'Public agent surface. Deliberately excludes trust_score, response_rate, conversion_rate, risk_score, complaint_count and all contact details (§13). Social links here are self-declared, not verified.';

grant select on public.public_agents to anon, authenticated;
