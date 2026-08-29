-- ===========================================================================
-- 0015 · Notification templates for administrative actions
-- ===========================================================================
-- Three things an administrator can now do that the person on the other end
-- must hear about:
--
--   * an admin corrected a field on their listing,
--   * their agent account was suspended,
--   * their agent account was reinstated.
--
-- Someone else changing your listing, or stopping your account, without a word
-- is how a marketplace loses the people who supply it. Suspension in
-- particular carries the REASON in the message: an agent who cannot find out
-- why has nothing to act on and nothing to appeal.
-- ===========================================================================

insert into public.notification_templates
  (key, name, description, channels, subject_template, body_template, variables)
values
  ('listing.updated', 'Listing edited by the platform',
    'Sent to the agent when an administrator corrects a field on their listing.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'A change was made to your listing',
    'An administrator updated {{listingTitle}}. Reason: {{reason}}. Open your listing to review the change — if it looks wrong, reply and we will put it back.',
    array['listingTitle','reason']),

  ('agent.suspended', 'Agent account suspended',
    'Sent to the agent when their account is suspended.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your account has been suspended',
    'Your agent account on {{appName}} has been suspended. Reason: {{reason}}. Your existing listings are unaffected while this is reviewed. Reply to this message to appeal.',
    array['reason','appName']),

  ('agent.reinstated', 'Agent account reinstated',
    'Sent to the agent when a suspension is lifted.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your account is active again',
    'Your agent account on {{appName}} has been reinstated. Note: {{reason}}. You are back in the directory and can list again.',
    array['reason','appName'])
on conflict (key) do nothing;
