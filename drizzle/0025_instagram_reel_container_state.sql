ALTER TABLE sns_posts ADD COLUMN container_id TEXT;
ALTER TABLE sns_posts ADD COLUMN container_status TEXT;
ALTER TABLE sns_posts ADD COLUMN container_created_at TEXT;
ALTER TABLE sns_posts ADD COLUMN container_last_checked_at TEXT;
ALTER TABLE sns_posts ADD COLUMN container_ready_at TEXT;
ALTER TABLE sns_posts ADD COLUMN container_published_at TEXT;
ALTER TABLE sns_posts ADD COLUMN meta_http_status INTEGER;
ALTER TABLE sns_posts ADD COLUMN meta_response_body TEXT;
ALTER TABLE sns_posts ADD COLUMN meta_error_code INTEGER;
ALTER TABLE sns_posts ADD COLUMN meta_error_subcode INTEGER;
ALTER TABLE sns_posts ADD COLUMN meta_error_message TEXT;
ALTER TABLE sns_posts ADD COLUMN meta_error_type TEXT;

ALTER TABLE sns_publish_logs ADD COLUMN container_id TEXT;
ALTER TABLE sns_publish_logs ADD COLUMN container_status TEXT;
ALTER TABLE sns_publish_logs ADD COLUMN retry_count INTEGER;
ALTER TABLE sns_publish_logs ADD COLUMN meta_error_code INTEGER;
ALTER TABLE sns_publish_logs ADD COLUMN meta_error_subcode INTEGER;

CREATE INDEX IF NOT EXISTS idx_sns_posts_container ON sns_posts(tenant_id, container_id);
