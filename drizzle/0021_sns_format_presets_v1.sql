ALTER TABLE sns_post_templates ADD COLUMN format_key TEXT;
ALTER TABLE sns_post_templates ADD COLUMN supported_durations TEXT NOT NULL DEFAULT '[20]';
ALTER TABLE sns_post_templates ADD COLUMN required_assets TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sns_post_templates ADD COLUMN required_divination_systems TEXT NOT NULL DEFAULT '[]';
ALTER TABLE sns_post_templates ADD COLUMN hook_schema TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sns_post_templates ADD COLUMN cta_schema TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sns_post_templates ADD COLUMN comment_prompt_schema TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sns_post_templates ADD COLUMN character_compatibility TEXT NOT NULL DEFAULT '{}';
ALTER TABLE sns_post_templates ADD COLUMN is_system_preset INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sns_post_templates ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sns_post_templates_tenant_format_key
  ON sns_post_templates(tenant_id, format_key);

CREATE TABLE IF NOT EXISTS sns_post_format_metadata (
  post_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  format_id TEXT NOT NULL,
  format_version INTEGER NOT NULL DEFAULT 1,
  visual_template_id TEXT,
  character_id TEXT,
  hook_id TEXT,
  cta_id TEXT,
  platform TEXT,
  category TEXT,
  divination_system TEXT,
  deck_id TEXT,
  duration INTEGER,
  campaign_id TEXT,
  experiment_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sns_post_format_metadata_tenant_format
  ON sns_post_format_metadata(tenant_id, format_id, created_at);

UPDATE sns_template_settings
SET feature_flags = json_set(COALESCE(feature_flags, '{}'), '$.sns_format_presets_v1_enabled', true)
WHERE tenant_id = 'raven-oracle';

INSERT OR IGNORE INTO sns_post_templates
  (id, tenant_id, name, slug, format_type, format_key, category, description, version, status,
   duration_seconds, supported_durations, renderer_type, scene_schema, content_schema,
   default_cta, supported_platforms, supported_characters, tags, hook_schema, cta_schema,
   comment_prompt_schema, character_compatibility, required_assets, required_divination_systems,
   is_system_preset, enabled, growth_enabled)
VALUES
('raven-format-destiny-stop', 'raven-oracle', '今これを見たあなたへ', 'destiny-stop-one-card', 'one_card', 'destiny_stop_one_card', 'one_card', '偶然ここで止まった体験から、1枚のカードを読む。', 1, 'active', 20, '[20]', '["card","deck"]', '{"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":6,"type":"card_reveal"},{"start":6,"end":16,"type":"reading"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["deckId","card","reading"],"optional":["characterId","background"]}', '詳しい鑑定はプロフィールへ', '["instagram","tiktok","youtube"]', '["raven"]', '["1枚引き","直感"]', '{"hooks":["偶然ここで止まったあなたへ。","今これを見ているあなたに1枚引きます。"]}', '{"types":["comment","save","free_reading"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["card","deck"]', '["tarot","oracle"]', 1, 1, 1),
('raven-format-72-hours', 'raven-oracle', '72時間以内に起こること', 'next-72-hours-three-choice', 'three_choice_reading', 'next_72_hours_three_choice', 'three_choice', '既存の20秒3択動画基盤を使い、72時間以内の流れを3択で読む。', 1, 'active', 20, '[20]', '["card","deck","three_choice_renderer"]', '{"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":6,"type":"choice"},{"start":6,"end":10,"type":"result","slot":"A"},{"start":10,"end":14,"type":"result","slot":"B"},{"start":14,"end":18,"type":"result","slot":"C"},{"start":18,"end":20,"type":"cta"}]}', '{"required":["theme","deckId","cards","cta"],"optional":["hook","characterId"]}', 'プロフィールから無料鑑定', '["instagram","tiktok","youtube"]', '["raven"]', '["72時間","3択"]', '{"hooks":["72時間以内、あなたに起こること。","3日以内に届く知らせ。","今週、突然動き出すこと。"]}', '{"types":["comment","save","free_reading"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["card","deck"]', '["tarot","oracle"]', 1, 1, 1),
('raven-format-truth', 'raven-oracle', 'レイヴンの本音占い', 'raven-truth', 'one_card', 'raven_truth', 'interpretation', '一般的なカード解釈に、レイヴン独自の視点を重ねる。', 1, 'active', 20, '[20]', '["card","deck"]', '{"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":7,"type":"card_reveal"},{"start":7,"end":12,"type":"common_meaning"},{"start":12,"end":17,"type":"raven_interpretation"},{"start":17,"end":20,"type":"cta"}]}', '{"required":["card","commonMeaning","ravenInterpretation"],"optional":["theme"]}', 'このカード、どう感じましたか？', '["instagram","tiktok","youtube"]', '["raven"]', '["本音","解釈"]', '{"hooks":["このカード、実は良いカードとは限りません。","恋人のカードが出ても、安心できない場合があります。"]}', '{"types":["comment","save"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["card"]', '["tarot","oracle"]', 1, 1, 1),
('raven-format-clash', 'raven-oracle', '占い結果が割れました', 'divination-clash', 'multi_divination', 'divination_clash', 'cross_reading', '複数占術の異なる結果を、統合解釈として届ける。', 1, 'active', 20, '[20]', '["cards","divination_results"]', '{"scenes":[{"start":0,"end":2,"type":"hook"},{"start":2,"end":5,"type":"question"},{"start":5,"end":9,"type":"divination_a"},{"start":9,"end":13,"type":"divination_b"},{"start":13,"end":18,"type":"integration"},{"start":18,"end":20,"type":"cta"}]}', '{"required":["question","readings"],"optional":["divinationSystems"]}', 'あなたなら待つ？動く？', '["instagram","tiktok","youtube"]', '["raven"]', '["複数占術","対立"]', '{"hooks":["結果が真逆になりました。"]}', '{"types":["comment","save"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["divination_results"]', '["tarot","lenormand","oracle"]', 1, 1, 1),
('raven-format-first-sight', 'raven-oracle', '最初に目に入ったカード', 'first-sight-card', 'one_card', 'first_sight_card', 'intuition', '最初に視線が向いたカードを、今のメッセージとして扱う。', 1, 'active', 20, '[20]', '["cards","deck"]', '{"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":8,"type":"card_grid"},{"start":8,"end":17,"type":"reading"},{"start":17,"end":20,"type":"cta"}]}', '{"required":["cards"],"optional":["cardCount","theme"]}', '最初に目に入ったカードを保存しておいて。', '["instagram","tiktok","youtube"]', '["raven"]', '["直感","カード選択"]', '{"hooks":["選ばなくていい。","最初に目に入ったカードが、今のあなたへのメッセージ。"]}', '{"types":["comment","save"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["cards","deck"]', '["tarot","oracle"]', 1, 1, 1),
('raven-format-community', 'raven-oracle', 'コメントで次回占い決定', 'community-oracle', 'community_prompt', 'community_oracle', 'community', 'コメントを次回の占い企画へ接続する。', 1, 'active', 20, '[20]', '["character","text"]', '{"scenes":[{"start":0,"end":4,"type":"question"},{"start":4,"end":16,"type":"options"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["question","options"],"optional":["theme"]}', '明日占ってほしいものをコメントしてください。', '["instagram","tiktok","youtube"]', '["raven"]', '["コメント企画","参加型"]', '{"hooks":["次回のテーマを、あなたのコメントで決めます。"]}', '{"types":["comment","follow"]}', '{"enabled":true,"metadata":"comment_topic"}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["text"]', '["oracle"]', 1, 1, 1),
('raven-format-guild-debate', 'raven-oracle', 'ギルド意見対決', 'guild-debate', 'guild_dialogue', 'guild_debate', 'guild_story', '複数キャラクターが同じ問いに異なる意見を示す。', 1, 'active', 20, '[20]', '["characters","text"]', '{"scenes":[{"start":0,"end":3,"type":"hook"},{"start":3,"end":16,"type":"character_opinions"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["question","characters"],"optional":["opinions"]}', 'あなたなら誰を信じる？', '["instagram","tiktok","youtube"]', '["raven","luna","scarlet","atlas","sol"]', '["ギルド","意見対決"]', '{"hooks":["同じ質問なのに、ギルドの意見が割れました。"]}', '{"types":["comment","follow"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven","luna","scarlet","atlas","sol"],"disabled":[]}', '["characters","text"]', '["oracle"]', 1, 1, 1),
('raven-format-myth-buster', 'raven-oracle', 'そのカード、本当に怖い？', 'card-myth-buster', 'card_meaning', 'card_myth_buster', 'education', 'カードにまつわる誤解を、実用的な意味へ読み替える。', 1, 'active', 20, '[20]', '["card","deck"]', '{"scenes":[{"start":0,"end":4,"type":"misconception"},{"start":4,"end":8,"type":"card_reveal"},{"start":8,"end":16,"type":"actual_meaning"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["misconception","card","actualMeaning"],"optional":["practicalMeaning"]}', '保存して後で見返してください。', '["instagram","tiktok","youtube"]', '["raven"]', '["カード解説","誤解"]', '{"hooks":["塔が出たら不幸？","死神は、本当に死を意味する？","悪魔が出たら悪いこと？"]}', '{"types":["save","comment"]}', '{"enabled":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["card","deck"]', '["tarot","oracle"]', 1, 1, 1),
('raven-format-behind', 'raven-oracle', '占いの舞台裏', 'oracle-behind-scenes', 'behind_scenes', 'oracle_behind_scenes', 'behind_the_scenes', '制作・判断・失敗・試行錯誤をコンテンツ化する。', 1, 'active', 20, '[20]', '["media","text"]', '{"scenes":[{"start":0,"end":4,"type":"hook"},{"start":4,"end":14,"type":"process"},{"start":14,"end":18,"type":"lesson"},{"start":18,"end":20,"type":"cta"}]}', '{"required":["story","lesson"],"optional":["media"]}', '制作の裏側をもっと見たい方はフォロー。', '["instagram","tiktok","youtube"]', '["raven"]', '["舞台裏","制作"]', '{"hooks":["今日の占い動画をボツにした理由。","AI鑑定の品質チェックで矛盾を発見しました。"]}', '{"types":["follow","comment"]}', '{"enabled":true,"privacyScan":true}', '{"recommended":["raven"],"allowed":["raven"],"disabled":[]}', '["media","text"]', '["oracle"]', 1, 1, 1),
('raven-format-future-message', 'raven-oracle', '未来の自分から一言', 'future-self-message', 'one_card', 'future_self_message', 'reflection', '断定的な未来予測ではなく、今の自分へのメッセージとして届ける。', 1, 'active', 20, '[20]', '["card","symbol"]', '{"scenes":[{"start":0,"end":3,"type":"future_hook"},{"start":3,"end":6,"type":"symbol"},{"start":6,"end":16,"type":"message"},{"start":16,"end":20,"type":"cta"}]}', '{"required":["message"],"optional":["card","symbol"]}', '今のあなたに必要なら、保存しておいて。', '["instagram","tiktok","youtube"]', '["raven","luna","sol"]', '["未来の自分","メッセージ"]', '{"hooks":["3か月後のあなたから、今のあなたへ。"]}', '{"types":["save","free_reading"]}', '{"enabled":true,"nonPredictive":true}', '{"recommended":["sol","luna"],"allowed":["raven","luna","sol"],"disabled":[]}', '["card","symbol"]', '["oracle"]', 1, 1, 1);

UPDATE sns_post_templates SET renderer_type = CASE format_key
  WHEN 'next_72_hours_three_choice' THEN 'three_choice'
  ELSE 'video'
END
WHERE tenant_id = 'raven-oracle' AND is_system_preset = 1;
