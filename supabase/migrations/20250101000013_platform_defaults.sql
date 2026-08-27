-- ===========================================================================
-- 0013 · Platform defaults (not demo data)
-- ===========================================================================
-- The default commission policy, the amenity catalogue and the notification
-- templates ship with the product. Demo records live in supabase/seed.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Amenity catalogue
-- ---------------------------------------------------------------------------
insert into public.amenities (key, label, category, icon, sort_order) values
  ('lift',              'Lift',                    'building',  'ArrowUpDown',  10),
  ('power_backup',      'Power Backup',            'building',  'BatteryCharging', 20),
  ('security_24x7',     '24x7 Security',           'safety',    'ShieldCheck',  30),
  ('cctv',              'CCTV Surveillance',       'safety',    'Cctv',         40),
  ('gated_community',   'Gated Community',         'safety',    'Fence',        50),
  ('covered_parking',   'Covered Parking',         'parking',   'CarFront',     60),
  ('visitor_parking',   'Visitor Parking',         'parking',   'Car',          70),
  ('swimming_pool',     'Swimming Pool',           'lifestyle', 'Waves',        80),
  ('gym',               'Gymnasium',               'lifestyle', 'Dumbbell',     90),
  ('clubhouse',         'Clubhouse',               'lifestyle', 'Building2',   100),
  ('park',              'Landscaped Park',         'lifestyle', 'Trees',       110),
  ('kids_play_area',    'Children''s Play Area',    'lifestyle', 'ToyBrick',    120),
  ('jogging_track',     'Jogging Track',           'lifestyle', 'Footprints',  130),
  ('indoor_games',      'Indoor Games',            'lifestyle', 'Gamepad2',    140),
  ('community_hall',    'Community Hall',          'lifestyle', 'Users',       150),
  ('water_24x7',        '24x7 Water Supply',       'utility',   'Droplets',    160),
  ('rain_water',        'Rainwater Harvesting',    'utility',   'CloudRain',   170),
  ('sewage_treatment',  'Sewage Treatment Plant',  'utility',   'Recycle',     180),
  ('waste_management',  'Waste Management',        'utility',   'Trash2',      190),
  ('fire_safety',       'Fire Safety',             'safety',    'Flame',       200),
  ('intercom',          'Intercom',                'building',  'PhoneCall',   210),
  ('maintenance_staff', 'Maintenance Staff',       'building',  'Wrench',      220),
  ('vastu_compliant',   'Vastu Compliant',         'other',     'Compass',     230),
  ('pet_friendly',      'Pet Friendly',            'other',     'PawPrint',    240),
  ('wheelchair_access', 'Wheelchair Accessible',   'other',     'Accessibility', 250),
  ('ev_charging',       'EV Charging',             'utility',   'Plug',        260),
  ('modular_kitchen',   'Modular Kitchen',         'interior',  'CookingPot',  270),
  ('wardrobes',         'Fitted Wardrobes',        'interior',  'DoorClosed',  280),
  ('air_conditioning',  'Air Conditioning',        'interior',  'AirVent',     290),
  ('piped_gas',         'Piped Gas',               'utility',   'Flame',       300)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Default commission policy
-- ---------------------------------------------------------------------------
-- Percentages live HERE, as data. No application file hard-codes a split.
-- The `policy` document is validated by CommissionPolicySchema (Zod) before it
-- is written, and is snapshotted into every calculation that uses it.
-- ---------------------------------------------------------------------------
insert into public.commission_rules (
  code, name, description, version,
  listing_type, pool_mode, pool_percent,
  min_pool_amount, visit_model, policy, priority, is_active
) values (
  'default-sale', 'Default sale commission', 'Platform default for SALE transactions in India.', 1,
  'SALE', 'PERCENT_OF_TRANSACTION', 2.0000,
  25000.00, 'LATEST_WEIGHTED',
  jsonb_build_object(
    'roleShares', jsonb_build_object(
      'LISTING_AGENT', 20,
      'SALES_AGENT',   40,
      'VISIT_POOL',    15,
      'PLATFORM',      25
    ),
    'visitModel', 'LATEST_WEIGHTED',
    'visitTiers', jsonb_build_object(
      'latest',   50,
      'previous', 25,
      'earlier',  25
    ),
    'scoreWeights', jsonb_build_object(
      'recency',              0.35,
      'customerConfirmation', 0.20,
      'duration',             0.15,
      'outcome',              0.15,
      'interest',             0.10,
      'negotiation',          0.05
    ),
    'unallocatedStrategy', 'PLATFORM',
    'targetVisitMinutes', 30,
    'floors', jsonb_build_object(),
    'caps',   jsonb_build_object()
  ),
  100, true
)
on conflict (code, version) do nothing;

insert into public.commission_rules (
  code, name, description, version,
  listing_type, pool_mode, pool_fixed_amount,
  visit_model, policy, priority, is_active
) values (
  'default-rent', 'Default rental commission', 'Platform default for RENT and LEASE transactions.', 1,
  'RENT', 'FIXED_AMOUNT', 0.00,
  'LATEST_WEIGHTED',
  jsonb_build_object(
    'roleShares', jsonb_build_object(
      'LISTING_AGENT', 30,
      'SALES_AGENT',   35,
      'VISIT_POOL',    15,
      'PLATFORM',      20
    ),
    'visitModel', 'LATEST_WEIGHTED',
    'visitTiers', jsonb_build_object('latest', 60, 'previous', 25, 'earlier', 15),
    'scoreWeights', jsonb_build_object(
      'recency', 0.35, 'customerConfirmation', 0.20, 'duration', 0.15,
      'outcome', 0.15, 'interest', 0.10, 'negotiation', 0.05
    ),
    'unallocatedStrategy', 'PLATFORM',
    'targetVisitMinutes', 20,
    'floors', jsonb_build_object(),
    'caps',   jsonb_build_object()
  ),
  100, true
)
on conflict (code, version) do nothing;

-- ---------------------------------------------------------------------------
-- Notification templates
-- ---------------------------------------------------------------------------
insert into public.notification_templates (key, name, description, channels, subject_template, body_template, variables) values
  ('lead.received', 'New lead received', 'Sent to the agent when a customer enquires.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New enquiry for {{propertyTitle}}',
    'You have a new enquiry for {{propertyTitle}} from a customer in {{city}}. Respond quickly to improve your response rate.',
    array['propertyTitle','city']),
  ('listing.approved', 'Listing approved', 'Sent to the agent when moderation passes.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your listing is live',
    '{{listingTitle}} has been verified and is now live on {{appName}}.',
    array['listingTitle','appName']),
  ('listing.rejected', 'Listing rejected', 'Sent to the agent when moderation fails.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Action needed on your listing',
    '{{listingTitle}} could not be verified. Reason: {{reason}}. You can edit and resubmit it.',
    array['listingTitle','reason']),
  ('visit.booked', 'Visit requested', 'Sent when a customer requests a site visit.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New visit request for {{propertyTitle}}',
    'A customer has requested a {{visitType}} visit on {{visitDate}} at {{visitTime}}.',
    array['propertyTitle','visitType','visitDate','visitTime']),
  ('visit.opportunity', 'Visit opportunity', 'Offered to nearby available agents.',
    array['IN_APP','PUSH']::public.notification_channel[],
    'New property visit opportunity',
    'A visit is available {{distanceKm}} km away on {{visitDate}} at {{visitTime}}. Accept to become the visiting agent.',
    array['distanceKm','visitDate','visitTime']),
  ('visit.accepted', 'Visit accepted', 'Sent to the customer when an agent accepts.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Your visit is confirmed',
    '{{agentName}} will show you {{propertyTitle}} on {{visitDate}} at {{visitTime}}.',
    array['agentName','propertyTitle','visitDate','visitTime']),
  ('visit.reminder', 'Visit reminder', 'Sent ahead of a scheduled visit.',
    array['IN_APP','EMAIL','WHATSAPP']::public.notification_channel[],
    'Reminder: property visit tomorrow',
    'Your property visit is scheduled for {{visitDate}} at {{visitTime}} at {{propertyTitle}}.',
    array['visitDate','visitTime','propertyTitle']),
  ('visit.completed', 'Visit completed', 'Requests feedback after a visit.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'How was your visit?',
    'Tell us how your visit to {{propertyTitle}} went. Your feedback confirms the visit and helps other customers.',
    array['propertyTitle']),
  ('deal.updated', 'Deal updated', 'Sent to deal participants on status change.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Deal {{dealCode}} is now {{status}}',
    'Deal {{dealCode}} for {{propertyTitle}} moved to {{status}}.',
    array['dealCode','status','propertyTitle']),
  ('commission.generated', 'Commission calculated', 'Sent when a payout is computed.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Commission calculated for {{dealCode}}',
    'Your commission of {{amount}} for deal {{dealCode}} has been calculated. Open the deal to see the full breakdown.',
    array['amount','dealCode']),
  ('commission.approved', 'Commission approved', 'Sent when finance approves a payout.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Commission approved',
    'Your commission of {{amount}} for deal {{dealCode}} has been approved for payout.',
    array['amount','dealCode']),
  ('payment.completed', 'Payment completed', 'Sent when settlement succeeds.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Payment sent',
    '{{amount}} has been paid against deal {{dealCode}}. Reference: {{reference}}.',
    array['amount','dealCode','reference']),
  ('share.requested', 'Inventory access requested', 'Sent to the listing owner.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    '{{agentName}} requested access to your listing',
    '{{agentName}} would like to share {{listingTitle}} with a customer. Approve or decline the request.',
    array['agentName','listingTitle']),
  ('share.approved', 'Inventory access approved', 'Sent to the requesting agent.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Access approved',
    'You now have access to {{listingTitle}}. You can share it with your customers and request visits.',
    array['listingTitle']),
  ('requirement.match', 'New matching properties', 'Sent to the customer.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    '{{count}} new properties match your requirement',
    'We found {{count}} properties matching "{{requirementTitle}}".',
    array['count','requirementTitle']),
  ('agent.verified', 'Verification approved', 'Sent when an agent passes verification.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'You are verified',
    'Your {{level}} verification is approved. The badge now appears on your public profile.',
    array['level']),
  ('dispute.updated', 'Dispute updated', 'Sent to dispute parties.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Dispute {{disputeCode}} updated',
    'Dispute {{disputeCode}} is now {{status}}.',
    array['disputeCode','status']),
  ('investor.opportunity', 'New investor opportunity', 'Sent to eligible investors.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'New exclusive inventory opportunity',
    '{{opportunityTitle}} is now open. Indicative economics only; subject to a separate written agreement.',
    array['opportunityTitle']),
  ('exclusive.expiring', 'Exclusive inventory expiring', 'Sent before an exclusivity window closes.',
    array['IN_APP','EMAIL']::public.notification_channel[],
    'Exclusive rights expiring soon',
    'Exclusive rights for {{propertyTitle}} expire on {{endsOn}}.',
    array['propertyTitle','endsOn'])
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Operational settings
-- ---------------------------------------------------------------------------
insert into public.admin_settings (key, value, category, label, description, is_public) values
  ('visit.geofence_radius_meters', '200'::jsonb, 'visits', 'Visit geofence radius (m)',
     'Maximum distance from the property at which a physical check-in counts.', false),
  ('visit.min_duration_minutes', '10'::jsonb, 'visits', 'Minimum meaningful visit duration',
     'A visit shorter than this cannot be qualified for commission.', false),
  ('visit.offer_expiry_minutes', '30'::jsonb, 'visits', 'Visit offer expiry',
     'How long a visiting-agent offer stays open before rolling to the next agent.', false),
  ('visit.max_offer_rounds', '5'::jsonb, 'visits', 'Maximum offer rounds', 'How many agents are offered a visit before escalation.', false),
  ('leads.contact_reveal_daily_limit', '25'::jsonb, 'privacy', 'Contact reveals per agent per day',
     'Rate limit on unmasking customer contact details.', false),
  ('listings.expiry_days', '90'::jsonb, 'listings', 'Listing expiry (days)', 'Days before a verified listing expires and must be refreshed.', false),
  ('listings.reverification_days', '30'::jsonb, 'listings', 'Re-verification interval (days)', 'How often a live listing must be re-confirmed by its agent.', false),
  ('duplicates.auto_flag_threshold', '75'::jsonb, 'moderation', 'Duplicate flag threshold',
     'Confidence at or above which a listing is queued for duplicate review. Never auto-merged.', false),
  ('platform.support_email', '"support@example.com"'::jsonb, 'general', 'Support email', 'Shown in the footer and on error pages.', true),
  ('platform.grievance_officer', '{"name":"","email":"","phone":""}'::jsonb, 'legal', 'Grievance officer',
     'Required under the Consumer Protection (E-Commerce) Rules 2020 and IT Rules 2021. Must be completed before launch.', true)
on conflict (key) do nothing;
