ALTER TABLE analytics_events ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE analytics_events ADD COLUMN cf_colo TEXT NOT NULL DEFAULT '';
ALTER TABLE analytics_events ADD COLUMN region TEXT NOT NULL DEFAULT '';
ALTER TABLE analytics_events ADD COLUMN city TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_country
  ON analytics_events(tenant_id, country, created_at);

