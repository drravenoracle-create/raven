CREATE TABLE IF NOT EXISTS growth_sns_idea_candidates (
  idea_candidate_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_recommendation_id TEXT NOT NULL,
  source_pattern_key TEXT NOT NULL,
  state_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SUGGESTED' CHECK (status IN ('SUGGESTED', 'SAVED', 'DISMISSED')),
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('VIRAL', 'CONVERSION', 'REVENUE', 'LEARNING')),
  category TEXT NOT NULL,
  topic TEXT NOT NULL,
  hook_style TEXT NOT NULL,
  cta TEXT NOT NULL,
  template TEXT NOT NULL,
  variation_json TEXT NOT NULL DEFAULT '{}',
  experimentability_json TEXT NOT NULL DEFAULT '{}',
  novelty REAL NOT NULL CHECK (novelty >= 0 AND novelty <= 1),
  confidence REAL NOT NULL,
  maturity TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, source_recommendation_id, state_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_growth_sns_idea_candidates_scope
  ON growth_sns_idea_candidates(tenant_id, status, primary_goal);
