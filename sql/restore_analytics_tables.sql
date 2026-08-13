CREATE TABLE IF NOT EXISTS growth_metric_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL DEFAULT 0,
  measured_at TEXT NOT NULL,
  window_start TEXT,
  window_end TEXT,
  data_quality TEXT NOT NULL DEFAULT 'unknown',
  provider_metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_metric_points_idempotency
  ON growth_metric_points (tenant_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_growth_metric_points_source_measured
  ON growth_metric_points (tenant_id, source, measured_at);

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
  last_error TEXT,
  provider_metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_data_connectors_tenant_source
  ON growth_data_connectors (tenant_id, source);

CREATE TABLE IF NOT EXISTS growth_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_engine TEXT NOT NULL,
  entity_refs_json TEXT NOT NULL DEFAULT '{}',
  payload_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_events_idempotency
  ON growth_events (tenant_id, idempotency_key);
