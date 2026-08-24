CREATE TABLE IF NOT EXISTS opening_campaigns (
  campaign_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  campaign_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  start_at TEXT,
  end_at TEXT,
  trial_enabled INTEGER NOT NULL DEFAULT 1,
  trial_scope TEXT NOT NULL DEFAULT 'member',
  trial_limit INTEGER NOT NULL DEFAULT 1,
  campaign_message TEXT NOT NULL DEFAULT '',
  primary_cta TEXT NOT NULL DEFAULT '',
  secondary_cta TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opening_campaign_members (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  trial_type TEXT NOT NULL DEFAULT 'opening_campaign',
  trial_start_at TEXT,
  trial_end_at TEXT,
  trial_usage_limit INTEGER NOT NULL DEFAULT 1,
  trial_used_count INTEGER NOT NULL DEFAULT 0,
  trial_status TEXT NOT NULL DEFAULT 'inactive',
  converted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, member_id)
);

CREATE TABLE IF NOT EXISTS opening_campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  member_id TEXT,
  event_name TEXT NOT NULL,
  event_key TEXT NOT NULL UNIQUE,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_opening_campaign_members_campaign ON opening_campaign_members(campaign_id, trial_status);
CREATE INDEX IF NOT EXISTS idx_opening_campaign_events_campaign ON opening_campaign_events(campaign_id, event_name, created_at);
