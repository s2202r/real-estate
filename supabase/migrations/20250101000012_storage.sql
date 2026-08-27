-- ===========================================================================
-- 0012 · Storage buckets and object policies
-- ===========================================================================
-- Public buckets hold marketing imagery only. Anything that could identify a
-- person or evidence a title is PRIVATE and served exclusively through
-- short-lived signed URLs minted server-side after an authorisation check.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-media',     'property-media',     true,  209715200,
     array['image/jpeg','image/png','image/webp','image/avif','video/mp4','video/webm']),
  ('avatars',            'avatars',            true,  5242880,
     array['image/jpeg','image/png','image/webp','image/avif']),
  ('marketing-assets',   'marketing-assets',   true,  52428800,
     array['image/jpeg','image/png','image/webp','image/avif','application/pdf']),
  ('property-documents', 'property-documents', false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('agent-documents',    'agent-documents',    false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('user-documents',     'user-documents',     false, 26214400,
     array['application/pdf','image/jpeg','image/png','image/webp']),
  ('agreements',         'agreements',         false, 26214400,
     array['application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Convention: every private object is stored under a path whose FIRST segment
-- is the owning user's uuid — `<user_id>/<entity>/<filename>`. Ownership is
-- therefore verifiable from the path alone.
-- ---------------------------------------------------------------------------

-- Public buckets: anyone may read; only authenticated users may write, and only
-- into their own prefix.
create policy "public buckets are readable"
  on storage.objects for select
  using (bucket_id in ('property-media','avatars','marketing-assets'));

create policy "authenticated upload to own prefix in public buckets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners update their public objects"
  on storage.objects for update to authenticated
  using (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners delete their public objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('property-media','avatars','marketing-assets')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private buckets: owner-only read, plus admin. No anonymous access at all.
create policy "owners read their private objects"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "owners upload their private objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners delete their private objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Verification and finance admins need read access to review submitted
-- documents; that access is audited in the application layer.
create policy "verification admins read documents"
  on storage.objects for select to authenticated
  using (
    bucket_id in ('property-documents','agent-documents','user-documents','agreements')
    and (public.has_admin_role('verification_admin') or public.has_admin_role('finance_admin'))
  );
