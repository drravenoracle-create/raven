CREATE TABLE IF NOT EXISTS sns_platform_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  platform_account_id TEXT,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  scopes_json TEXT NOT NULL DEFAULT '[]',
  token_expires_at TEXT,
  last_validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_post_targets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sns_post_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  platform_post_id TEXT,
  platform_url TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  last_error_message TEXT,
  published_at TEXT,
  metrics_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_platform_settings (
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'mock',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_sns_platform_accounts_tenant ON sns_platform_accounts(tenant_id, platform, status);
CREATE INDEX IF NOT EXISTS idx_sns_post_targets_post ON sns_post_targets(tenant_id, sns_post_id, platform);

INSERT OR IGNORE INTO sns_platform_settings (tenant_id, platform, enabled, mode) VALUES
  ('raven-oracle', 'tiktok', 0, 'mock'),
  ('raven-oracle', 'youtube', 0, 'mock');
