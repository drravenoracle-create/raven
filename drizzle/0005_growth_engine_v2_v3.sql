CREATE TABLE IF NOT EXISTS growth_customer_profiles (
  customer_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  journey_stage TEXT NOT NULL DEFAULT 'visitor',
  first_touch_json TEXT NOT NULL DEFAULT '{}',
  last_touch_json TEXT NOT NULL DEFAULT '{}',
  source_article_id TEXT,
  social_content_id TEXT,
  campaign_id TEXT,
  interests_json TEXT NOT NULL DEFAULT '[]',
  last_action TEXT,
  last_conversion TEXT,
  total_orders INTEGER NOT NULL DEFAULT 0,
  total_revenue REAL NOT NULL DEFAULT 0,
  lifetime_value REAL NOT NULL DEFAULT 0,
  consent_status TEXT NOT NULL DEFAULT 'unknown',
  opt_out INTEGER NOT NULL DEFAULT 0,
  data_quality TEXT NOT NULL DEFAULT 'partial',
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_retention_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_key TEXT,
  segment_key TEXT,
  recommendation_type TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  expected_effect TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  contact_frequency_cap_json TEXT NOT NULL DEFAULT '{"max_per_week":1,"cooldown_hours":168,"quiet_period":true}',
  approval_required INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'proposed',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_revenue_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_key TEXT,
  source_article_id TEXT,
  social_content_id TEXT,
  campaign_id TEXT,
  service_key TEXT,
  revenue REAL NOT NULL DEFAULT 0,
  gross_margin REAL,
  order_count INTEGER NOT NULL DEFAULT 0,
  average_order_value REAL,
  repeat_revenue REAL,
  lifetime_value REAL,
  attribution_type TEXT NOT NULL DEFAULT 'unknown',
  revenue_kind TEXT NOT NULL DEFAULT 'measured',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data_quality TEXT NOT NULL DEFAULT 'partial',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS growth_next_best_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  action_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  expected_effect TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL DEFAULT 'low',
  approval_required INTEGER NOT NULL DEFAULT 1,
  guard_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'proposed',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  rejected_at TEXT,
  executed_at TEXT
);

CREATE TABLE IF NOT EXISTS growth_executive_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  period_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  facts_json TEXT NOT NULL DEFAULT '{}',
  estimates_json TEXT NOT NULL DEFAULT '{}',
  hypotheses_json TEXT NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  key_decisions_json TEXT NOT NULL DEFAULT '[]',
  pending_approvals_json TEXT NOT NULL DEFAULT '[]',
  risk_alerts_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_business_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  parent_goal_id TEXT,
  name TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  target_value REAL NOT NULL,
  current_value REAL NOT NULL DEFAULT 0,
  time_horizon TEXT NOT NULL DEFAULT 'monthly',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_strategies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  objective TEXT NOT NULL,
  target_metrics_json TEXT NOT NULL DEFAULT '{}',
  target_audience_json TEXT NOT NULL DEFAULT '{}',
  channels_json TEXT NOT NULL DEFAULT '[]',
  budget_json TEXT NOT NULL DEFAULT '{}',
  time_horizon TEXT NOT NULL DEFAULT '90d',
  assumptions_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_autonomous_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_agent TEXT NOT NULL DEFAULT 'growth_planner',
  action_type TEXT NOT NULL,
  channel TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  reason TEXT NOT NULL DEFAULT '',
  expected_impact TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'LOW',
  cost_estimate REAL NOT NULL DEFAULT 0,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  guard_result TEXT NOT NULL DEFAULT 'require_approval',
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  executed_at TEXT,
  result_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS growth_guardrail_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  result TEXT NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  policy_snapshot_json TEXT NOT NULL DEFAULT '{}',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_kill_switches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '*',
  enabled INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  allow_analysis INTEGER NOT NULL DEFAULT 1,
  stopped_at TEXT,
  stopped_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, scope_type, scope_id)
);

CREATE TABLE IF NOT EXISTS growth_knowledge_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  version INTEGER NOT NULL DEFAULT 1,
  valid_from TEXT,
  valid_to TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_agent_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  max_hops INTEGER NOT NULL DEFAULT 3,
  max_actions INTEGER NOT NULL DEFAULT 5,
  max_cost REAL NOT NULL DEFAULT 0,
  timeout_seconds INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'queued',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS growth_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_customers_tenant_stage ON growth_customer_profiles(tenant_id, journey_stage);
CREATE INDEX IF NOT EXISTS idx_growth_revenue_entity ON growth_revenue_records(tenant_id, source_article_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON growth_autonomous_actions(tenant_id, status, risk_level);
CREATE INDEX IF NOT EXISTS idx_growth_nba_status ON growth_next_best_actions(tenant_id, status, risk_level);
CREATE INDEX IF NOT EXISTS idx_growth_audit_subject ON growth_audit_log(tenant_id, subject_type, subject_id);

UPDATE growth_engine_settings
SET feature_flags_json = '{"analytics_connector":true,"conversion_engine":true,"content_intelligence":true,"internal_link_engine":true,"refresh_engine":true,"cta_engine":true,"trend_engine":true,"content_calendar":true,"audience_engine":true,"experiment_engine":true,"customer_journey":true,"retention_engine":true,"revenue_intelligence":true,"executive_engine":true,"autonomous_marketing_os":true}',
    automation_mode = 'recommend',
    updated_at = CURRENT_TIMESTAMP
WHERE tenant_id = 'raven-oracle';

INSERT INTO growth_kill_switches (id, tenant_id, scope_type, scope_id, enabled, reason)
VALUES ('raven-growth-global-stop', 'raven-oracle', 'tenant', '*', 0, 'Default active; stop external actions only when enabled.')
ON CONFLICT(tenant_id, scope_type, scope_id) DO NOTHING;

INSERT INTO growth_business_goals (id, tenant_id, goal_type, name, target_metric, target_value, time_horizon)
VALUES
  ('raven-goal-line-monthly', 'raven-oracle', 'marketing', 'LINE登録を増やす', 'line_signup', 30, 'monthly'),
  ('raven-goal-booking-monthly', 'raven-oracle', 'business', '予約数を増やす', 'booking_complete', 10, 'monthly')
ON CONFLICT(id) DO NOTHING;
