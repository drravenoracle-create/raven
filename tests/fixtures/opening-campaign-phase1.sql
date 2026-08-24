INSERT INTO opening_campaigns (
  campaign_id, tenant_id, campaign_name, enabled, start_at, end_at,
  trial_enabled, trial_scope, trial_limit, campaign_message,
  primary_cta, secondary_cta, target_audience
) VALUES (
  'raven-guild-opening', 'raven-oracle', 'Fixture Opening Campaign', 1,
  '2026-08-01T00:00:00.000Z', '2099-12-31T23:59:59.000Z',
  1, 'member', 1, 'Fixture campaign message',
  'Fixture primary CTA', 'Fixture secondary CTA', 'fixture-audience'
);

INSERT INTO opening_campaign_members (
  id, campaign_id, tenant_id, member_id, trial_start_at, trial_end_at,
  trial_usage_limit, trial_used_count, trial_status
) VALUES
  ('fixture-trial-active', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', '2026-08-24T00:00:00.000Z', '2099-12-31T23:59:59.000Z', 1, 0, 'active'),
  ('fixture-trial-exhausted', 'raven-guild-opening', 'raven-oracle', 'fixture-member-exhausted', '2026-08-24T00:00:00.000Z', '2099-12-31T23:59:59.000Z', 1, 1, 'exhausted');

INSERT INTO opening_campaign_events (id, campaign_id, tenant_id, member_id, event_name, event_key, payload_json) VALUES
  ('fixture-event-view', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', 'campaign_view', 'fixture:event:campaign-view', '{"audience":"fixture-audience"}'),
  ('fixture-event-cta', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', 'campaign_cta_clicked', 'fixture:event:cta-click', '{"audience":"fixture-audience"}'),
  ('fixture-event-started', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', 'trial_started', 'fixture:event:trial-started', '{"audience":"fixture-audience"}'),
  ('fixture-event-used', 'raven-guild-opening', 'raven-oracle', 'fixture-member-exhausted', 'trial_used', 'fixture:event:trial-used', '{"audience":"fixture-audience"}'),
  ('fixture-event-exhausted', 'raven-guild-opening', 'raven-oracle', 'fixture-member-exhausted', 'trial_exhausted', 'fixture:event:trial-exhausted', '{"audience":"fixture-audience"}'),
  ('fixture-event-converted', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', 'trial_converted', 'fixture:event:trial-converted', '{"audience":"fixture-audience"}');

INSERT OR IGNORE INTO opening_campaign_events (id, campaign_id, tenant_id, member_id, event_name, event_key, payload_json)
VALUES ('fixture-event-duplicate', 'raven-guild-opening', 'raven-oracle', 'fixture-member-active', 'campaign_view', 'fixture:event:campaign-view', '{"audience":"fixture-audience"}');

INSERT INTO sns_posts (id, tenant_id, platform, post_type, title, status, media_type, retry_count) VALUES
  ('fixture-image', 'fixture-tenant', 'instagram', 'image', 'fixture image', 'draft', 'image', 0),
  ('fixture-short-video', 'fixture-tenant', 'tiktok', 'short_video', 'fixture short video', 'draft', 'video', 0),
  ('fixture-youtube', 'fixture-tenant', 'youtube', 'short_video', 'fixture youtube short', 'draft', 'video', 0),
  ('fixture-facebook', 'fixture-tenant', 'facebook', 'image', 'fixture facebook post', 'draft', 'image', 0),
  ('fixture-instagram-reel', 'fixture-tenant', 'instagram', 'reel', 'fixture instagram reel', 'scheduled', 'video', 0);
