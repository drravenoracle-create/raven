CREATE TABLE IF NOT EXISTS daily_calendar_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  local_date TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'daily_calendar',
  sexagenary_cycle_index INTEGER NOT NULL,
  almanac_json TEXT NOT NULL DEFAULT '{}',
  blog_article_id TEXT,
  blog_status TEXT NOT NULL DEFAULT 'pending',
  sns_status TEXT NOT NULL DEFAULT 'pending',
  media_format TEXT NOT NULL DEFAULT 'auto',
  generated_at TEXT,
  published_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, local_date, content_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_calendar_runs_status ON daily_calendar_runs(tenant_id, blog_status, sns_status, local_date);

ALTER TABLE blog_engine_settings ADD COLUMN calendar_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE blog_engine_settings ADD COLUMN calendar_time_jst TEXT NOT NULL DEFAULT '07:30';
ALTER TABLE blog_engine_settings ADD COLUMN calendar_format TEXT NOT NULL DEFAULT 'auto';
