ALTER TABLE sns_draft_render_jobs ADD COLUMN storage_key TEXT;
ALTER TABLE sns_draft_render_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_sns_draft_render_storage ON sns_draft_render_jobs(tenant_id, storage_key);
