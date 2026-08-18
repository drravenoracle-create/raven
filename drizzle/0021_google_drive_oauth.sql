CREATE TABLE IF NOT EXISTS google_drive_credentials (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  google_email TEXT NOT NULL,
  refresh_token_ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
