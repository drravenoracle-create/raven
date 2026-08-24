ALTER TABLE growth_knowledge_items ADD COLUMN proposal_id TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN experiment_id TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN hypothesis_id TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN action_type TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN action_signature TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN result_status TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN success_level TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN predicted_outcome TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN predicted_value REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN actual_value REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN prediction_error REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN absolute_error REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN relative_error REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN direction_predicted TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN direction_actual TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN direction_correct INTEGER;
ALTER TABLE growth_knowledge_items ADD COLUMN confidence_at_proposal REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN confidence_after_result REAL;
ALTER TABLE growth_knowledge_items ADD COLUMN market TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN country TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN locale TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN reusable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE growth_knowledge_items ADD COLUMN suppressed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE growth_knowledge_items ADD COLUMN suppression_reason TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN superseded_by TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN reused_from TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN reused_at TEXT;
ALTER TABLE growth_knowledge_items ADD COLUMN reuse_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE growth_knowledge_items ADD COLUMN updated_at TEXT;

CREATE INDEX IF NOT EXISTS idx_growth_knowledge_tenant_signature
  ON growth_knowledge_items(tenant_id, action_signature, result_status);
CREATE INDEX IF NOT EXISTS idx_growth_knowledge_experiment
  ON growth_knowledge_items(tenant_id, experiment_id);
CREATE INDEX IF NOT EXISTS idx_growth_knowledge_proposal
  ON growth_knowledge_items(tenant_id, proposal_id);

CREATE TABLE IF NOT EXISTS growth_memory_relations (
  relation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_knowledge_id TEXT NOT NULL,
  target_knowledge_id TEXT,
  relation_type TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_memory_relations_source
  ON growth_memory_relations(tenant_id, source_knowledge_id, relation_type);

CREATE TABLE IF NOT EXISTS growth_precision_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_type TEXT NOT NULL DEFAULT 'tenant',
  scope_id TEXT NOT NULL DEFAULT '*',
  period_start TEXT,
  period_end TEXT,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_precision_scope
  ON growth_precision_snapshots(tenant_id, scope_type, scope_id, created_at);
