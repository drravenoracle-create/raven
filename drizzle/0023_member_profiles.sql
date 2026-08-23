CREATE TABLE IF NOT EXISTS member_profiles (
  member_id TEXT PRIMARY KEY,
  birth_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

