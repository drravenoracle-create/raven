ALTER TABLE media_video_assets ADD COLUMN mime_type TEXT NOT NULL DEFAULT '';
ALTER TABLE media_video_assets ADD COLUMN size_bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media_video_assets ADD COLUMN checksum TEXT NOT NULL DEFAULT '';
ALTER TABLE media_video_assets ADD COLUMN deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_media_video_assets_tenant_deleted ON media_video_assets(tenant_id, deleted_at);

-- Rollback / recovery:
-- SQLite/D1 cannot drop columns safely without table rebuild.
-- To disable uploaded assets without data loss, set deleted_at and keep the R2 object untouched.
