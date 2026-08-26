-- Idempotent Sol initialization in the existing atlas-oracle Shared Core D1.
-- No Atlas rows are copied and no existing rows are updated or deleted.
PRAGMA foreign_keys = ON;

INSERT OR IGNORE INTO studioos_tenant_metadata
  (tenant_id, tenant_key, guild_id, character_id, market, country, locale, schema_version, environment, legacy_tenant_alias)
VALUES ('sol-oracle', 'sol-oracle', 'raven-guild', 'sol', 'jp', 'JP', 'ja-JP', 1, 'preview', NULL);

INSERT OR IGNORE INTO blog_engine_settings
  (tenant_id, enabled, default_author, default_locale, public_base_url)
VALUES ('sol-oracle', 1, 'Sol Aurora', 'ja-JP', 'https://sol.fortunestudios.jp');
