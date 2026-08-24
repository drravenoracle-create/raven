CREATE TABLE IF NOT EXISTS growth_experiment_rollback_plans (
  rollback_plan_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  experiment_id TEXT NOT NULL,
  proposal_id TEXT,
  evaluation_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  reversible INTEGER NOT NULL CHECK (reversible IN (0, 1)),
  rollback_type TEXT NOT NULL,
  steps_json TEXT NOT NULL DEFAULT '[]',
  affected_scope_json TEXT NOT NULL DEFAULT '{}',
  risk_class TEXT NOT NULL DEFAULT 'HIGH',
  approval_required INTEGER NOT NULL DEFAULT 1 CHECK (approval_required IN (0, 1)),
  approval_status TEXT NOT NULL DEFAULT 'PENDING',
  status TEXT NOT NULL DEFAULT 'DRAFT',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_rollback_plans_scope
  ON growth_experiment_rollback_plans(tenant_id, experiment_id, status, approval_status);

CREATE TABLE IF NOT EXISTS growth_experiment_feedback (
  feedback_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  evaluation_id TEXT NOT NULL,
  evidence_source_id TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('WIN', 'LOSS', 'NEUTRAL', 'INCONCLUSIVE')),
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, experiment_id, evaluation_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_feedback_scope
  ON growth_experiment_feedback(tenant_id, experiment_id, result, created_at);
