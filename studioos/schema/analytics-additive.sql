-- Additive StudioOS Analytics extension for the existing fortune-studio-analytics D1.
-- This file intentionally does not alter, rename, or remove existing tables.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  event_name TEXT NOT NULL,
  event_namespace TEXT NOT NULL,
  path TEXT,
  session_id TEXT,
  member_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(guild_id)) > 0),
  CHECK (length(trim(tenant_id)) > 0),
  CHECK (length(trim(character_id)) > 0),
  CHECK (length(trim(market)) > 0),
  CHECK (length(trim(locale)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_studioos_analytics_tenant_time
  ON analytics_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_studioos_analytics_scope
  ON analytics_events(guild_id, tenant_id, character_id, market, locale, created_at);

CREATE TABLE IF NOT EXISTS studioos_analytics_tenants (
  tenant_id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  market TEXT NOT NULL,
  locale TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(tenant_id)) > 0),
  UNIQUE (guild_id, tenant_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_studioos_analytics_tenants_scope
  ON studioos_analytics_tenants(guild_id, tenant_id, character_id);
