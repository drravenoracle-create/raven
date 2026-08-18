CREATE TABLE IF NOT EXISTS sns_video_topics (
  topic_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_hint TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_hooks (
  hook_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  topic_id TEXT,
  text TEXT NOT NULL,
  hook_style TEXT NOT NULL DEFAULT '',
  generation_model TEXT NOT NULL DEFAULT 'local-template',
  experiment_id TEXT,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_readings (
  reading_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_id TEXT,
  card_id TEXT NOT NULL,
  card_name TEXT NOT NULL,
  interpretation TEXT NOT NULL DEFAULT '',
  short_result TEXT NOT NULL,
  theme TEXT NOT NULL,
  character TEXT NOT NULL DEFAULT 'raven',
  tone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_templates (
  template_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'GLOBAL',
  name TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 20,
  width INTEGER NOT NULL DEFAULT 1080,
  height INTEGER NOT NULL DEFAULT 1920,
  layout_json TEXT NOT NULL DEFAULT '{}',
  background_rules_json TEXT NOT NULL DEFAULT '{}',
  bgm_rules_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_backgrounds (
  background_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'GLOBAL',
  file TEXT NOT NULL,
  category TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  duration REAL,
  resolution TEXT NOT NULL DEFAULT '1080x1920',
  enabled INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_bgm (
  bgm_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'GLOBAL',
  file TEXT NOT NULL,
  title TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  duration REAL,
  volume_default REAL NOT NULL DEFAULT 0.35,
  license_information TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  usage_count INTEGER NOT NULL DEFAULT 0,
  performance_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_variants (
  variant_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  experiment_id TEXT NOT NULL,
  video_job_id TEXT,
  topic_id TEXT,
  hook_id TEXT,
  hook_text TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  background_id TEXT,
  bgm_id TEXT,
  template_id TEXT NOT NULL DEFAULT 'raven_three_choice_v1',
  character_id TEXT NOT NULL DEFAULT 'raven',
  variant_label TEXT NOT NULL,
  condition_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_performance_metrics (
  metric_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_job_id TEXT,
  variant_id TEXT,
  platform TEXT NOT NULL DEFAULT 'instagram',
  impressions INTEGER,
  views INTEGER,
  three_second_views INTEGER,
  watch_time REAL,
  average_watch_time REAL,
  completion_rate REAL,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  saves INTEGER,
  profile_visits INTEGER,
  link_clicks INTEGER,
  follows INTEGER,
  conversion INTEGER,
  revenue REAL,
  viral_score REAL,
  conversion_score REAL,
  performance_score REAL,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_winning_patterns (
  pattern_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  topic_category TEXT NOT NULL,
  hook_style TEXT NOT NULL,
  background_id TEXT,
  bgm_id TEXT,
  template_id TEXT NOT NULL DEFAULT 'raven_three_choice_v1',
  cta TEXT NOT NULL DEFAULT '',
  performance_summary TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  source_experiment_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_generation_costs (
  cost_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  video_job_id TEXT,
  provider TEXT NOT NULL,
  action TEXT NOT NULL,
  model TEXT,
  llm_cost REAL NOT NULL DEFAULT 0,
  image_cost REAL NOT NULL DEFAULT 0,
  video_rendering_cost REAL NOT NULL DEFAULT 0,
  storage_cost REAL NOT NULL DEFAULT 0,
  api_cost REAL NOT NULL DEFAULT 0,
  estimated_total_cost REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_video_settings (
  tenant_id TEXT PRIMARY KEY,
  auto_video_generation TEXT NOT NULL DEFAULT 'DRAFT',
  exploration_rate REAL NOT NULL DEFAULT 0.2,
  duplicate_similarity_threshold REAL NOT NULL DEFAULT 0.82,
  default_character_id TEXT NOT NULL DEFAULT 'raven',
  content_safety_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_video_topics_tenant_category ON sns_video_topics(tenant_id, category, enabled);
CREATE INDEX IF NOT EXISTS idx_sns_video_hooks_topic ON sns_video_hooks(tenant_id, topic_id, performance_score);
CREATE INDEX IF NOT EXISTS idx_sns_video_variants_exp ON sns_video_variants(tenant_id, experiment_id, status);
CREATE INDEX IF NOT EXISTS idx_sns_video_metrics_variant ON sns_video_performance_metrics(tenant_id, variant_id, fetched_at);
CREATE INDEX IF NOT EXISTS idx_sns_winning_patterns_tenant ON sns_winning_patterns(tenant_id, character_id, topic_category, status);

INSERT OR IGNORE INTO sns_video_settings (tenant_id, auto_video_generation, exploration_rate, duplicate_similarity_threshold, default_character_id, content_safety_json)
VALUES ('raven-oracle', 'DRAFT', 0.2, 0.82, 'raven', '{"avoid":["death","medical","legal","investment","crime","pregnancy"],"mode":"entertainment_and_reflection"}');

INSERT OR IGNORE INTO sns_video_templates (template_id, tenant_id, name, duration, width, height, layout_json)
VALUES (
  'raven_three_choice_v1',
  'GLOBAL',
  '20秒3択リーディング',
  20,
  1080,
  1920,
  '{"safe_area":{"top":180,"bottom":260,"left":72,"right":72},"timeline":[{"id":"hook","start":0,"end":2},{"id":"choice","start":2,"end":5},{"id":"result-a","start":5,"end":9},{"id":"result-b","start":9,"end":13},{"id":"result-c","start":13,"end":17},{"id":"cta","start":17,"end":20}]}'
);

INSERT OR IGNORE INTO sns_video_backgrounds (background_id, tenant_id, file, category, tags, duration, resolution)
VALUES
  ('raven-bg-dark-moon', 'raven-oracle', 'media://raven/backgrounds/dark-moon', '月', 'moon,night,love,secret', 20, '1080x1920'),
  ('raven-bg-candle-table', 'raven-oracle', 'media://raven/backgrounds/candle-table', 'キャンドル', 'tarot,oracle,calm', 20, '1080x1920'),
  ('raven-bg-rain-window', 'raven-oracle', 'media://raven/backgrounds/rain-window', '雨', 'rain,quiet,reflection', 20, '1080x1920');

INSERT OR IGNORE INTO sns_video_bgm (bgm_id, tenant_id, file, title, mood, tags, duration, volume_default, license_information)
VALUES
  ('raven-bgm-soft-night', 'raven-oracle', 'media://raven/bgm/soft-night', 'Soft Night', '静か', 'night,calm,oracle', 20, 0.32, 'owned_or_royalty_free_required'),
  ('raven-bgm-mystic-pulse', 'raven-oracle', 'media://raven/bgm/mystic-pulse', 'Mystic Pulse', '神秘的', 'mystic,reels,shorts', 20, 0.28, 'owned_or_royalty_free_required');

INSERT OR IGNORE INTO sns_video_topics (topic_id, tenant_id, category, title, prompt_hint)
VALUES
  ('raven-topic-love-secret-feelings', 'raven-oracle', 'love', 'あの人が今、あなたに隠している本音', '秘密系HOOK。断定せず、相手の気持ちの可能性を短く示す。'),
  ('raven-topic-love-message-soon', 'raven-oracle', 'love', '近いうちにあなたへ届く嬉しい知らせ', '期待を煽りすぎず、行動の選択肢へつなげる。'),
  ('raven-topic-work-next-change', 'raven-oracle', 'work', '近いうちに起きる仕事の変化', '現実的な次の一手に落とす。'),
  ('raven-topic-money-flow', 'raven-oracle', 'money', '今月のお金の流れ', '投資助言にならない範囲で整える。'),
  ('raven-topic-daily-message', 'raven-oracle', 'daily_message', '今日あなたに必要な言葉', '短い支えと行動を示す。');
