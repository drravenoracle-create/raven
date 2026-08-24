ALTER TABLE growth_experiment_metrics ADD COLUMN run_id TEXT;
ALTER TABLE growth_experiment_metrics ADD COLUMN variant_id TEXT;
ALTER TABLE growth_experiment_metrics ADD COLUMN availability TEXT NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE growth_experiment_metrics ADD COLUMN measured_at TEXT;
ALTER TABLE growth_experiment_metrics ADD COLUMN idempotency_key TEXT;

CREATE INDEX IF NOT EXISTS idx_growth_experiment_metrics_run_variant
  ON growth_experiment_metrics(tenant_id, experiment_id, run_id, variant_id, metric_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_experiment_metrics_idempotency
  ON growth_experiment_metrics(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
