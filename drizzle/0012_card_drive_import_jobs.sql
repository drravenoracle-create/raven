CREATE TABLE IF NOT EXISTS card_drive_import_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  source_folder_id TEXT NOT NULL DEFAULT '',
  source_folder_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  duplicate_policy TEXT NOT NULL DEFAULT 'skip',
  total_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_card_drive_import_jobs_tenant_deck
  ON card_drive_import_jobs(tenant_id, deck_id, created_at);

CREATE TABLE IF NOT EXISTS card_drive_import_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  drive_file_id TEXT NOT NULL,
  drive_file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  card_number INTEGER NOT NULL DEFAULT 0,
  card_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  storage_key TEXT NOT NULL DEFAULT '',
  asset_id TEXT NOT NULL DEFAULT '',
  card_id TEXT NOT NULL DEFAULT '',
  error_message TEXT NOT NULL DEFAULT '',
  imported_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_drive_import_items_job
  ON card_drive_import_items(tenant_id, job_id, created_at);

CREATE INDEX IF NOT EXISTS idx_card_drive_import_items_file
  ON card_drive_import_items(tenant_id, deck_id, drive_file_id, status);

-- Additive migration only. Drive originals are not modified; D1 stores metadata and storage references only.
