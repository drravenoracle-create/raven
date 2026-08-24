CREATE TABLE IF NOT EXISTS growth_proposals (
  proposal_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  hypothesis_id TEXT NOT NULL,
  proposal_type TEXT NOT NULL DEFAULT 'hypothesis_candidate',
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  rationale TEXT NOT NULL,
  expected_outcome TEXT,
  target_metric TEXT,
  confidence REAL NOT NULL,
  risk_class TEXT NOT NULL,
  evidence_ids_json TEXT NOT NULL DEFAULT '[]',
  missing_evidence_json TEXT NOT NULL DEFAULT '[]',
  market TEXT,
  country TEXT,
  locale TEXT,
  status TEXT NOT NULL DEFAULT 'review_required',
  execution_allowed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT,
  reviewed_by TEXT,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_proposals_tenant_status
  ON growth_proposals(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_growth_proposals_hypothesis
  ON growth_proposals(tenant_id, hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_growth_proposals_risk
  ON growth_proposals(tenant_id, risk_class, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_proposals_active_hypothesis
  ON growth_proposals(tenant_id, hypothesis_id, proposal_type)
  WHERE status IN ('draft', 'review_required', 'approved', 'deferred');
