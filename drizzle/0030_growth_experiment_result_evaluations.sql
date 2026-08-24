CREATE TABLE IF NOT EXISTS growth_experiment_result_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  candidate_result TEXT NOT NULL CHECK (candidate_result IN ('WIN', 'LOSS', 'NEUTRAL', 'INCONCLUSIVE')),
  stop_recommendation TEXT NOT NULL DEFAULT 'CONTINUE',
  primary_metric TEXT NOT NULL,
  control_value REAL,
  variant_value REAL,
  absolute_difference REAL,
  relative_difference REAL,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence REAL,
  guardrail_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  reasons_json TEXT NOT NULL DEFAULT '[]',
  blockers_json TEXT NOT NULL DEFAULT '[]',
  source_measurements_json TEXT NOT NULL DEFAULT '[]',
  measurement_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CANDIDATE',
  evaluated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  confirmed_by TEXT,
  confirmed_at TEXT,
  confirmation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_result_evaluations_exp
  ON growth_experiment_result_evaluations(tenant_id, experiment_id, status, evaluated_at);
