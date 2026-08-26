import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";

const exportPath = process.env.LUNA_D1_EXPORT;
const outputPath = process.env.LUNA_IMPORT_SQL;
if (!exportPath || !outputPath) throw new Error("LUNA_D1_EXPORT and LUNA_IMPORT_SQL are required");
if (!fs.existsSync(exportPath)) throw new Error("legacy export not found");
if (outputPath.toLowerCase().includes("production")) throw new Error("production output path rejected");

const db = new DatabaseSync(":memory:");
db.exec(fs.readFileSync(exportPath, "utf8"));
const value = (row, ...names) => names.map((name) => row[name]).find((item) => item !== undefined && item !== null) ?? null;
const sourceId = (row) => String(value(row, "id", "event_id", "tracking_id", "recommendation_id") ?? "unknown");
const rows = (table) => db.prepare(`SELECT * FROM "${table}"`).all();
const sql = (value) => value === null || value === undefined ? "NULL" : typeof value === "number" ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const json = (row) => JSON.stringify(row, (_, item) => typeof item === "bigint" ? Number(item) : item);
const sourceTenant = "luna-starwind";
const targetTenant = "luna-oracle";
const targetCharacter = "luna";
const out = [
  "PRAGMA foreign_keys = ON;",
  "CREATE TABLE IF NOT EXISTS studioos_reading_feedback (import_id INTEGER PRIMARY KEY AUTOINCREMENT, source_id TEXT NOT NULL, source_tenant_id TEXT NOT NULL, tenant_id TEXT NOT NULL, character_id TEXT NOT NULL, theme TEXT, rating INTEGER, comment TEXT, page_path TEXT, created_at TEXT, UNIQUE(source_id, source_tenant_id));",
  "CREATE TABLE IF NOT EXISTS studioos_import_ledger (source_table TEXT NOT NULL, source_id TEXT NOT NULL, source_tenant_id TEXT NOT NULL, target_table TEXT NOT NULL, target_id TEXT, target_tenant_id TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(source_table, source_id, source_tenant_id));",
];
const ledger = (table, id, targetTable, targetId, status) => out.push(`INSERT OR IGNORE INTO studioos_import_ledger (source_table, source_id, source_tenant_id, target_table, target_id, target_tenant_id, status) VALUES (${sql(table)}, ${sql(id)}, ${sql(sourceTenant)}, ${sql(targetTable)}, ${sql(targetId)}, ${sql(targetTenant)}, ${sql(status)});`);

for (const row of rows("analytics_events")) {
  const id = sourceId(row);
  out.push(`INSERT OR IGNORE INTO analytics_events (tenant_id, event_name, event_namespace, path, session_id, member_id, payload_json, created_at) SELECT ${sql(targetTenant)}, ${sql(value(row, "event_name") ?? "legacy_event")}, ${sql(value(row, "event_namespace") ?? "legacy-luna")}, ${sql(value(row, "page_path", "path"))}, ${sql(value(row, "session_id"))}, ${sql(value(row, "member_id"))}, ${sql(json(row))}, ${sql(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'analytics_events' AND source_id = ${sql(id)} AND source_tenant_id = ${sql(sourceTenant)});`);
  ledger("analytics_events", id, "analytics_events", "deterministic:analytics:" + id, "imported");
}
for (const row of rows("reading_feedback")) {
  const id = sourceId(row);
  out.push(`INSERT OR IGNORE INTO studioos_reading_feedback (source_id, source_tenant_id, tenant_id, character_id, theme, rating, comment, page_path, created_at) SELECT ${sql(id)}, ${sql(sourceTenant)}, ${sql(targetTenant)}, ${sql(targetCharacter)}, ${sql(value(row, "theme"))}, ${sql(value(row, "rating"))}, ${sql(value(row, "comment"))}, ${sql(value(row, "page_path"))}, ${sql(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'reading_feedback' AND source_id = ${sql(id)} AND source_tenant_id = ${sql(sourceTenant)});`);
  ledger("reading_feedback", id, "studioos_reading_feedback", "deterministic:feedback:" + id, "imported");
}
for (const row of rows("blog_engine_settings").slice(0, 1)) {
  const id = sourceId(row);
  out.push(`INSERT OR IGNORE INTO blog_engine_settings (tenant_id, enabled, default_author, default_locale, public_base_url, created_at) SELECT ${sql(targetTenant)}, ${sql(Number(value(row, "enabled") ?? 1))}, ${sql(value(row, "default_author", "author"))}, ${sql(value(row, "default_locale", "locale") ?? "ja-JP")}, ${sql(value(row, "public_base_url"))}, ${sql(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'blog_engine_settings' AND source_id = ${sql(id)} AND source_tenant_id = ${sql(sourceTenant)});`);
  ledger("blog_engine_settings", id, "blog_engine_settings", "deterministic:settings:" + id, "imported");
}
for (const row of rows("blog_engine_articles")) {
  const id = sourceId(row);
  const status = String(value(row, "status") ?? "draft");
  const allowed = new Set(["draft", "published", "scheduled", "approved"]);
  if (!allowed.has(status)) continue;
  out.push(`INSERT OR IGNORE INTO blog_engine_articles (tenant_id, slug, title, body, locale, status, published_at, created_at) SELECT ${sql(targetTenant)}, ${sql(value(row, "slug") ?? `legacy-${id}`)}, ${sql(value(row, "title") ?? "Untitled")}, ${sql(value(row, "body"))}, ${sql(value(row, "locale") ?? "ja-JP")}, ${sql(status)}, ${sql(value(row, "published_at"))}, ${sql(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'blog_engine_articles' AND source_id = ${sql(id)} AND source_tenant_id = ${sql(sourceTenant)});`);
  ledger("blog_engine_articles", id, "blog_engine_articles", "deterministic:article:" + id, "imported");
}
const ledgerStatements = out.splice(3);
out.push(...ledgerStatements);
out.push("-- Explicit remap: luna-starwind -> luna-oracle; character -> luna.");
out.push("-- No Raven, campaign, SNS history, growth history, or archive-only rows are imported.");
fs.writeFileSync(outputPath, out.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ outputPath, analytics: rows("analytics_events").length, feedback: rows("reading_feedback").length, settings: rows("blog_engine_settings").length, articles: rows("blog_engine_articles").length }));
