-- ===========================================================================
-- 0011 · Row Level Security
-- ===========================================================================
-- RLS is THE authorisation boundary. Application checks are defence in depth;
-- if they were all removed, these policies would still hold the line.
--
-- Guiding rules:
--   * Deny by default. RLS is enabled on every table in `public`.
--   * Customers see only their own data.
--   * Agents see their own inventory, their own CRM, inventory explicitly
--     shared with them, visits assigned to them, and their own money.
--   * Investors see only their own positions.
--   * Admins see everything, scoped by admin sub-role where it matters.
--   * The public sees VERIFIED listings and nothing else.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','roles','user_roles','agents','agent_verifications','agent_documents',
    'agent_rera_records','customers','investors','investor_verifications',
    'regions','reference_counters','projects','property_passports','property_addresses',
    'property_media','property_documents','amenities','property_amenities',
    'property_nearby_places','property_verifications','property_price_history',
    'property_duplicate_candidates','listings','listing_media','listing_status_history',
    'listing_shares','listing_referrals','favorites','saved_searches',
    'customer_requirements','requirement_matches','leads','lead_events',
    'contact_access_logs','crm_contacts','crm_tasks','crm_notes',
    'visits','visit_assignments','visit_checkins','visit_feedback','visit_attributions',
    'deals','deal_participants','deal_events','deal_documents',
    'commission_rules','commission_calculations','commission_distributions',
    'commission_ledger','payments',
    'investor_opportunities','investor_interests','agreements','exclusive_inventory',
    'investor_positions',
    'notification_templates','notifications','notification_preferences',
    'reviews','disputes','dispute_evidence','dispute_events',
    'audit_logs','analytics_events','admin_settings','feature_flags',
    'api_keys','idempotency_keys'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Reference data — world readable, admin writable
-- ---------------------------------------------------------------------------
create policy "roles readable" on public.roles for select using (true);
create policy "regions readable" on public.regions for select using (true);
create policy "amenities readable" on public.amenities for select using (true);
create policy "regions admin write" on public.regions for all
  using (public.is_admin()) with check (public.is_admin());
create policy "amenities admin write" on public.amenities for all
  using (public.is_admin()) with check (public.is_admin());

-- Feature flags are readable so the UI can render consistently; only admins write.
create policy "flags readable" on public.feature_flags for select using (true);
create policy "flags admin write" on public.feature_flags for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

create policy "public settings readable" on public.admin_settings for select
  using (is_public or public.is_admin());
create policy "settings admin write" on public.admin_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- reference_counters is machinery: nobody reads or writes it directly. The
-- SECURITY DEFINER function next_reference() is the only access path.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy "profiles select own" on public.profiles for select
  using (id = auth.uid() or public.is_admin());
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles admin manage" on public.profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- Roles: readable by the owner and admins; only admins may grant or revoke.
create policy "user_roles select own" on public.user_roles for select
  using (user_id = auth.uid() or public.is_admin());
create policy "user_roles admin manage" on public.user_roles for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

-- ---------------------------------------------------------------------------
-- Guard-trigger context helper
-- ---------------------------------------------------------------------------
-- The guard triggers below stop an END USER from writing columns that the
-- platform owns (badges, moderation decisions, visit qualification). They must
-- NOT block the platform itself: the service-role client, migrations, seeds and
-- background jobs legitimately write exactly those columns after running the
-- domain rules.
--
-- Those contexts have no end-user JWT, so `auth.uid()` is null. That is a safe
-- discriminator: an anonymous browser request also has a null uid, but RLS
-- gives `anon` no UPDATE path to any of these tables in the first place, so it
-- can never reach a guard trigger.
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_context()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is null;
$$;

-- ---------------------------------------------------------------------------
-- agents — professional profiles are public; performance internals are not.
-- (The public surface is the `public_agents` view defined at the end.)
-- ---------------------------------------------------------------------------
create policy "agents readable" on public.agents for select
  using (status = 'ACTIVE' or user_id = auth.uid() or public.is_admin());

-- An agent may edit their own profile, but NEVER their own badges, trust score
-- or verification level. Those columns are admin-only; a column-level guard is
-- added below via a BEFORE UPDATE trigger since RLS is row-level.
create policy "agents update own" on public.agents for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "agents admin manage" on public.agents for all
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_agent_self_promotion()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then
    return new;
  end if;
  -- Verification standing is granted by the platform, never self-claimed (§10).
  new.verification_level    := old.verification_level;
  new.badges                := old.badges;
  new.trust_score           := old.trust_score;
  new.rating_average        := old.rating_average;
  new.rating_count          := old.rating_count;
  new.response_rate         := old.response_rate;
  new.visit_completion_rate := old.visit_completion_rate;
  new.cancellation_rate     := old.cancellation_rate;
  new.conversion_rate       := old.conversion_rate;
  new.closed_deal_count     := old.closed_deal_count;
  new.complaint_count       := old.complaint_count;
  new.risk_score            := old.risk_score;
  new.status                := old.status;
  return new;
end;
$$;
create trigger agents_guard_self_promotion
  before update on public.agents
  for each row execute function public.guard_agent_self_promotion();

-- Verification submissions: agent reads/creates own, admin reviews.
create policy "agent_verifications own" on public.agent_verifications for select
  using (agent_id = public.current_agent_id() or public.has_admin_role('verification_admin'));
create policy "agent_verifications insert own" on public.agent_verifications for insert
  with check (agent_id = public.current_agent_id());
create policy "agent_verifications update own pending" on public.agent_verifications for update
  using (agent_id = public.current_agent_id() and status in ('SUBMITTED','REJECTED'))
  with check (agent_id = public.current_agent_id());
create policy "agent_verifications admin" on public.agent_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

create policy "agent_documents own" on public.agent_documents for select
  using (agent_id = public.current_agent_id() or public.has_admin_role('verification_admin'));
create policy "agent_documents insert own" on public.agent_documents for insert
  with check (agent_id = public.current_agent_id());
create policy "agent_documents delete own pending" on public.agent_documents for delete
  using (agent_id = public.current_agent_id() and status = 'SUBMITTED');
create policy "agent_documents admin" on public.agent_documents for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- RERA records are publicly checkable once approved: that is the point of them.
create policy "rera readable" on public.agent_rera_records for select
  using (status = 'APPROVED' or agent_id = public.current_agent_id() or public.is_admin());
create policy "rera insert own" on public.agent_rera_records for insert
  with check (agent_id = public.current_agent_id());
create policy "rera admin" on public.agent_rera_records for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- ---------------------------------------------------------------------------
-- customers — the strictest table in the schema (§47)
-- ---------------------------------------------------------------------------
-- Agents deliberately have NO direct select on customers. They reach customer
-- data only through leads they own, and contact details only after an audited
-- unlock. There is no policy here that grants the agent network bulk access.
-- ---------------------------------------------------------------------------
create policy "customers select own" on public.customers for select
  using (user_id = auth.uid() or public.is_admin());
create policy "customers insert own" on public.customers for insert
  with check (user_id = auth.uid());
create policy "customers update own" on public.customers for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "customers admin" on public.customers for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- investors
-- ---------------------------------------------------------------------------
create policy "investors select own" on public.investors for select
  using (user_id = auth.uid() or public.is_admin());
create policy "investors insert own" on public.investors for insert
  with check (user_id = auth.uid());
create policy "investors update own" on public.investors for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "investors admin" on public.investors for all
  using (public.is_admin()) with check (public.is_admin());

create policy "investor_verifications own" on public.investor_verifications for select
  using (investor_id = public.current_investor_id() or public.has_admin_role('verification_admin'));
create policy "investor_verifications insert own" on public.investor_verifications for insert
  with check (investor_id = public.current_investor_id());
create policy "investor_verifications admin" on public.investor_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

-- ---------------------------------------------------------------------------
-- Property passport
-- ---------------------------------------------------------------------------
-- A passport is publicly visible only when it carries at least one VERIFIED
-- listing. Drafts and rejected inventory stay private to their creator.
-- ---------------------------------------------------------------------------
create policy "projects readable" on public.projects for select using (true);
create policy "projects agent create" on public.projects for insert
  with check (public.has_role('agent') or public.is_admin());
create policy "projects admin manage" on public.projects for all
  using (public.is_admin()) with check (public.is_admin());

create policy "passports public read" on public.property_passports for select
  using (
    exists (select 1 from public.listings l
             where l.property_id = property_passports.id and l.status = 'VERIFIED')
    or created_by = auth.uid()
    or exists (select 1 from public.listings l
                where l.property_id = property_passports.id
                  and l.agent_id = public.current_agent_id())
    or public.is_admin()
  );
create policy "passports agent create" on public.property_passports for insert
  with check ((public.has_role('agent') and created_by = auth.uid()) or public.is_admin());
create policy "passports agent update own" on public.property_passports for update
  using (
    public.is_admin()
    or (created_by = auth.uid() and status in ('DRAFT','PENDING_VERIFICATION'))
    or exists (select 1 from public.listings l
                where l.property_id = property_passports.id
                  and l.agent_id = public.current_agent_id())
  )
  with check (public.is_admin() or created_by = auth.uid()
              or exists (select 1 from public.listings l
                          where l.property_id = property_passports.id
                            and l.agent_id = public.current_agent_id()));
create policy "passports admin" on public.property_passports for all
  using (public.is_admin()) with check (public.is_admin());

-- Passport child tables inherit the passport's visibility.
create or replace function public.can_read_property(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.property_passports p where p.id = target)
     and (
       exists (select 1 from public.listings l where l.property_id = target and l.status = 'VERIFIED')
       or exists (select 1 from public.property_passports p where p.id = target and p.created_by = auth.uid())
       or exists (select 1 from public.listings l where l.property_id = target and l.agent_id = public.current_agent_id())
       or public.is_admin()
     );
$$;

create or replace function public.can_write_property(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_admin()
      or exists (select 1 from public.property_passports p
                  where p.id = target and p.created_by = auth.uid())
      or exists (select 1 from public.listings l
                  where l.property_id = target and l.agent_id = public.current_agent_id());
$$;

create policy "addresses read" on public.property_addresses for select
  using (public.can_read_property(property_id));
create policy "addresses write" on public.property_addresses for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "property_media read" on public.property_media for select
  using (public.can_read_property(property_id));
create policy "property_media write" on public.property_media for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "property_amenities read" on public.property_amenities for select
  using (public.can_read_property(property_id));
create policy "property_amenities write" on public.property_amenities for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "nearby read" on public.property_nearby_places for select
  using (public.can_read_property(property_id));
create policy "nearby write" on public.property_nearby_places for all
  using (public.can_write_property(property_id)) with check (public.can_write_property(property_id));

create policy "price_history read" on public.property_price_history for select
  using (public.can_read_property(property_id));
create policy "price_history admin" on public.property_price_history for all
  using (public.is_admin()) with check (public.is_admin());

-- Property DOCUMENTS never follow the public read path. Title documents are
-- visible to the uploading agent, agents with granted access, and admins.
create policy "property_documents restricted read" on public.property_documents for select
  using (
    uploaded_by = auth.uid()
    or public.is_admin()
    or (visibility = 'AGENTS_WITH_ACCESS' and exists (
          select 1 from public.listings l
           where l.property_id = property_documents.property_id
             and public.agent_has_listing_access(l.id)))
  );
create policy "property_documents write" on public.property_documents for insert
  with check (public.can_write_property(property_id) and uploaded_by = auth.uid());
create policy "property_documents admin" on public.property_documents for all
  using (public.is_admin()) with check (public.is_admin());

create policy "property_verifications read" on public.property_verifications for select
  using (public.can_read_property(property_id) or public.is_admin());
create policy "property_verifications admin write" on public.property_verifications for all
  using (public.has_admin_role('verification_admin')) with check (public.has_admin_role('verification_admin'));

create policy "duplicates admin only" on public.property_duplicate_candidates for all
  using (public.has_admin_role('operations_admin')) with check (public.has_admin_role('operations_admin'));

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
-- The single most important read policy on the platform: the public sees
-- VERIFIED listings only. Draft, rejected and suspended inventory is invisible.
-- ---------------------------------------------------------------------------
create policy "listings public read verified" on public.listings for select
  using (
    status = 'VERIFIED'
    or agent_id = public.current_agent_id()
    or public.agent_has_listing_access(id)
    or public.is_admin()
  );
create policy "listings agent insert" on public.listings for insert
  with check (agent_id = public.current_agent_id());
-- An agent may edit their own listing, but not one that is locked in review.
create policy "listings agent update own" on public.listings for update
  using (agent_id = public.current_agent_id() and status <> 'UNDER_REVIEW')
  with check (agent_id = public.current_agent_id());
create policy "listings agent delete draft" on public.listings for delete
  using (agent_id = public.current_agent_id() and status = 'DRAFT');
create policy "listings admin" on public.listings for all
  using (public.is_admin()) with check (public.is_admin());

-- An agent must not self-approve. Moderation columns are admin-only.
create or replace function public.guard_listing_self_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then
    return new;
  end if;
  -- Agents may move DRAFT/REJECTED -> SUBMITTED, or archive their own listing.
  -- Everything else on the moderation path belongs to admins.
  if new.status is distinct from old.status
     and not (
       (old.status in ('DRAFT','REJECTED','EXPIRED') and new.status = 'SUBMITTED')
       or (old.status = 'DRAFT'    and new.status = 'DRAFT')
       or (old.status = 'VERIFIED' and new.status in ('SOLD','RENTED','EXPIRED'))
       or (old.status = 'SUBMITTED' and new.status = 'DRAFT')
     )
  then
    raise exception 'listings: agents cannot move a listing from % to %', old.status, new.status
      using errcode = 'insufficient_privilege';
  end if;

  new.reviewed_by         := old.reviewed_by;
  new.reviewed_at         := old.reviewed_at;
  new.verification_notes  := old.verification_notes;
  new.verification_score  := old.verification_score;
  new.next_verification_at := old.next_verification_at;
  new.is_exclusive        := old.is_exclusive;
  new.exclusive_until     := old.exclusive_until;
  return new;
end;
$$;
create trigger listings_guard_self_approval
  before update on public.listings
  for each row execute function public.guard_listing_self_approval();

create policy "listing_media read" on public.listing_media for select
  using (exists (select 1 from public.listings l where l.id = listing_id
                  and (l.status = 'VERIFIED' or l.agent_id = public.current_agent_id()
                       or public.agent_has_listing_access(l.id) or public.is_admin())));
create policy "listing_media write" on public.listing_media for all
  using (exists (select 1 from public.listings l where l.id = listing_id and l.agent_id = public.current_agent_id())
         or public.is_admin())
  with check (exists (select 1 from public.listings l where l.id = listing_id and l.agent_id = public.current_agent_id())
              or public.is_admin());

create policy "listing_history read" on public.listing_status_history for select
  using (exists (select 1 from public.listings l where l.id = listing_id
                  and (l.agent_id = public.current_agent_id() or public.is_admin())));
-- History is written by triggers only; no client INSERT policy exists.

-- Inventory sharing: both sides of the request can see it.
create policy "shares visible to parties" on public.listing_shares for select
  using (owner_agent_id = public.current_agent_id()
         or requester_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "shares requester creates" on public.listing_shares for insert
  with check (requester_agent_id = public.current_agent_id());
-- Only the OWNER may approve or reject; the requester may withdraw.
create policy "shares owner responds" on public.listing_shares for update
  using (owner_agent_id = public.current_agent_id() or requester_agent_id = public.current_agent_id())
  with check (owner_agent_id = public.current_agent_id() or requester_agent_id = public.current_agent_id());

create or replace function public.guard_share_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  -- The requesting agent must never be able to approve their own request.
  if new.status is distinct from old.status
     and new.status in ('APPROVED','REJECTED')
     and old.owner_agent_id <> public.current_agent_id() then
    raise exception 'listing_shares: only the owning agent may approve or reject a share request'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger shares_guard_response
  before update on public.listing_shares
  for each row execute function public.guard_share_response();

create policy "referrals visible to parties" on public.listing_referrals for select
  using (referring_agent_id = public.current_agent_id()
         or receiving_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "referrals agent create" on public.listing_referrals for insert
  with check (referring_agent_id = public.current_agent_id());

-- ---------------------------------------------------------------------------
-- Customer-owned collections
-- ---------------------------------------------------------------------------
create policy "favorites own" on public.favorites for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id());

create policy "saved_searches own" on public.saved_searches for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id());

-- ---------------------------------------------------------------------------
-- Requirements (demand marketplace)
-- ---------------------------------------------------------------------------
-- Agents may discover ACTIVE, discoverable requirements — but the customer's
-- identity and contact details live in `customers`/`profiles`, which agents
-- cannot read. Discovery exposes the requirement, never the person.
-- ---------------------------------------------------------------------------
create policy "requirements owner" on public.customer_requirements for all
  using (customer_id = public.current_customer_id() or public.is_admin())
  with check (customer_id = public.current_customer_id() or public.is_admin());
create policy "requirements agent discovery" on public.customer_requirements for select
  using (
    status = 'ACTIVE' and is_discoverable and public.has_role('agent')
    and exists (select 1 from public.customers c
                 where c.id = customer_requirements.customer_id
                   and c.allow_requirement_discovery)
  );

create policy "matches visible" on public.requirement_matches for select
  using (
    exists (select 1 from public.customer_requirements r
             where r.id = requirement_id and r.customer_id = public.current_customer_id())
    or exists (select 1 from public.listings l
                where l.id = listing_id and l.agent_id = public.current_agent_id())
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Leads — the attribution core
-- ---------------------------------------------------------------------------
create policy "leads visible to parties" on public.leads for select
  using (
    customer_id = public.current_customer_id()
    or sales_agent_id = public.current_agent_id()
    or listing_agent_id = public.current_agent_id()
    or referral_agent_id = public.current_agent_id()
    or public.is_admin()
  );
create policy "leads customer create" on public.leads for insert
  with check (customer_id = public.current_customer_id() or public.has_role('agent') or public.is_admin());
create policy "leads agent update" on public.leads for update
  using (sales_agent_id = public.current_agent_id()
         or listing_agent_id = public.current_agent_id()
         or public.is_admin())
  with check (sales_agent_id = public.current_agent_id()
              or listing_agent_id = public.current_agent_id()
              or public.is_admin());

create policy "lead_events visible to parties" on public.lead_events for select
  using (exists (select 1 from public.leads l where l.id = lead_id
                  and (l.customer_id = public.current_customer_id()
                       or l.sales_agent_id = public.current_agent_id()
                       or l.listing_agent_id = public.current_agent_id()
                       or public.is_admin())));
create policy "lead_events insert by parties" on public.lead_events for insert
  with check (exists (select 1 from public.leads l where l.id = lead_id
                       and (l.sales_agent_id = public.current_agent_id()
                            or l.listing_agent_id = public.current_agent_id()
                            or l.customer_id = public.current_customer_id()
                            or public.is_admin())));
-- No UPDATE or DELETE policy: lead_events is append-only.

-- A customer can audit exactly who accessed their contact details.
create policy "contact_access customer visibility" on public.contact_access_logs for select
  using (customer_id = public.current_customer_id()
         or accessed_by = auth.uid()
         or public.is_admin());
-- Writes happen through the service layer (service role) only.

-- ---------------------------------------------------------------------------
-- CRM — strictly private to the owning agent
-- ---------------------------------------------------------------------------
create policy "crm_contacts own" on public.crm_contacts for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());
create policy "crm_tasks own" on public.crm_tasks for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());
create policy "crm_notes own" on public.crm_notes for all
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id());

-- ---------------------------------------------------------------------------
-- Visits
-- ---------------------------------------------------------------------------
create policy "visits visible to parties" on public.visits for select
  using (
    customer_id = public.current_customer_id()
    or assigned_agent_id = public.current_agent_id()
    or listing_agent_id = public.current_agent_id()
    or preferred_agent_id = public.current_agent_id()
    -- An agent offered the job may see it while the offer stands.
    or exists (select 1 from public.visit_assignments va
                where va.visit_id = visits.id
                  and va.agent_id = public.current_agent_id())
    or public.is_admin()
  );
create policy "visits customer create" on public.visits for insert
  with check (customer_id = public.current_customer_id() or public.has_role('agent') or public.is_admin());
create policy "visits parties update" on public.visits for update
  using (customer_id = public.current_customer_id()
         or assigned_agent_id = public.current_agent_id()
         or listing_agent_id = public.current_agent_id()
         or public.is_admin())
  with check (customer_id = public.current_customer_id()
              or assigned_agent_id = public.current_agent_id()
              or listing_agent_id = public.current_agent_id()
              or public.is_admin());

-- Qualification decides money, so it is never client-writable. Only the
-- service role (which bypasses RLS) may set it, after the domain predicate runs.
create or replace function public.guard_visit_qualification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  if new.is_qualified is distinct from old.is_qualified
     or new.qualified_at is distinct from old.qualified_at
     or new.geofence_passed is distinct from old.geofence_passed then
    raise exception 'visits: qualification is computed by the platform and cannot be set directly'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;
create trigger visits_guard_qualification
  before update on public.visits
  for each row execute function public.guard_visit_qualification();

create policy "visit_assignments visible" on public.visit_assignments for select
  using (agent_id = public.current_agent_id()
         or exists (select 1 from public.visits v where v.id = visit_id
                     and (v.customer_id = public.current_customer_id()
                          or v.listing_agent_id = public.current_agent_id()))
         or public.is_admin());
create policy "visit_assignments agent responds" on public.visit_assignments for update
  using (agent_id = public.current_agent_id() or public.is_admin())
  with check (agent_id = public.current_agent_id() or public.is_admin());

create policy "visit_checkins visible" on public.visit_checkins for select
  using (exists (select 1 from public.visits v where v.id = visit_id
                  and (v.customer_id = public.current_customer_id()
                       or v.assigned_agent_id = public.current_agent_id()
                       or public.is_admin())));
create policy "visit_checkins insert by parties" on public.visit_checkins for insert
  with check (exists (select 1 from public.visits v where v.id = visit_id
                       and (v.customer_id = public.current_customer_id()
                            or v.assigned_agent_id = public.current_agent_id())));
-- Append-only: no UPDATE/DELETE policy.

create policy "visit_feedback visible" on public.visit_feedback for select
  using (customer_id = public.current_customer_id()
         or agent_id = public.current_agent_id()
         or public.is_admin());
create policy "visit_feedback customer writes" on public.visit_feedback for insert
  with check (customer_id = public.current_customer_id());

create policy "visit_attributions visible" on public.visit_attributions for select
  using (agent_id = public.current_agent_id() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Deals and money
-- ---------------------------------------------------------------------------
create policy "deals visible to participants" on public.deals for select
  using (
    customer_id = public.current_customer_id()
    or created_by = auth.uid()
    or exists (select 1 from public.deal_participants dp
                where dp.deal_id = deals.id
                  and (dp.agent_id = public.current_agent_id()
                       or dp.investor_id = public.current_investor_id()))
    or public.is_admin()
  );
create policy "deals agent create" on public.deals for insert
  with check (public.has_role('agent') or public.is_admin());
create policy "deals participant update" on public.deals for update
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = deals.id and dp.agent_id = public.current_agent_id()))
  with check (public.is_admin()
              or exists (select 1 from public.deal_participants dp
                          where dp.deal_id = deals.id and dp.agent_id = public.current_agent_id()));

create policy "deal_participants visible" on public.deal_participants for select
  using (agent_id = public.current_agent_id()
         or investor_id = public.current_investor_id()
         or user_id = auth.uid()
         or exists (select 1 from public.deals d where d.id = deal_id
                     and (d.customer_id = public.current_customer_id() or d.created_by = auth.uid()))
         or public.is_admin());
create policy "deal_participants manage" on public.deal_participants for all
  using (public.is_admin()
         or exists (select 1 from public.deals d where d.id = deal_id and d.created_by = auth.uid()))
  with check (public.is_admin()
              or exists (select 1 from public.deals d where d.id = deal_id and d.created_by = auth.uid()));

create policy "deal_events visible" on public.deal_events for select
  using (exists (select 1 from public.deals d where d.id = deal_id
                  and (d.customer_id = public.current_customer_id() or d.created_by = auth.uid()))
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
         or public.is_admin());

create policy "deal_documents visible" on public.deal_documents for select
  using (exists (select 1 from public.deal_participants dp
                  where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
         or public.is_admin());
create policy "deal_documents upload" on public.deal_documents for insert
  with check (uploaded_by = auth.uid() and (
    exists (select 1 from public.deal_participants dp
             where dp.deal_id = deal_id and dp.agent_id = public.current_agent_id())
    or public.is_admin()));

-- Commission rules are readable by agents (transparency is the product) but
-- writable only by finance admins.
create policy "commission_rules readable" on public.commission_rules for select
  using (is_active or public.is_admin());
create policy "commission_rules finance admin" on public.commission_rules for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

create policy "calculations visible to participants" on public.commission_calculations for select
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = commission_calculations.deal_id
                       and dp.agent_id = public.current_agent_id()));
create policy "calculations finance admin" on public.commission_calculations for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- An agent sees the WHOLE breakdown of a deal they participate in. That is
-- deliberate: transparent distribution is the product promise.
create policy "distributions visible to participants" on public.commission_distributions for select
  using (public.is_admin()
         or exists (select 1 from public.deal_participants dp
                     where dp.deal_id = commission_distributions.deal_id
                       and dp.agent_id = public.current_agent_id()));
create policy "distributions finance admin" on public.commission_distributions for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- The ledger, by contrast, is strictly personal money.
create policy "ledger own entries" on public.commission_ledger for select
  using (user_id = auth.uid()
         or agent_id = public.current_agent_id()
         or investor_id = public.current_investor_id()
         or public.has_admin_role('finance_admin'));
create policy "ledger finance admin" on public.commission_ledger for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

create policy "payments own" on public.payments for select
  using (payee_user_id = auth.uid() or public.has_admin_role('finance_admin'));
create policy "payments finance admin" on public.payments for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- ---------------------------------------------------------------------------
-- Investor module (module itself is feature-flagged in the application)
-- ---------------------------------------------------------------------------
create policy "opportunities investor read" on public.investor_opportunities for select
  using ((public.has_role('investor') and status in ('AVAILABLE','INVESTOR_INTERESTED','UNDER_NEGOTIATION'))
         or public.is_admin());
create policy "opportunities admin" on public.investor_opportunities for all
  using (public.is_admin()) with check (public.is_admin());

create policy "interests own" on public.investor_interests for all
  using (investor_id = public.current_investor_id() or public.is_admin())
  with check (investor_id = public.current_investor_id());

create policy "agreements own" on public.agreements for select
  using (investor_id = public.current_investor_id() or public.is_admin());
create policy "agreements admin" on public.agreements for all
  using (public.is_admin()) with check (public.is_admin());

-- Exclusivity is public knowledge (the badge is a selling point); the
-- commercial terms behind it are not.
create policy "exclusive readable" on public.exclusive_inventory for select
  using (status = 'EXCLUSIVE' or investor_id = public.current_investor_id() or public.is_admin());
create policy "exclusive admin" on public.exclusive_inventory for all
  using (public.is_admin()) with check (public.is_admin());

create policy "positions own" on public.investor_positions for select
  using (investor_id = public.current_investor_id() or public.has_admin_role('finance_admin'));
create policy "positions admin" on public.investor_positions for all
  using (public.has_admin_role('finance_admin')) with check (public.has_admin_role('finance_admin'));

-- ---------------------------------------------------------------------------
-- Notifications, reviews, disputes
-- ---------------------------------------------------------------------------
create policy "templates readable" on public.notification_templates for select
  using (public.is_admin());
create policy "templates admin" on public.notification_templates for all
  using (public.has_admin_role('content_admin')) with check (public.has_admin_role('content_admin'));

create policy "notifications own" on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());
-- A user may only mark their own notifications read; creation is server-side.
create policy "notifications mark read" on public.notifications for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notification_preferences own" on public.notification_preferences for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

-- Only APPROVED reviews are public.
create policy "reviews public read approved" on public.reviews for select
  using (moderation_status = 'APPROVED'
         or author_id = auth.uid()
         or agent_id = public.current_agent_id()
         or public.is_admin());
create policy "reviews author create" on public.reviews for insert
  with check (author_id = auth.uid());
create policy "reviews author edit pending" on public.reviews for update
  using (author_id = auth.uid() and moderation_status = 'PENDING')
  with check (author_id = auth.uid());
create policy "reviews admin moderate" on public.reviews for all
  using (public.has_admin_role('content_admin')) with check (public.has_admin_role('content_admin'));

-- An agent may respond to a review about them, but may not alter its content.
create or replace function public.guard_review_response()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_admin() or public.is_platform_context() then return new; end if;
  if old.agent_id is not null and old.agent_id = public.current_agent_id()
     and old.author_id <> auth.uid() then
    new.rating            := old.rating;
    new.title             := old.title;
    new.body              := old.body;
    new.moderation_status := old.moderation_status;
  end if;
  return new;
end;
$$;
create trigger reviews_guard_response
  before update on public.reviews
  for each row execute function public.guard_review_response();

create policy "disputes visible to parties" on public.disputes for select
  using (raised_by = auth.uid()
         or against_user_id = auth.uid()
         or against_agent_id = public.current_agent_id()
         or public.is_admin());
create policy "disputes raise" on public.disputes for insert
  with check (raised_by = auth.uid());
create policy "disputes admin" on public.disputes for all
  using (public.has_admin_role('support_admin')) with check (public.has_admin_role('support_admin'));

create policy "evidence visible to parties" on public.dispute_evidence for select
  using (submitted_by = auth.uid()
         or exists (select 1 from public.disputes d where d.id = dispute_id
                     and (d.raised_by = auth.uid() or d.against_user_id = auth.uid()))
         or public.is_admin());
create policy "evidence submit" on public.dispute_evidence for insert
  with check (submitted_by = auth.uid());

create policy "dispute_events visible" on public.dispute_events for select
  using (exists (select 1 from public.disputes d where d.id = dispute_id
                  and (d.raised_by = auth.uid() or d.against_user_id = auth.uid()))
         or public.is_admin());

-- ---------------------------------------------------------------------------
-- Audit logs — APPEND ONLY, and readable only by admins
-- ---------------------------------------------------------------------------
create policy "audit admin read" on public.audit_logs for select
  using (public.is_admin());
create policy "audit insert authenticated" on public.audit_logs for insert
  with check (auth.uid() is not null);
-- No UPDATE/DELETE policies exist. Additionally, revoke the privileges outright
-- so that a future permissive policy cannot silently make history editable.
revoke update, delete on public.audit_logs from anon, authenticated;
revoke update, delete on public.lead_events from anon, authenticated;
revoke update, delete on public.visit_checkins from anon, authenticated;
revoke update, delete on public.deal_events from anon, authenticated;
revoke update, delete on public.listing_status_history from anon, authenticated;
revoke update, delete on public.property_price_history from anon, authenticated;
revoke update, delete on public.contact_access_logs from anon, authenticated;

create policy "analytics insert" on public.analytics_events for insert
  with check (true);
create policy "analytics admin read" on public.analytics_events for select
  using (public.is_admin());

create policy "api_keys own" on public.api_keys for select
  using (owner_user_id = auth.uid() or public.is_admin());
create policy "api_keys admin" on public.api_keys for all
  using (public.has_admin_role('super_admin')) with check (public.has_admin_role('super_admin'));

-- idempotency_keys is service-role machinery; no client policy is granted.

-- ---------------------------------------------------------------------------
-- Public views — the curated projections the marketing site reads.
-- ---------------------------------------------------------------------------
-- This view is intentionally SECURITY DEFINER (security_invoker = false).
-- `profiles` is locked down to owner-and-admin, so a security-invoker view
-- would return nothing to an anonymous visitor and public agent pages would be
-- empty. Rather than loosening RLS on a table that holds phone numbers and
-- email addresses, we expose one narrow, hand-picked column list here. Every
-- column below is safe to publish; contact details and internal performance
-- metrics are absent by construction.
-- ---------------------------------------------------------------------------
create view public.public_agents
with (security_invoker = false) as
select
  a.id, a.slug, a.agency_name, a.headline, a.bio,
  a.experience_years, a.languages, a.specializations,
  a.service_cities, a.service_localities,
  a.verification_level, a.badges,
  a.rating_average, a.rating_count, a.closed_deal_count, a.joined_at,
  p.full_name, p.display_name, p.avatar_url, p.city
from public.agents a
join public.profiles p on p.id = a.user_id
where a.status = 'ACTIVE';

comment on view public.public_agents is
  'Public agent surface. Deliberately excludes trust_score, response_rate, conversion_rate, risk_score, complaint_count and all contact details (§13).';

grant select on public.public_agents to anon, authenticated;
