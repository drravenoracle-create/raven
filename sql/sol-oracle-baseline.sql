-- Sol production baseline. Tenant-scoped tables only; no Raven/Atlas data.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS studioos_tenant_metadata (tenant_id TEXT PRIMARY KEY, tenant_key TEXT NOT NULL UNIQUE, guild_id TEXT NOT NULL, character_id TEXT NOT NULL, market TEXT NOT NULL, country TEXT NOT NULL, locale TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1, environment TEXT NOT NULL, legacy_tenant_alias TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, event_name TEXT NOT NULL, event_namespace TEXT NOT NULL, path TEXT, session_id TEXT, member_id TEXT, payload_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events(tenant_id, created_at);
CREATE TABLE IF NOT EXISTS blog_engine_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1, default_author TEXT, default_locale TEXT, public_base_url TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS blog_engine_articles (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, slug TEXT NOT NULL, title TEXT NOT NULL, body TEXT, locale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', published_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (tenant_id, slug));
CREATE INDEX IF NOT EXISTS idx_blog_articles_tenant_status ON blog_engine_articles(tenant_id, status);
CREATE TABLE IF NOT EXISTS growth_metric_points (id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, metric_name TEXT NOT NULL, metric_value REAL, observed_at TEXT, source TEXT);
INSERT OR IGNORE INTO studioos_tenant_metadata (tenant_id, tenant_key, guild_id, character_id, market, country, locale, schema_version, environment) VALUES ('sol-oracle', 'sol-oracle', 'raven-guild', 'sol', 'jp', 'JP', 'ja-JP', 1, 'production');
INSERT OR IGNORE INTO blog_engine_settings (tenant_id, enabled, default_author, default_locale, public_base_url) VALUES ('sol-oracle', 1, 'Sol Aurora', 'ja-JP', 'https://sol.fortunestudios.jp');
