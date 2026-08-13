CREATE TABLE IF NOT EXISTS sns_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  post_type TEXT NOT NULL DEFAULT 'carousel',
  title TEXT NOT NULL,
  theme TEXT,
  category TEXT,
  character TEXT,
  purpose TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT,
  script TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  external_post_id TEXT,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  duplicate_warning TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_posts_tenant_status_created
  ON sns_posts (tenant_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_sns_posts_tenant_scheduled
  ON sns_posts (tenant_id, scheduled_at);

CREATE TABLE IF NOT EXISTS sns_publish_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sns_post_id TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_publish_logs_post
  ON sns_publish_logs (tenant_id, sns_post_id, created_at);

CREATE TABLE IF NOT EXISTS sns_automation_settings (
  tenant_id TEXT PRIMARY KEY,
  automation_level INTEGER NOT NULL DEFAULT 1,
  emergency_stop_all INTEGER NOT NULL DEFAULT 0,
  min_post_interval_minutes INTEGER NOT NULL DEFAULT 240,
  schedule_json TEXT NOT NULL DEFAULT '{"windows":[{"start":"01:00","end":"07:00"},{"start":"13:00","end":"17:00"}]}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO sns_automation_settings
  (tenant_id, automation_level, emergency_stop_all, min_post_interval_minutes, schedule_json)
VALUES
  ('raven-oracle', 1, 0, 240, '{"windows":[{"start":"01:00","end":"07:00"},{"start":"13:00","end":"17:00"}]}');

CREATE TABLE IF NOT EXISTS media_video_assets (
  asset_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'uploaded',
  storage_key TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  mood TEXT,
  license_type TEXT,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  checksum TEXT,
  performance_score REAL NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_video_assets_tenant
  ON media_video_assets (tenant_id, deleted_at, created_at);

CREATE TABLE IF NOT EXISTS reel_engine_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reel_id TEXT,
  action TEXT NOT NULL,
  detail_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reel_engine_audit_logs_tenant
  ON reel_engine_audit_logs (tenant_id, created_at);
