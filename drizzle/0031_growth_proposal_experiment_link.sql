ALTER TABLE growth_experiments ADD COLUMN proposal_id TEXT;
ALTER TABLE growth_experiments ADD COLUMN hypothesis_id TEXT;
ALTER TABLE growth_experiments ADD COLUMN risk_class TEXT;
ALTER TABLE growth_experiments ADD COLUMN market TEXT;
ALTER TABLE growth_experiments ADD COLUMN country TEXT;
ALTER TABLE growth_experiments ADD COLUMN locale TEXT;
ALTER TABLE growth_experiments ADD COLUMN requires_start_approval INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_growth_experiments_proposal
  ON growth_experiments(tenant_id, proposal_id);
CREATE INDEX IF NOT EXISTS idx_growth_experiments_hypothesis
  ON growth_experiments(tenant_id, hypothesis_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_experiments_active_proposal
  ON growth_experiments(tenant_id, proposal_id)
  WHERE proposal_id IS NOT NULL
    AND status IN ('DRAFT', 'PROPOSED', 'WAITING_APPROVAL', 'APPROVED', 'RUNNING', 'PAUSED', 'MEASURING');
