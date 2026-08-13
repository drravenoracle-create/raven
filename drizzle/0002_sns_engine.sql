CREATE TABLE IF NOT EXISTS sns_posts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  post_type TEXT NOT NULL DEFAULT 'image',
  title TEXT NOT NULL,
  theme TEXT,
  category TEXT,
  character TEXT,
  purpose TEXT,
  cta TEXT,
  caption TEXT,
  hashtags TEXT,
  script TEXT,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  external_post_id TEXT,
  external_post_url TEXT,
  ai_generated INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  duplicate_warning TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_publish_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  sns_post_id TEXT,
  platform TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  response_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  impressions INTEGER,
  reach INTEGER,
  likes INTEGER,
  comments INTEGER,
  saves INTEGER,
  shares INTEGER,
  plays INTEGER,
  watch_time INTEGER,
  profile_visits INTEGER,
  link_clicks INTEGER,
  follower_delta INTEGER,
  fetched_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_ai_settings (
  tenant_id TEXT PRIMARY KEY,
  brand_name TEXT NOT NULL,
  character_name TEXT,
  character_personality TEXT,
  tone TEXT,
  target_audience TEXT,
  prohibited_topics TEXT,
  preferred_topics TEXT,
  default_cta TEXT,
  default_hashtags TEXT,
  system_prompt TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_automation_settings (
  tenant_id TEXT PRIMARY KEY,
  automation_level INTEGER NOT NULL DEFAULT 0,
  min_post_interval_minutes INTEGER NOT NULL DEFAULT 180,
  emergency_stop_all INTEGER NOT NULL DEFAULT 0,
  emergency_stop_platforms TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_posts_tenant_status ON sns_posts(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_sns_posts_schedule ON sns_posts(tenant_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_sns_logs_post ON sns_publish_logs(tenant_id, sns_post_id);

INSERT INTO sns_ai_settings (
  tenant_id, brand_name, character_name, character_personality, tone, target_audience,
  prohibited_topics, preferred_topics, default_cta, default_hashtags, system_prompt
) VALUES (
  'raven-oracle',
  'Raven Oracle',
  'Raven Blackwood',
  '静かで知的。相談者の選択を奪わず、文面と感情を整理する。',
  '落ち着いた、実用的、押しつけない',
  '恋愛・仕事・人間関係の文面相談で迷っている人',
  '断定的な未来予言,医療法律金融の専門助言,恐怖訴求,依存誘導',
  'テキスト鑑定,時間制チャット,返信前チェック,相談整理',
  '必要なら、Raven Blackwoodのテキスト鑑定で一緒に整理します。',
  '#RavenOracle #RavenBlackwood #文章鑑定 #相談整理 #返信前チェック',
  'Raven OracleのSNS投稿を作成する。断定せず、相談者の主体性を守る。'
) ON CONFLICT(tenant_id) DO NOTHING;

INSERT INTO sns_automation_settings (tenant_id, automation_level, emergency_stop_all)
VALUES ('raven-oracle', 0, 0)
ON CONFLICT(tenant_id) DO NOTHING;
