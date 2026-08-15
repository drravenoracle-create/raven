CREATE TABLE IF NOT EXISTS three_choice_video_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  character_id TEXT NOT NULL DEFAULT 'raven',
  template_id TEXT NOT NULL DEFAULT 'raven_three_choice_v1',
  status TEXT NOT NULL DEFAULT 'queued',
  theme TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  deck_id TEXT NOT NULL DEFAULT '',
  job_payload TEXT NOT NULL DEFAULT '{}',
  renderer_provider TEXT NOT NULL DEFAULT 'unconfigured',
  renderer_job_id TEXT,
  output_url TEXT,
  output_key TEXT,
  thumbnail_url TEXT,
  thumbnail_key TEXT,
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_three_choice_video_jobs_tenant_status
  ON three_choice_video_jobs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_three_choice_video_jobs_tenant_created
  ON three_choice_video_jobs(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS three_choice_video_job_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT '',
  detail_json TEXT NOT NULL DEFAULT '{}',
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_three_choice_video_job_logs_job
  ON three_choice_video_job_logs(tenant_id, job_id, created_at);

-- Additive migration only. Existing SNS, Reel, Card Library, and Blog tables are not modified.
