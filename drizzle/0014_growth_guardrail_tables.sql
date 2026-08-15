CREATE TABLE IF NOT EXISTS growth_guardrail_results (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  result TEXT NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  policy_snapshot_json TEXT NOT NULL DEFAULT '{}',
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_kill_switches (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL DEFAULT '*',
  enabled INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  allow_analysis INTEGER NOT NULL DEFAULT 1,
  stopped_at TEXT,
  stopped_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_growth_guardrail_subject
  ON growth_guardrail_results(tenant_id, subject_type, subject_id);

INSERT INTO growth_kill_switches (id, tenant_id, scope_type, scope_id, enabled, reason)
VALUES ('raven-growth-global-stop', 'raven-oracle', 'tenant', '*', 0, 'Default active; stop external actions only when enabled.')
ON CONFLICT(tenant_id, scope_type, scope_id) DO NOTHING;
