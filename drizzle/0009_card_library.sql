CREATE TABLE IF NOT EXISTS card_library_decks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  deck_type TEXT NOT NULL DEFAULT 'oracle',
  description TEXT NOT NULL DEFAULT '',
  card_count INTEGER NOT NULL DEFAULT 0,
  back_image_url TEXT NOT NULL DEFAULT '',
  storage_provider TEXT NOT NULL DEFAULT 'url',
  storage_key TEXT NOT NULL DEFAULT '',
  copyright_status TEXT NOT NULL DEFAULT 'owned',
  commercial_use_allowed INTEGER NOT NULL DEFAULT 0,
  sns_use_allowed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS card_library_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  card_number INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  name_ja TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  storage_provider TEXT NOT NULL DEFAULT 'url',
  storage_key TEXT NOT NULL DEFAULT '',
  upright_meaning TEXT NOT NULL DEFAULT '',
  reversed_meaning TEXT NOT NULL DEFAULT '',
  love_meaning TEXT NOT NULL DEFAULT '',
  work_meaning TEXT NOT NULL DEFAULT '',
  money_meaning TEXT NOT NULL DEFAULT '',
  keywords_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  sns_summary TEXT NOT NULL DEFAULT '',
  sns_use_allowed INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(deck_id) REFERENCES card_library_decks(id)
);

CREATE TABLE IF NOT EXISTS card_usage_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deck_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'sns',
  sns_platform TEXT NOT NULL DEFAULT '',
  post_id TEXT NOT NULL DEFAULT '',
  content_id TEXT NOT NULL DEFAULT '',
  selection_mode TEXT NOT NULL DEFAULT 'random',
  used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_card_library_decks_tenant_status ON card_library_decks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_card_library_cards_deck_enabled ON card_library_cards(tenant_id, deck_id, enabled);
CREATE INDEX IF NOT EXISTS idx_card_library_cards_tags ON card_library_cards(tenant_id, tags_json);
CREATE INDEX IF NOT EXISTS idx_card_usage_recent ON card_usage_history(tenant_id, deck_id, card_id, used_at);
CREATE INDEX IF NOT EXISTS idx_card_usage_post ON card_usage_history(tenant_id, post_id);

INSERT INTO card_library_decks (
  id, tenant_id, name, slug, deck_type, description, card_count,
  copyright_status, commercial_use_allowed, sns_use_allowed, status
) VALUES (
  'raven-oracle-sample-deck',
  'raven-oracle',
  'Raven Oracle Sample Deck',
  'raven-oracle-sample',
  'oracle',
  'Deck Manager V1の動作確認用サンプルデッキ。実カードデッキを登録する前の選出確認に使います。',
  3,
  'owned',
  1,
  1,
  'draft'
) ON CONFLICT(tenant_id, slug) DO NOTHING;

INSERT INTO card_library_cards (
  id, tenant_id, deck_id, card_number, name, name_ja, upright_meaning,
  reversed_meaning, love_meaning, work_meaning, money_meaning,
  keywords_json, tags_json, sns_summary, sns_use_allowed, enabled, sort_order
) VALUES
  (
    'raven-sample-card-lantern',
    'raven-oracle',
    'raven-oracle-sample-deck',
    1,
    'The Lantern',
    '灯火',
    '暗い場所で次の一歩を見つける。焦らず、照らせる範囲から進む。',
    '見えていないものを無理に決めようとしている。情報不足を認める。',
    '相手の反応だけでなく、自分が安心できる距離を確認する。',
    '優先順位を一つに絞り、手元の作業から整える。',
    '大きく増やすより、漏れを止めて状況を見直す。',
    '["確認","静けさ","一歩"]',
    '["daily","reflection","raven"]',
    '今日は、全部を決め切るより、足元を一つ照らす日。',
    1,
    1,
    10
  ),
  (
    'raven-sample-card-gate',
    'raven-oracle',
    'raven-oracle-sample-deck',
    2,
    'The Gate',
    '門',
    '入口が開く。進む前に、入る場所と出る場所を確認する。',
    '開いている扉に急ぎすぎている。条件を読まずに進まない。',
    '関係を進めるなら、曖昧な期待を言葉にする。',
    '交渉や応募など、外へ出る動きに向く。',
    '新しい収入口を見る前に、条件と負担を確認する。',
    '["入口","選択","交渉"]',
    '["daily","choice","sns"]',
    '開いた扉すべてに入らなくていい。選ぶことも力です。',
    1,
    1,
    20
  ),
  (
    'raven-sample-card-boundary',
    'raven-oracle',
    'raven-oracle-sample-deck',
    3,
    'The Boundary',
    '境界線',
    '守るべき線を引く。優しさと許容を混同しない。',
    '防御が強くなりすぎている。拒絶ではなく条件を示す。',
    '無理に合わせるより、嫌なことを丁寧に分ける。',
    '役割と責任の範囲を明確にする。',
    '貸し借りや契約条件を曖昧にしない。',
    '["境界線","守り","条件"]',
    '["daily","boundary","relationship"]',
    '今日は、優しさの形を「引き受けすぎないこと」に変える日。',
    1,
    1,
    30
  )
ON CONFLICT(id) DO NOTHING;
