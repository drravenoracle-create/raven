CREATE TABLE IF NOT EXISTS raven_reading_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT '',
  reading_mode TEXT NOT NULL DEFAULT '',
  divination TEXT NOT NULL DEFAULT '',
  source_text TEXT NOT NULL DEFAULT '',
  input_length INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'started',
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT,
  trial_limit_reached INTEGER NOT NULL DEFAULT 0,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_raven_reading_logs_tenant_created
  ON raven_reading_logs (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raven_reading_logs_status
  ON raven_reading_logs (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raven_reading_logs_divination
  ON raven_reading_logs (tenant_id, divination, created_at DESC);
