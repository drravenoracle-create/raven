CREATE TABLE IF NOT EXISTS growth_sns_content_drafts (
  draft_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idea_candidate_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY_FOR_PREVIEW', 'DISCARDED')),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  category TEXT NOT NULL,
  primary_goal TEXT NOT NULL CHECK (primary_goal IN ('VIRAL', 'CONVERSION', 'REVENUE', 'LEARNING')),
  title TEXT NOT NULL,
  hook TEXT NOT NULL,
  concept TEXT NOT NULL,
  content_type TEXT NOT NULL,
  caption TEXT NOT NULL,
  cta TEXT NOT NULL,
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  recommended_duration INTEGER NOT NULL,
  recommended_template TEXT NOT NULL,
  deck_candidate TEXT NOT NULL,
  card_selection_strategy TEXT NOT NULL,
  background_candidate TEXT NOT NULL,
  bgm_mood TEXT NOT NULL,
  what_to_test_json TEXT NOT NULL DEFAULT '[]',
  platform_content_json TEXT NOT NULL DEFAULT '{}',
  structure_json TEXT NOT NULL DEFAULT '{}',
  traceability_json TEXT NOT NULL DEFAULT '{}',
  scope_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, idea_candidate_id, version)
);

CREATE INDEX IF NOT EXISTS idx_growth_sns_content_drafts_tenant_status
  ON growth_sns_content_drafts(tenant_id, status, updated_at);
