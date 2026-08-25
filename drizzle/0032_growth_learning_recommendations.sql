CREATE TABLE IF NOT EXISTS growth_learning_recommendations (
  recommendation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  recommendation_type TEXT NOT NULL CHECK (recommendation_type IN ('PROVEN_REUSE', 'EMERGING_TEST', 'IMPROVEMENT_TEST', 'RETEST_DECAYING', 'COLLECT_MORE_EVIDENCE', 'AVOID_FOR_NOW')),
  priority REAL NOT NULL CHECK (priority >= 0 AND priority <= 1),
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('VIRAL', 'CONVERSION', 'REVENUE', 'LEARNING')),
  status TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN ('SUGGESTED', 'SAVED', 'DISMISSED')),
  state_fingerprint TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, pattern_key, state_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_growth_learning_recommendations_scope
  ON growth_learning_recommendations(tenant_id, status, priority DESC);
