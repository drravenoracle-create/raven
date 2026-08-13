CREATE TABLE IF NOT EXISTS growth_engine_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  feature_flags_json TEXT NOT NULL DEFAULT '{"analytics_connector":true,"conversion_engine":true,"content_intelligence":true,"internal_link_engine":true,"refresh_engine":true,"cta_engine":true,"trend_engine":true,"content_calendar":true,"audience_engine":true,"experiment_engine":true}',
  automation_mode TEXT NOT NULL DEFAULT 'recommend',
  data_retention_days INTEGER NOT NULL DEFAULT 730,
  daily_api_budget REAL,
  monthly_api_budget REAL,
  warning_threshold_ratio REAL NOT NULL DEFAULT 0.8,
  hard_limit_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_data_connectors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  provider TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'not_configured',
  last_success_at TEXT,
  last_attempt_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  last_error TEXT,
  provider_metadata_json TEXT NOT NULL DEFAULT '{}',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, source, provider)
);

CREATE TABLE IF NOT EXISTS growth_metric_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL,
  measured_at TEXT NOT NULL,
  window_start TEXT,
  window_end TEXT,
  data_quality TEXT NOT NULL DEFAULT 'partial',
  provider_metadata_json TEXT NOT NULL DEFAULT '{}',
  schema_version TEXT NOT NULL DEFAULT '1.0',
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS growth_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  source_engine TEXT NOT NULL,
  entity_refs_json TEXT NOT NULL DEFAULT '{}',
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'recorded',
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS growth_conversion_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  tracking_id TEXT,
  session_key TEXT,
  source_article_id TEXT,
  social_content_id TEXT,
  campaign_id TEXT,
  goal_name TEXT,
  goal_value REAL,
  attribution_type TEXT NOT NULL DEFAULT 'unknown',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS growth_content_insights (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  topic TEXT,
  category TEXT,
  keyword TEXT,
  search_intent TEXT,
  audience TEXT,
  content_format TEXT,
  social_angle TEXT,
  cta_id TEXT,
  publish_time TEXT,
  summary TEXT NOT NULL,
  recommended_action TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  observation_window TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  guard_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_internal_link_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_article_id TEXT NOT NULL,
  target_article_id TEXT NOT NULL,
  anchor_text TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'cluster',
  reason TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_cta_definitions (
  cta_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  cta_type TEXT NOT NULL,
  placement TEXT NOT NULL,
  copy_version TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '',
  action_name TEXT NOT NULL DEFAULT '',
  brand_guard_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_trends (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  trend_source TEXT NOT NULL,
  topic TEXT NOT NULL,
  detected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confidence REAL NOT NULL DEFAULT 0,
  expected_lifetime_days INTEGER,
  relevance_to_raven REAL NOT NULL DEFAULT 0,
  recommended_action TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate',
  source_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_calendar_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  content_type TEXT NOT NULL,
  topic TEXT NOT NULL,
  category TEXT,
  source_article_id TEXT,
  social_content_id TEXT,
  campaign_id TEXT,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  guard_status TEXT NOT NULL DEFAULT 'pending',
  plan_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_audience_segments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  segment_key TEXT NOT NULL,
  label TEXT NOT NULL,
  basis TEXT NOT NULL DEFAULT 'interest',
  estimated INTEGER NOT NULL DEFAULT 1,
  sensitive_attribute_used INTEGER NOT NULL DEFAULT 0,
  size_estimate INTEGER,
  confidence REAL NOT NULL DEFAULT 0,
  recommended_content_json TEXT NOT NULL DEFAULT '[]',
  recommended_cta_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, segment_key)
);

CREATE TABLE IF NOT EXISTS growth_experiments (
  experiment_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  variants_json TEXT NOT NULL DEFAULT '[]',
  primary_metric TEXT NOT NULL,
  guardrail_metrics_json TEXT NOT NULL DEFAULT '[]',
  started_at TEXT,
  ended_at TEXT,
  sample_size INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  winner TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_cost_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  units REAL,
  estimated_cost REAL,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_growth_metrics_entity ON growth_metric_points(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_growth_events_type ON growth_events(tenant_id, event_type, occurred_at);
CREATE INDEX IF NOT EXISTS idx_growth_conversions_article ON growth_conversion_events(tenant_id, source_article_id);
CREATE INDEX IF NOT EXISTS idx_growth_insights_status ON growth_content_insights(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_calendar_time ON growth_calendar_items(tenant_id, scheduled_at);

INSERT INTO growth_engine_settings (tenant_id)
VALUES ('raven-oracle')
ON CONFLICT(tenant_id) DO NOTHING;

INSERT INTO growth_data_connectors (id, tenant_id, source, provider, enabled, sync_status)
VALUES
  ('raven-ga4', 'raven-oracle', 'ga4', 'manual_or_api', 0, 'not_configured'),
  ('raven-gsc', 'raven-oracle', 'search_console', 'manual_or_api', 0, 'not_configured'),
  ('raven-cloudflare', 'raven-oracle', 'cloudflare', 'manual_or_api', 0, 'not_configured'),
  ('raven-sns', 'raven-oracle', 'sns', 'sns_engine', 1, 'available'),
  ('raven-conversion', 'raven-oracle', 'conversion', 'growth_engine', 1, 'available')
ON CONFLICT(tenant_id, source, provider) DO NOTHING;

INSERT INTO growth_cta_definitions (cta_id, tenant_id, cta_type, placement, copy_version, target_url, action_name, brand_guard_json)
VALUES
  ('raven-ai-trial', 'raven-oracle', 'ai_trial', 'article_body', 'v1', '/#oracle', 'AI無料占い', '{"no_fear_appeal":true,"respect_reader_choice":true}'),
  ('raven-line', 'raven-oracle', 'line', 'article_end', 'v1', '', 'LINE登録', '{"no_pressure":true}'),
  ('raven-service', 'raven-oracle', 'service', 'article_end', 'v1', '/#services', '鑑定サービス', '{"no_overpromise":true}')
ON CONFLICT(cta_id) DO NOTHING;

INSERT INTO growth_audience_segments (id, tenant_id, segment_key, label, basis, confidence)
VALUES
  ('raven-work-interest', 'raven-oracle', 'work-interest', '仕事・転職に関心', 'interest', 0.5),
  ('raven-relationship-interest', 'raven-oracle', 'relationship-interest', '恋愛・人間関係に関心', 'interest', 0.5),
  ('raven-strategy-divination', 'raven-oracle', 'strategy-divination', '戦略占術に関心', 'interest', 0.5)
ON CONFLICT(tenant_id, segment_key) DO NOTHING;
