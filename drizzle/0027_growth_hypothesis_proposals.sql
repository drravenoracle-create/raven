CREATE TABLE IF NOT EXISTS growth_hypotheses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  character_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  statement TEXT NOT NULL,
  target_segment TEXT NOT NULL DEFAULT '',
  target_metric TEXT NOT NULL,
  expected_direction TEXT NOT NULL CHECK (expected_direction IN ('INCREASE', 'DECREASE', 'MAINTAIN')),
  evidence_sufficiency TEXT NOT NULL DEFAULT 'INSUFFICIENT',
  risk_class TEXT NOT NULL DEFAULT 'HIGH',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_hypothesis_evidence (
  id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  claim_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES growth_hypotheses(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES evidence_sources(source_id) ON DELETE CASCADE,
  FOREIGN KEY (claim_id) REFERENCES evidence_claims(claim_id) ON DELETE CASCADE,
  UNIQUE (tenant_id, hypothesis_id, source_id, claim_id)
);

CREATE TABLE IF NOT EXISTS growth_proposals (
  id TEXT PRIMARY KEY,
  hypothesis_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  character_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  proposed_action TEXT NOT NULL,
  expected_impact TEXT NOT NULL DEFAULT '',
  target_metric TEXT NOT NULL,
  expected_direction TEXT NOT NULL CHECK (expected_direction IN ('INCREASE', 'DECREASE', 'MAINTAIN')),
  reversible INTEGER NOT NULL CHECK (reversible IN (0, 1)),
  implementation_effort TEXT NOT NULL CHECK (implementation_effort IN ('LOW', 'MEDIUM', 'HIGH')),
  evidence_sufficiency TEXT NOT NULL DEFAULT 'INSUFFICIENT',
  risk_class TEXT NOT NULL DEFAULT 'HIGH',
  approval_required INTEGER NOT NULL DEFAULT 1 CHECK (approval_required IN (0, 1)),
  approval_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
  decision TEXT NOT NULL DEFAULT 'INSUFFICIENT_EVIDENCE',
  missing_evidence_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hypothesis_id) REFERENCES growth_hypotheses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_growth_hypotheses_scope
  ON growth_hypotheses(tenant_id, guild_id, market, country, locale, status);
CREATE INDEX IF NOT EXISTS idx_growth_hypothesis_evidence_hypothesis
  ON growth_hypothesis_evidence(tenant_id, hypothesis_id, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_hypothesis_evidence_source
  ON growth_hypothesis_evidence(tenant_id, source_id, claim_id);
CREATE INDEX IF NOT EXISTS idx_growth_proposals_scope
  ON growth_proposals(tenant_id, guild_id, market, country, locale, status, decision);
