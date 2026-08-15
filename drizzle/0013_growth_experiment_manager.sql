CREATE TABLE IF NOT EXISTS growth_engine_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  feature_flags_json TEXT NOT NULL DEFAULT '{}',
  automation_mode TEXT NOT NULL DEFAULT 'recommend',
  data_retention_days INTEGER NOT NULL DEFAULT 730,
  daily_api_budget REAL,
  monthly_api_budget REAL,
  warning_threshold_ratio REAL NOT NULL DEFAULT 0.8,
  hard_limit_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
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

ALTER TABLE growth_experiments ADD COLUMN experiment_code TEXT;
ALTER TABLE growth_experiments ADD COLUMN character_id TEXT;
ALTER TABLE growth_experiments ADD COLUMN growth_recommendation_id TEXT;
ALTER TABLE growth_experiments ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN change_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN target_type TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE growth_experiments ADD COLUMN target_id TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN primary_kpi TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN primary_kpi_direction TEXT NOT NULL DEFAULT 'increase';
ALTER TABLE growth_experiments ADD COLUMN guardrail_kpis_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE growth_experiments ADD COLUMN baseline_start_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN baseline_end_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN baseline_value REAL;
ALTER TABLE growth_experiments ADD COLUMN baseline_snapshot_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE growth_experiments ADD COLUMN target_value REAL;
ALTER TABLE growth_experiments ADD COLUMN planned_start_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN planned_end_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN actual_start_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN actual_end_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN priority TEXT NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE growth_experiments ADD COLUMN priority_score REAL NOT NULL DEFAULT 0;
ALTER TABLE growth_experiments ADD COLUMN impact_score REAL NOT NULL DEFAULT 0;
ALTER TABLE growth_experiments ADD COLUMN confidence_score REAL NOT NULL DEFAULT 0;
ALTER TABLE growth_experiments ADD COLUMN ease_score REAL NOT NULL DEFAULT 0;
ALTER TABLE growth_experiments ADD COLUMN owner TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN approval_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE growth_experiments ADD COLUMN approved_by TEXT;
ALTER TABLE growth_experiments ADD COLUMN approved_at TEXT;
ALTER TABLE growth_experiments ADD COLUMN result_status TEXT NOT NULL DEFAULT 'NOT_MEASURED';
ALTER TABLE growth_experiments ADD COLUMN result_summary TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN measured_value REAL;
ALTER TABLE growth_experiments ADD COLUMN absolute_change REAL;
ALTER TABLE growth_experiments ADD COLUMN relative_change REAL;
ALTER TABLE growth_experiments ADD COLUMN estimated_revenue_impact REAL;
ALTER TABLE growth_experiments ADD COLUMN learning TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN next_action TEXT NOT NULL DEFAULT '';
ALTER TABLE growth_experiments ADD COLUMN source_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE growth_experiments ADD COLUMN updated_at TEXT;

UPDATE growth_experiments
SET
  title = CASE WHEN title = '' THEN substr(hypothesis, 1, 120) ELSE title END,
  primary_kpi = CASE WHEN primary_kpi = '' THEN primary_metric ELSE primary_kpi END,
  guardrail_kpis_json = CASE WHEN guardrail_kpis_json = '[]' THEN guardrail_metrics_json ELSE guardrail_kpis_json END,
  impact_score = CASE WHEN impact_score = 0 THEN 50 ELSE impact_score END,
  confidence_score = CASE WHEN confidence_score = 0 THEN confidence * 100 ELSE confidence_score END,
  ease_score = CASE WHEN ease_score = 0 THEN 50 ELSE ease_score END,
  priority_score = CASE WHEN priority_score = 0 THEN ROUND((50 + (confidence * 100) + 50) / 3.0, 1) ELSE priority_score END,
  status = CASE
    WHEN lower(status) IN ('planned', 'draft') THEN 'DRAFT'
    WHEN lower(status) IN ('proposed') THEN 'PROPOSED'
    WHEN lower(status) IN ('running') THEN 'RUNNING'
    WHEN lower(status) IN ('completed', 'done') THEN 'COMPLETED'
    WHEN lower(status) IN ('rejected') THEN 'REJECTED'
    WHEN lower(status) IN ('cancelled', 'canceled') THEN 'CANCELLED'
    WHEN lower(status) IN ('archived') THEN 'ARCHIVED'
    ELSE status
  END,
  result_status = CASE
    WHEN upper(COALESCE(result, '')) IN ('WIN','LOSS','NEUTRAL','INCONCLUSIVE') THEN upper(result)
    ELSE result_status
  END,
  updated_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP);

WITH ranked AS (
  SELECT experiment_id, ROW_NUMBER() OVER (ORDER BY datetime(created_at), experiment_id) AS seq
  FROM growth_experiments
  WHERE experiment_code IS NULL OR experiment_code = ''
)
UPDATE growth_experiments
SET experiment_code = (
  SELECT 'EXP-' || strftime('%Y', COALESCE(growth_experiments.created_at, CURRENT_TIMESTAMP)) || '-' || printf('%05d', ranked.seq)
  FROM ranked
  WHERE ranked.experiment_id = growth_experiments.experiment_id
)
WHERE experiment_id IN (SELECT experiment_id FROM ranked);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_experiments_code ON growth_experiments(tenant_id, experiment_code);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_status_time ON growth_experiments(tenant_id, status, planned_start_at);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_character ON growth_experiments(tenant_id, character_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_result ON growth_experiments(tenant_id, result_status);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_recommendation ON growth_experiments(tenant_id, growth_recommendation_id);

CREATE TABLE IF NOT EXISTS growth_experiment_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_role TEXT NOT NULL DEFAULT 'primary',
  direction TEXT NOT NULL DEFAULT 'increase',
  baseline_value REAL,
  measured_value REAL,
  absolute_change REAL,
  relative_change REAL,
  source TEXT NOT NULL DEFAULT 'manual',
  calculation_method TEXT NOT NULL DEFAULT 'manual',
  sample_size INTEGER NOT NULL DEFAULT 0,
  window_start TEXT,
  window_end TEXT,
  data_quality TEXT NOT NULL DEFAULT 'manual',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_experiment_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  from_status TEXT,
  to_status TEXT,
  reason TEXT NOT NULL DEFAULT '',
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_experiment_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_metrics_exp ON growth_experiment_metrics(tenant_id, experiment_id, metric_role);
CREATE INDEX IF NOT EXISTS idx_growth_experiment_events_exp ON growth_experiment_events(tenant_id, experiment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_experiment_approvals_exp ON growth_experiment_approvals(tenant_id, experiment_id, created_at);
