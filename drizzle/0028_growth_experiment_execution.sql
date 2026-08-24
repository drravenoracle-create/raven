CREATE TABLE IF NOT EXISTS growth_experiment_variants (
  variant_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  guild_id TEXT,
  market TEXT,
  country TEXT,
  locale TEXT,
  character_id TEXT,
  target_segment TEXT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('CONTROL', 'VARIANT')),
  configuration_json TEXT NOT NULL DEFAULT '{}',
  allocation_weight REAL NOT NULL CHECK (allocation_weight >= 0 AND allocation_weight <= 100),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (experiment_id, variant_id),
  UNIQUE (experiment_id, name)
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_variants_exp
  ON growth_experiment_variants(tenant_id, experiment_id, kind, status);

CREATE TABLE IF NOT EXISTS growth_experiment_runs (
  run_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'STARTING' CHECK (status IN ('STARTING', 'RUNNING', 'STOPPED', 'FAILED')),
  started_at TEXT,
  stopped_at TEXT,
  start_reason TEXT NOT NULL DEFAULT '',
  stop_reason TEXT NOT NULL DEFAULT '',
  preflight_result_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, run_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_runs_active
  ON growth_experiment_runs(tenant_id, experiment_id, status);

CREATE TABLE IF NOT EXISTS growth_experiment_assignments (
  assignment_id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, experiment_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_experiment_assignments_run
  ON growth_experiment_assignments(tenant_id, run_id, variant_id);
