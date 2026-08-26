PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS studioos_tenant_metadata (
  tenant_id TEXT PRIMARY KEY, tenant_key TEXT NOT NULL UNIQUE, guild_id TEXT NOT NULL,
  character_id TEXT NOT NULL, market TEXT NOT NULL, country TEXT NOT NULL,
  locale TEXT NOT NULL, schema_version INTEGER NOT NULL DEFAULT 1,
  environment TEXT NOT NULL, legacy_tenant_alias TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_studioos_tenant_guild ON studioos_tenant_metadata(guild_id);
CREATE INDEX IF NOT EXISTS idx_studioos_tenant_market ON studioos_tenant_metadata(market, locale);

CREATE TABLE IF NOT EXISTS studioos_member_context (
  member_id TEXT NOT NULL, tenant_id TEXT NOT NULL, guild_id TEXT NOT NULL,
  character_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (member_id, tenant_id), FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_studioos_member_tenant ON studioos_member_context(tenant_id, member_id);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, event_name TEXT NOT NULL,
  event_namespace TEXT NOT NULL, path TEXT, session_id TEXT, member_id TEXT,
  payload_json TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_events_tenant_time ON analytics_events(tenant_id, created_at);

CREATE TABLE IF NOT EXISTS blog_engine_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
  default_author TEXT, default_locale TEXT, public_base_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS blog_engine_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, slug TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT, locale TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, slug), FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_blog_articles_tenant_status ON blog_engine_articles(tenant_id, status);

CREATE TABLE IF NOT EXISTS sns_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, provider TEXT,
  external_post_id TEXT, status TEXT NOT NULL DEFAULT 'draft', locale TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS reel_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, storage_namespace TEXT NOT NULL,
  public_url TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_metric_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT, tenant_id TEXT NOT NULL, metric_name TEXT NOT NULL,
  metric_value REAL, observed_at TEXT, source TEXT, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_evidence_sources (
  source_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, source_type TEXT NOT NULL,
  provider TEXT, source_name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
  retrieved_at TEXT, observed_at TEXT, quality_score REAL,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_evidence_claims (
  claim_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, source_id TEXT NOT NULL,
  evidence_scope TEXT NOT NULL, statement TEXT NOT NULL, metric_name TEXT,
  metric_value REAL, confidence REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id), FOREIGN KEY (source_id) REFERENCES growth_evidence_sources(source_id)
);
CREATE TABLE IF NOT EXISTS growth_hypotheses (
  hypothesis_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, observation TEXT NOT NULL,
  hypothesis TEXT NOT NULL, confidence REAL, status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_proposals (
  proposal_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, hypothesis_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'review_required', risk_class TEXT NOT NULL,
  execution_allowed INTEGER NOT NULL DEFAULT 0 CHECK (execution_allowed = 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id), FOREIGN KEY (hypothesis_id) REFERENCES growth_hypotheses(hypothesis_id)
);
CREATE TABLE IF NOT EXISTS growth_experiments (
  experiment_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, proposal_id TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT', requires_start_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_start_approval = 1),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_knowledge_items (
  knowledge_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft',
  learning TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_memory (
  memory_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, proposal_id TEXT, experiment_id TEXT,
  predicted_value REAL, actual_value REAL, absolute_error REAL, relative_error REAL,
  reusable INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE TABLE IF NOT EXISTS growth_precision_snapshots (
  snapshot_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, sample_size INTEGER NOT NULL DEFAULT 0,
  calibration_status TEXT NOT NULL DEFAULT 'insufficient_learning', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES studioos_tenant_metadata(tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_growth_source_tenant ON growth_evidence_sources(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_claim_tenant ON growth_evidence_claims(tenant_id, evidence_scope);
CREATE INDEX IF NOT EXISTS idx_growth_hypothesis_tenant ON growth_hypotheses(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_growth_proposal_tenant ON growth_proposals(tenant_id, status);

INSERT OR IGNORE INTO studioos_tenant_metadata
  (tenant_id, tenant_key, guild_id, character_id, market, country, locale, schema_version, environment, legacy_tenant_alias)
VALUES ('scarlet-donovan', 'scarlet-donovan', 'raven-guild', 'scarlet', 'jp', 'JP', 'ja-JP', 1, 'fixture', 'scarlet-guardian');
