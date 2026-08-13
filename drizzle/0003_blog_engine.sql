CREATE TABLE IF NOT EXISTS blog_engine_settings (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  auto_post_enabled INTEGER NOT NULL DEFAULT 0,
  posting_mode TEXT NOT NULL DEFAULT 'approval',
  kill_switch INTEGER NOT NULL DEFAULT 0,
  optimization_kill_switch INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  schedule_json TEXT NOT NULL DEFAULT '{"weekdays":[0,1,2,3,4,5,6],"draft_time":"13:00","publish_time":"17:00","times":["17:00"],"max_posts_per_day":1,"max_posts_per_week":7,"minimum_interval_minutes":240}',
  category_ratios_json TEXT NOT NULL DEFAULT '{}',
  strategy_weights_json TEXT NOT NULL DEFAULT '{"organic":0.3,"social":0.2,"engagement":0.2,"conversion":0.2,"freshness":0.1}',
  automation_levels_json TEXT NOT NULL DEFAULT '{"analytics_collection":true,"recommendation_generation":true,"article_generation":false,"refresh_generation":false,"internal_link_application":false,"schedule_optimization":false,"auto_publish":false}',
  guardrails_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_articles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  primary_keyword TEXT NOT NULL DEFAULT '',
  secondary_keywords_json TEXT NOT NULL DEFAULT '[]',
  search_intent TEXT NOT NULL DEFAULT '',
  target_reader TEXT NOT NULL DEFAULT '',
  outline_json TEXT NOT NULL DEFAULT '[]',
  seo_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  canonical_url TEXT NOT NULL DEFAULT '',
  og_title TEXT NOT NULL DEFAULT '',
  og_description TEXT NOT NULL DEFAULT '',
  faq_json TEXT NOT NULL DEFAULT '[]',
  internal_links_json TEXT NOT NULL DEFAULT '[]',
  related_articles_json TEXT NOT NULL DEFAULT '[]',
  key_message TEXT NOT NULL DEFAULT '',
  recommended_social_angle TEXT NOT NULL DEFAULT 'educational',
  quality_score INTEGER NOT NULL DEFAULT 0,
  brand_score INTEGER NOT NULL DEFAULT 100,
  safety_score INTEGER NOT NULL DEFAULT 100,
  quality_report_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  created_by TEXT NOT NULL DEFAULT 'blog-engine',
  generation_version TEXT NOT NULL DEFAULT 'blog-engine-v1.0',
  content_version INTEGER NOT NULL DEFAULT 1,
  retry_count INTEGER NOT NULL DEFAULT 0,
  idempotency_key TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS blog_engine_generation_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  provider TEXT NOT NULL DEFAULT 'mock',
  model TEXT NOT NULL DEFAULT 'mock-blog-engine',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_events (
  event_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL DEFAULT '1.0',
  event_type TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  article_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_engine_article_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  page_views INTEGER,
  users INTEGER,
  sessions INTEGER,
  organic_traffic INTEGER,
  social_referral INTEGER,
  search_impressions INTEGER,
  search_clicks INTEGER,
  ctr REAL,
  average_engagement_time INTEGER,
  cta_clicks INTEGER,
  conversion_events INTEGER,
  performance_score REAL,
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  data_quality TEXT NOT NULL DEFAULT 'partial',
  sample_size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_topic_scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  primary_keyword TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  cannibalization_risk REAL NOT NULL DEFAULT 0,
  novelty_score REAL NOT NULL DEFAULT 0,
  brand_fit_score REAL NOT NULL DEFAULT 100,
  confidence REAL NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_strategy_memories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  period_start TEXT,
  period_end TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT 'strategy-memory-v2.0',
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_improvement_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT,
  recommendation_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '{}',
  expected_effect TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'low',
  rollback_plan TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'proposed',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_engine_refresh_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  target_sections_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'queued',
  old_version INTEGER,
  new_version INTEGER,
  diff_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_engine_experiments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT,
  hypothesis TEXT NOT NULL,
  variant TEXT NOT NULL,
  metric TEXT NOT NULL,
  start_at TEXT,
  end_at TEXT,
  result TEXT,
  winner TEXT,
  sample_size INTEGER NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_cta_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  cta_id TEXT NOT NULL,
  impressions INTEGER,
  clicks INTEGER,
  conversions INTEGER,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_content_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  content_version INTEGER NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  change_reason TEXT NOT NULL DEFAULT '',
  changed_by TEXT NOT NULL DEFAULT 'blog-engine',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_social_contents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_article_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  angle TEXT NOT NULL,
  content TEXT NOT NULL,
  media_refs_json TEXT NOT NULL DEFAULT '[]',
  cta TEXT NOT NULL DEFAULT '',
  scheduled_at TEXT,
  published_at TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  generation_version TEXT NOT NULL DEFAULT 'blog-sns-link-v1.0',
  campaign_id TEXT,
  tracking_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_social_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  social_content_id TEXT NOT NULL,
  source_article_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  impressions INTEGER,
  reach INTEGER,
  views INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  profile_actions INTEGER,
  link_clicks INTEGER,
  ctr REAL,
  video_watch_seconds INTEGER,
  follower_delta INTEGER,
  referral_sessions INTEGER,
  conversion_events INTEGER,
  attribution_type TEXT NOT NULL DEFAULT 'unknown',
  data_quality TEXT NOT NULL DEFAULT 'partial',
  sample_size INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_content_growth_scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_article_id TEXT NOT NULL,
  organic_score REAL NOT NULL DEFAULT 0,
  social_score REAL NOT NULL DEFAULT 0,
  engagement_score REAL NOT NULL DEFAULT 0,
  conversion_score REAL NOT NULL DEFAULT 0,
  evergreen_score REAL NOT NULL DEFAULT 0,
  freshness_score REAL NOT NULL DEFAULT 0,
  growth_velocity REAL NOT NULL DEFAULT 0,
  total_score REAL NOT NULL DEFAULT 0,
  score_breakdown_json TEXT NOT NULL DEFAULT '{}',
  data_quality TEXT NOT NULL DEFAULT 'partial',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blog_engine_optimization_guard (
  tenant_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  mode TEXT NOT NULL DEFAULT 'recommend',
  brand_score_threshold INTEGER NOT NULL DEFAULT 80,
  safety_score_threshold INTEGER NOT NULL DEFAULT 90,
  exploit_ratio INTEGER NOT NULL DEFAULT 70,
  develop_ratio INTEGER NOT NULL DEFAULT 20,
  explore_ratio INTEGER NOT NULL DEFAULT 10,
  max_posts_per_day INTEGER NOT NULL DEFAULT 1,
  max_posts_per_week INTEGER NOT NULL DEFAULT 3,
  max_reposts_per_article INTEGER NOT NULL DEFAULT 3,
  max_generated_variants INTEGER NOT NULL DEFAULT 5,
  change_budget_json TEXT NOT NULL DEFAULT '{"weekly_category_shift":10,"weekly_cta_changes":2}',
  cooldown_hours INTEGER NOT NULL DEFAULT 72,
  locked_settings_json TEXT NOT NULL DEFAULT '{}',
  paused_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_engine_articles_tenant_status ON blog_engine_articles(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_engine_events_tenant_status ON blog_engine_events(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_blog_engine_metrics_article ON blog_engine_article_metrics(tenant_id, article_id);
CREATE INDEX IF NOT EXISTS idx_blog_engine_social_article ON blog_engine_social_contents(tenant_id, source_article_id);
CREATE INDEX IF NOT EXISTS idx_blog_engine_social_metrics_article ON blog_engine_social_metrics(tenant_id, source_article_id);
CREATE INDEX IF NOT EXISTS idx_blog_engine_growth_article ON blog_engine_content_growth_scores(tenant_id, source_article_id);

INSERT INTO blog_engine_settings (tenant_id, schedule_json, category_ratios_json, guardrails_json)
VALUES (
  'raven-oracle',
  '{"weekdays":[0,1,2,3,4,5,6],"draft_time":"13:00","publish_time":"17:00","times":["17:00"],"max_posts_per_day":1,"max_posts_per_week":7,"minimum_interval_minutes":240,"daily_series":[{"id":"homepage-benefits","title":"\u5360\u3044\u5e2b\u304c\u30db\u30fc\u30e0\u30da\u30fc\u30b8\u3092\u6301\u3064\u30e1\u30ea\u30c3\u30c8","category":"\u5360\u3044\u5e2b\u304c\u30db\u30fc\u30e0\u30da\u30fc\u30b8\u3092\u6301\u3064\u30e1\u30ea\u30c3\u30c8","draft_time":"13:00","publish_time":"17:00","frequency":"daily","enabled":true}]}',
  '{"今日・今週・今月の運勢":15,"占術解説":15,"仕事運・金運":10,"恋愛・人間関係":10,"意思決定・人生相談":15,"東洋占術／戦略占術":15,"Raven Oracle世界観・ギルドの日常":5,"初心者向け占い解説":10,"鑑定サービス紹介":5}',
  '{"prohibited":["恐怖訴求","依存誘導","未来の断定","誇大広告","未確認事実の断定"],"principle":"占いは未来を決めつけるものではなく、未来を選ぶ助け"}'
)
ON CONFLICT(tenant_id) DO NOTHING;

INSERT INTO blog_engine_optimization_guard (tenant_id, locked_settings_json)
VALUES (
  'raven-oracle',
  '{"brand_principle":"占いは未来を決めつけるものではなく、未来を選ぶ助け","human_override":true,"approval_required_for_high_risk":true}'
)
ON CONFLICT(tenant_id) DO NOTHING;
