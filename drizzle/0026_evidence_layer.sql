CREATE TABLE IF NOT EXISTS evidence_sources (
  source_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  source_type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  uri TEXT,
  provider TEXT,
  observed_at TEXT,
  published_at TEXT,
  retrieved_at TEXT,
  valid_until TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS evidence_claims (
  claim_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  claim_type TEXT NOT NULL DEFAULT 'observation',
  statement TEXT NOT NULL,
  relevance_score REAL,
  confidence REAL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES evidence_sources(source_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_evidence_sources_scope
  ON evidence_sources(tenant_id, guild_id, market, country, locale, source_type);
CREATE INDEX IF NOT EXISTS idx_evidence_sources_freshness
  ON evidence_sources(tenant_id, observed_at, published_at, retrieved_at, valid_until);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_source
  ON evidence_claims(tenant_id, source_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_claims_scope
  ON evidence_claims(tenant_id, guild_id, market, country, locale);
