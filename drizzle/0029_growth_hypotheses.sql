CREATE TABLE IF NOT EXISTS growth_hypotheses (
  hypothesis_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  observation TEXT NOT NULL,
  hypothesis TEXT NOT NULL,
  expected_outcome TEXT NOT NULL,
  target_metric TEXT NOT NULL,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  confidence REAL,
  evidence_sufficiency TEXT NOT NULL,
  risk_class TEXT NOT NULL,
  missing_evidence_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_growth_hypotheses_tenant_status
  ON growth_hypotheses(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_growth_hypotheses_tenant_market
  ON growth_hypotheses(tenant_id, market, locale);
