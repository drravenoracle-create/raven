CREATE TABLE IF NOT EXISTS sns_ideas (
  idea_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  character_id TEXT,
  locale TEXT NOT NULL DEFAULT 'ja',
  platform TEXT NOT NULL DEFAULT 'auto',
  title TEXT NOT NULL,
  concept TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '総合',
  content_type TEXT NOT NULL DEFAULT 'one_card',
  hook TEXT NOT NULL DEFAULT '',
  hook_style TEXT NOT NULL DEFAULT '',
  recommended_duration INTEGER,
  recommended_template TEXT,
  target_audience TEXT NOT NULL DEFAULT '',
  primary_goal TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  evidence_summary TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  novelty_score REAL,
  expected_potential TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  confidence REAL,
  mode TEXT NOT NULL DEFAULT 'BALANCED',
  status TEXT NOT NULL DEFAULT 'SUGGESTED',
  source_type TEXT NOT NULL DEFAULT 'rule_and_ai',
  adopted_post_id TEXT,
  produced_post_id TEXT,
  experiment_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_idea_evidence (
  evidence_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  claim TEXT NOT NULL,
  value_json TEXT NOT NULL DEFAULT '{}',
  data_quality TEXT NOT NULL DEFAULT 'measured',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_idea_feedback (
  feedback_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idea_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason_code TEXT,
  note TEXT,
  actor TEXT NOT NULL DEFAULT 'admin',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_idea_patterns (
  pattern_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  concept TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL DEFAULT 'one_card',
  category TEXT NOT NULL DEFAULT '総合',
  default_hook_style TEXT NOT NULL DEFAULT '',
  default_goal TEXT NOT NULL DEFAULT '',
  safety_notes TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sns_ideas_tenant_status ON sns_ideas(tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_sns_ideas_tenant_context ON sns_ideas(tenant_id, locale, platform, category);
CREATE INDEX IF NOT EXISTS idx_sns_idea_evidence_idea ON sns_idea_evidence(tenant_id, idea_id, source_type);
CREATE INDEX IF NOT EXISTS idx_sns_idea_feedback_idea ON sns_idea_feedback(tenant_id, idea_id, action);
CREATE INDEX IF NOT EXISTS idx_sns_idea_patterns_enabled ON sns_idea_patterns(tenant_id, enabled, category);
