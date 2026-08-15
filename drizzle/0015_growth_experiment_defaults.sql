INSERT INTO growth_engine_settings (tenant_id, feature_flags_json, automation_mode)
VALUES (
  'raven-oracle',
  '{"analytics_connector":true,"conversion_engine":true,"content_intelligence":true,"internal_link_engine":true,"refresh_engine":true,"cta_engine":true,"trend_engine":true,"content_calendar":true,"audience_engine":true,"experiment_engine":true,"customer_journey":true,"retention_engine":true,"revenue_intelligence":true,"executive_engine":true,"autonomous_marketing_os":true,"experiment_manager":true}',
  'recommend'
)
ON CONFLICT(tenant_id) DO UPDATE SET
  feature_flags_json = excluded.feature_flags_json,
  automation_mode = excluded.automation_mode,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO growth_audience_segments (id, tenant_id, segment_key, label, basis, confidence)
VALUES
  ('raven-work-interest', 'raven-oracle', 'work-interest', '仕事・転職に関心', 'interest', 0.5),
  ('raven-relationship-interest', 'raven-oracle', 'relationship-interest', '恋愛・人間関係に関心', 'interest', 0.5),
  ('raven-strategy-divination', 'raven-oracle', 'strategy-divination', '戦略占術に関心', 'interest', 0.5)
ON CONFLICT(tenant_id, segment_key) DO NOTHING;
