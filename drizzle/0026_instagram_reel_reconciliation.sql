ALTER TABLE sns_posts ADD COLUMN meta_status TEXT;
ALTER TABLE sns_posts ADD COLUMN reconciliation_reason TEXT;
ALTER TABLE sns_posts ADD COLUMN reconciliation_required_at TEXT;
ALTER TABLE sns_posts ADD COLUMN reconciliation_resolved_at TEXT;
