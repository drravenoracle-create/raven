CREATE TABLE IF NOT EXISTS ai_media_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 0,
  auto_generate INTEGER NOT NULL DEFAULT 0,
  provider TEXT NOT NULL DEFAULT 'openai',
  model TEXT NOT NULL DEFAULT 'gpt-image-1',
  quality TEXT NOT NULL DEFAULT 'medium',
  default_aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  images_per_post INTEGER NOT NULL DEFAULT 1,
  monthly_budget_limit REAL NOT NULL DEFAULT 500,
  per_post_cost_limit REAL NOT NULL DEFAULT 20,
  fallback_policy TEXT NOT NULL DEFAULT 'library_then_draft',
  drive_sync_enabled INTEGER NOT NULL DEFAULT 0,
  feature_flags_json TEXT NOT NULL DEFAULT '{"ai_media":true,"openai_image":true,"ffmpeg_renderer":false}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_provider_config (
  provider_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'GLOBAL',
  provider_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  pricing_json TEXT NOT NULL DEFAULT '{}',
  default_model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_presets (
  preset_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  preset_type TEXT NOT NULL,
  character_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  style_prompt TEXT NOT NULL DEFAULT '',
  negative_instructions TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_prompts (
  prompt_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT,
  experiment_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'queued',
  prompt_snapshot TEXT NOT NULL DEFAULT '',
  request_json TEXT NOT NULL DEFAULT '{}',
  response_json TEXT NOT NULL DEFAULT '{}',
  estimated_cost REAL NOT NULL DEFAULT 0,
  actual_cost REAL NOT NULL DEFAULT 0,
  asset_id TEXT,
  storage_key TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_assets (
  asset_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT,
  media_video_asset_id TEXT,
  provider TEXT NOT NULL,
  media_type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  storage_provider TEXT NOT NULL DEFAULT 'r2',
  storage_key TEXT NOT NULL DEFAULT '',
  preview_url TEXT NOT NULL DEFAULT '',
  prompt_id TEXT,
  prompt_snapshot TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_media_cost_logs (
  cost_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT,
  provider TEXT NOT NULL,
  model TEXT,
  action TEXT NOT NULL,
  estimated_cost REAL NOT NULL DEFAULT 0,
  actual_cost REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'JPY',
  units INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_media_jobs_tenant_status ON ai_media_jobs(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_media_assets_tenant ON ai_media_assets(tenant_id, media_type, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_media_costs_tenant_month ON ai_media_cost_logs(tenant_id, created_at);

INSERT OR IGNORE INTO ai_media_settings (tenant_id, enabled, auto_generate, provider, model, quality, default_aspect_ratio)
VALUES ('raven-oracle', 0, 0, 'openai', 'gpt-image-1', 'medium', '9:16');

INSERT OR IGNORE INTO ai_media_provider_config (provider_id, tenant_id, provider_type, enabled, capabilities_json, pricing_json, default_model)
VALUES
  ('openai-image', 'GLOBAL', 'image', 1, '{"generateImage":true,"editImage":false,"generateVideo":false,"aspectRatios":["9:16","4:5","1:1"],"sizes":{"9:16":"1024x1536","4:5":"1024x1536","1:1":"1024x1024"}}', '{"currency":"JPY","configured_by_admin":true,"note":"Do not hard-code provider pricing; update here."}', 'gpt-image-1'),
  ('external-ffmpeg-renderer', 'GLOBAL', 'video_renderer', 0, '{"render20sVertical":true,"mp4":true,"h264":true,"aac":true}', '{"currency":"JPY","configured_by_admin":true}', 'external');

INSERT OR IGNORE INTO ai_media_prompts (prompt_id, tenant_id, name, template)
VALUES (
  'raven-ai-media-image-v1',
  'raven-oracle',
  'Raven SNS image prompt',
  'Create a vertical SNS visual for Raven Oracle. Character: {{character_id}}. Theme: {{theme}}. Divination: {{divination_type}}. Mood: {{mood}}. Scene: {{scene}}. Brand style: quiet, mystical, refined, readable, no text unless explicitly requested. Avoid: {{negative_instructions}}.'
);

INSERT OR IGNORE INTO ai_media_presets (preset_id, tenant_id, preset_type, character_id, name, style_prompt, negative_instructions)
VALUES
  ('raven-style-raven', 'raven-oracle', 'character', 'raven', 'Raven', 'dark moon, quiet oracle desk, strategic, calm, refined', 'medical, legal, investment, death, gore, explicit content'),
  ('raven-style-luna', 'raven-oracle', 'character', 'luna', 'Luna', 'soft moonlight, gentle, quiet, supportive', 'medical, legal, investment, death, gore, explicit content'),
  ('raven-style-scarlet', 'raven-oracle', 'character', 'scarlet', 'Scarlet', 'warm light, confident, energetic, hopeful', 'medical, legal, investment, death, gore, explicit content'),
  ('raven-style-atlas', 'raven-oracle', 'character', 'atlas', 'Atlas', 'clean desk, maps, practical, structured, grounded', 'medical, legal, investment, death, gore, explicit content'),
  ('raven-style-sol', 'raven-oracle', 'character', 'sol', 'Sol Aurora', 'bright dawn, hopeful, clear, uplifting', 'medical, legal, investment, death, gore, explicit content');
