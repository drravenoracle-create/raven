CREATE TABLE IF NOT EXISTS sns_post_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  format_type TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active',
  duration_seconds INTEGER NOT NULL DEFAULT 20,
  aspect_ratio TEXT NOT NULL DEFAULT '9:16',
  renderer_type TEXT NOT NULL DEFAULT 'video',
  scene_schema TEXT NOT NULL DEFAULT '{}',
  content_schema TEXT NOT NULL DEFAULT '{}',
  default_media TEXT NOT NULL DEFAULT '{}',
  default_cta TEXT NOT NULL DEFAULT '',
  supported_platforms TEXT NOT NULL DEFAULT '["instagram","tiktok","youtube"]',
  supported_characters TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  growth_enabled INTEGER NOT NULL DEFAULT 1,
  archived_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS sns_post_template_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sns_template_settings (
  tenant_id TEXT PRIMARY KEY,
  feature_flags TEXT NOT NULL DEFAULT '{"sns_template_manager_enabled":true,"sns_format_yes_no_enabled":true,"sns_format_one_card_enabled":true,"sns_format_ranking_enabled":true,"sns_format_card_meaning_enabled":true,"sns_format_guild_dialogue_enabled":true}',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_post_templates_tenant_status ON sns_post_templates(tenant_id, status, format_type);
CREATE INDEX IF NOT EXISTS idx_sns_post_template_versions_template ON sns_post_template_versions(tenant_id, template_id, version);

INSERT OR IGNORE INTO sns_template_settings (tenant_id) VALUES ('raven-oracle');

INSERT OR IGNORE INTO sns_post_templates (id, tenant_id, name, slug, format_type, category, description, duration_seconds, scene_schema, content_schema, default_cta, tags)
VALUES
('raven-template-three-choice', 'raven-oracle', '20秒3択リーディング', 'three-choice-reading', 'three_choice_reading', 'viral', '既存の20秒3択動画テンプレート互換定義。', 20, '{"duration":20,"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":5,"type":"choice"},{"start":5,"end":9,"type":"result","slot":"A"},{"start":9,"end":13,"type":"result","slot":"B"},{"start":13,"end":17,"type":"result","slot":"C"},{"start":17,"end":20,"type":"cta"}]}', '{"required":["theme","deckId","cards","cta"],"optional":["hook","characterId","background","music"]}', '詳しい鑑定はプロフィールへ', '["3択","カード","20秒"]'),
('raven-template-yes-no', 'raven-oracle', 'YES / NO占い', 'yes-no', 'yes_no', 'viral', '質問に対するYES / NOの短尺リーディング。', 20, '{"duration":20,"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":6,"type":"question"},{"start":6,"end":14,"type":"reveal"},{"start":14,"end":18,"type":"explanation"},{"start":18,"end":20,"type":"cta"}]}', '{"required":["question","cta"],"optional":["card","result","characterId"]}', '詳しい鑑定はプロフィールへ', '["YES/NO","質問"]'),
('raven-template-one-card', 'raven-oracle', '1枚引き', 'one-card', 'one_card', 'viral', '1枚のカードから短いメッセージを届ける。', 20, '{"duration":20,"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":8,"type":"choice"},{"start":8,"end":17,"type":"message"},{"start":17,"end":20,"type":"cta"}]}', '{"required":["theme","card","cta"],"optional":["characterId","background","music"]}', '必要なら詳しい鑑定へ', '["1枚引き","カード"]'),
('raven-template-ranking', 'raven-oracle', 'ランキング', 'ranking', 'ranking', 'viral', '星座・誕生月等のエンタメランキング。', 20, '{"duration":20,"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":16,"type":"ranking"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["rankingItems","cta"],"optional":["theme","characterId"]}', '保存して後で見返す', '["ランキング","エンタメ"]'),
('raven-template-card-meaning', 'raven-oracle', 'カード解説', 'card-meaning', 'card_meaning', 'fortune', 'カード画像と一般的な意味を短く解説する。', 20, '{"duration":20,"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":8,"type":"card"},{"start":8,"end":17,"type":"meaning"},{"start":17,"end":20,"type":"cta"}]}', '{"required":["card","meaning","cta"],"optional":["characterId","theme"]}', 'もっと詳しく知りたい方へ', '["カード解説","占術"]'),
('raven-template-guild-dialogue', 'raven-oracle', 'ギルド掛け合い', 'guild-dialogue', 'guild_dialogue', 'guild_story', '2〜3キャラクターの短い掛け合い。', 20, '{"duration":20,"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":16,"type":"dialogue"},{"start":16,"end":20,"type":"ending"}]}', '{"required":["dialogue"],"optional":["characterIds","theme","ending","cta"]}', 'ギルドの続きはプロフィールへ', '["ギルド","キャラクター"]');
