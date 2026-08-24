CREATE TABLE IF NOT EXISTS growth_evidence_sources (
  source_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  source_type TEXT NOT NULL,
  provider TEXT,
  source_name TEXT NOT NULL,
  source_url TEXT,
  publisher TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  published_at TEXT,
  retrieved_at TEXT,
  observed_at TEXT,
  valid_until TEXT,
  quality_score REAL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_evidence_claims (
  claim_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  evidence_scope TEXT NOT NULL,
  claim_type TEXT NOT NULL,
  statement TEXT NOT NULL,
  metric_name TEXT,
  metric_value REAL,
  unit TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  period_start TEXT,
  period_end TEXT,
  confidence REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES growth_evidence_sources(source_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_growth_evidence_sources_tenant
  ON growth_evidence_sources(tenant_id, source_type, status);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_sources_freshness
  ON growth_evidence_sources(tenant_id, retrieved_at, observed_at, valid_until);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_sources_market
  ON growth_evidence_sources(tenant_id, market, country, locale);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_claims_tenant
  ON growth_evidence_claims(tenant_id, evidence_scope, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_claims_source
  ON growth_evidence_claims(tenant_id, source_id);
CREATE INDEX IF NOT EXISTS idx_growth_evidence_claims_market
  ON growth_evidence_claims(tenant_id, market, country, locale);
