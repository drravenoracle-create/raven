CREATE TABLE IF NOT EXISTS sns_draft_render_jobs (
  render_job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  draft_version INTEGER NOT NULL,
  render_revision INTEGER NOT NULL DEFAULT 1,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  locale TEXT NOT NULL,
  renderer_provider TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RENDERING', 'COMPLETED', 'FAILED')),
  started_at TEXT,
  completed_at TEXT,
  error_code TEXT,
  error_message TEXT,
  request_json TEXT NOT NULL DEFAULT '{}',
  artifact_id TEXT,
  file_reference TEXT,
  width INTEGER,
  height INTEGER,
  duration REAL,
  video_codec TEXT,
  audio_codec TEXT,
  file_size INTEGER,
  checksum TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, draft_id, draft_version, platform, render_revision)
);

CREATE INDEX IF NOT EXISTS idx_sns_draft_render_jobs_scope
  ON sns_draft_render_jobs(tenant_id, draft_id, status, updated_at);
