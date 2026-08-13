CREATE TABLE IF NOT EXISTS reel_engine_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  plan TEXT NOT NULL DEFAULT 'STANDARD',
  entitlement_json TEXT NOT NULL DEFAULT '{"reel_engine":true,"reel_basic":true,"reel_advanced":false,"ai_video_generation":false,"monthly_render_limit":30}',
  renderer_provider TEXT NOT NULL DEFAULT 'unconfigured',
  storage_provider TEXT NOT NULL DEFAULT 'metadata-only',
  monthly_render_count INTEGER NOT NULL DEFAULT 0,
  monthly_ai_video_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_video_assets (
  asset_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'stock',
  storage_key TEXT NOT NULL,
  duration REAL NOT NULL DEFAULT 0,
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1920,
  tags_json TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '',
  mood TEXT NOT NULL DEFAULT '',
  license_type TEXT NOT NULL DEFAULT 'unknown',
  usage_count INTEGER NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reel_projects (
  reel_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'instagram',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  duration INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'draft',
  script_json TEXT NOT NULL DEFAULT '{}',
  scenes_json TEXT NOT NULL DEFAULT '[]',
  background_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  text_layers_json TEXT NOT NULL DEFAULT '[]',
  brand_preset_id TEXT NOT NULL DEFAULT 'brand-default',
  audio_asset_id TEXT,
  audio_json TEXT NOT NULL DEFAULT '{}',
  renderer_provider TEXT NOT NULL DEFAULT 'unconfigured',
  output_asset_id TEXT,
  campaign_id TEXT,
  source_content_id TEXT,
  source_type TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS reel_render_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reel_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'unconfigured',
  status TEXT NOT NULL DEFAULT 'unavailable',
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  output_asset_id TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reel_engine_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  reel_id TEXT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'system',
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reel_projects_tenant_status ON reel_projects(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_reel_projects_source ON reel_projects(tenant_id, source_content_id);
CREATE INDEX IF NOT EXISTS idx_media_video_assets_tenant_category ON media_video_assets(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_reel_render_jobs_tenant_status ON reel_render_jobs(tenant_id, status);

INSERT INTO reel_engine_settings (tenant_id)
VALUES ('raven-oracle')
ON CONFLICT(tenant_id) DO NOTHING;

INSERT INTO media_video_assets (asset_id, tenant_id, source, storage_key, duration, width, height, tags_json, category, mood, license_type, performance_score)
VALUES
  ('raven-stock-calm-desk', 'raven-oracle', 'stock', 'library/raven/calm-desk.mp4', 12, 1080, 1920, '["calm","desk","oracle"]', 'calm', 'calm_mystic', 'owned', 50),
  ('raven-stock-night-oracle', 'raven-oracle', 'stock', 'library/raven/night-oracle.mp4', 15, 1080, 1920, '["night","oracle","mystic"]', 'oracle', 'calm_mystic', 'owned', 55),
  ('raven-stock-cards-close', 'raven-oracle', 'stock', 'library/raven/cards-close.mp4', 10, 1080, 1920, '["cards","oracle","hands"]', 'desk', 'quiet', 'owned', 48)
ON CONFLICT(asset_id) DO NOTHING;

-- Rollback / recovery:
-- These tables are additive. To disable without data loss, set reel_engine_settings.enabled = 0.
-- To fully remove v1.0 metadata after backup, drop reel_engine_audit_logs, reel_render_jobs, reel_projects, media_video_assets, reel_engine_settings.
