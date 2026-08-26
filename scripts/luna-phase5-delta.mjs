import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, arg, index, all) => {
  if (arg.startsWith("--")) pairs.push([arg.slice(2), all[index + 1]]);
  return pairs;
}, []));
const previousPath = args.previous;
const latestPath = args.latest;
const reportPath = args.report;
const sqlPath = args.sql;
if (!previousPath || !latestPath || !reportPath || !sqlPath) {
  throw new Error("--previous, --latest, --report and --sql are required");
}
for (const file of [previousPath, latestPath]) {
  if (!path.isAbsolute(file) || !fs.existsSync(file)) throw new Error(`snapshot not found: ${file}`);
  if (file.toLowerCase().includes("production")) throw new Error("production snapshot path rejected");
}
if (!path.isAbsolute(reportPath) || !path.isAbsolute(sqlPath)) throw new Error("outputs must be absolute");
if (reportPath.toLowerCase().includes("production") || sqlPath.toLowerCase().includes("production")) {
  throw new Error("production output path rejected");
}

const sourceTenant = "luna-starwind";
const targetTenant = "luna-oracle";
const targetCharacter = "luna";
const tables = [
  "analytics_events",
  "reading_feedback",
  "blog_engine_settings",
  "blog_engine_articles",
  "blog_engine_events",
  "blog_engine_social_contents",
  "growth_events",
  "growth_guardrail_results",
  "growth_executive_briefs",
];
const previous = new DatabaseSync(":memory:");
const latest = new DatabaseSync(":memory:");
previous.exec(fs.readFileSync(previousPath, "utf8"));
latest.exec(fs.readFileSync(latestPath, "utf8"));
const value = (row, ...names) => names.map((name) => row[name]).find((item) => item !== undefined && item !== null) ?? null;
const idOf = (row, index) => String(value(row, "id", "event_id", "tracking_id", "feedback_id", "article_id", "recommendation_id") ?? `row:${index}`);
const stableJson = (row) => JSON.stringify(row, (_, item) => typeof item === "bigint" ? Number(item) : item, Object.keys(row).sort());
const digest = (row) => crypto.createHash("sha256").update(stableJson(row)).digest("hex");
const rows = (db, table) => db.prepare(`SELECT * FROM "${table}"`).all();
const sqlValue = (item) => item === null || item === undefined ? "NULL" : typeof item === "number" ? String(item) : `'${String(item).replaceAll("'", "''")}'`;
const sourceRows = (db, table) => rows(db, table).map((row, index) => ({ row, id: idOf(row, index), hash: digest(row) }));
const mapRows = (items) => new Map(items.map((item) => [item.id, item]));
const timestamps = (items) => items.map(({ row }) => value(row, "updated_at", "published_at", "created_at", "measured_at")).filter(Boolean).sort();
const statusCounts = (items) => Object.fromEntries([...items.reduce((map, { row }) => {
  const status = value(row, "status");
  if (status !== null) map.set(String(status), (map.get(String(status)) ?? 0) + 1);
  return map;
}, new Map())].sort(([a], [b]) => a.localeCompare(b)));

const report = {
  mode: "phase-5-delta-analysis",
  sourceTenant,
  targetTenant,
  targetCharacter,
  previousSnapshot: previousPath,
  latestSnapshot: latestPath,
  tables: {},
  totals: { new: 0, updated: 0, unchanged: 0, deleted: 0 },
  policy: {
    watermark: "updated_at when present; otherwise stable source ID + created_at",
    import: "new rows only by default; updated rows require explicit human review",
    tenantRemap: `${sourceTenant} -> ${targetTenant}`,
    characterRemap: `-> ${targetCharacter}`,
    archiveOnly: ["blog_engine_events", "blog_engine_social_contents", "growth_events", "growth_guardrail_results", "growth_executive_briefs"],
    productionWrite: "new Luna D1 only; legacy and Raven D1 rejected by procedure",
  },
};
for (const table of tables) {
  const oldItems = sourceRows(previous, table);
  const newItems = sourceRows(latest, table);
  const oldMap = mapRows(oldItems);
  const newMap = mapRows(newItems);
  const delta = { new: [], updated: [], unchanged: [], deleted: [] };
  for (const item of newItems) {
    const old = oldMap.get(item.id);
    if (!old) delta.new.push(item.id);
    else if (old.hash !== item.hash) delta.updated.push(item.id);
    else delta.unchanged.push(item.id);
  }
  for (const item of oldItems) if (!newMap.has(item.id)) delta.deleted.push(item.id);
  for (const key of Object.keys(report.totals)) report.totals[key] += delta[key].length;
  report.tables[table] = {
    previousCount: oldItems.length,
    latestCount: newItems.length,
    classifications: Object.fromEntries(Object.entries(delta).map(([key, ids]) => [key, ids.length])),
    ids: Object.fromEntries(Object.entries(delta).map(([key, ids]) => [key, ids])),
    previousStatuses: statusCounts(oldItems),
    latestStatuses: statusCounts(newItems),
    previousTimestampRange: timestamps(oldItems).length ? [timestamps(oldItems)[0], timestamps(oldItems).at(-1)] : null,
    latestTimestampRange: timestamps(newItems).length ? [timestamps(newItems)[0], timestamps(newItems).at(-1)] : null,
  };
}
report.reconciliation = {
  newRowsAvailableForApply: report.totals.new,
  updatedRowsRequireReview: report.totals.updated,
  deletedRowsRequireReview: report.totals.deleted,
  noOverwriteDefault: true,
  rerunExpected: "zero new imports after successful apply; ledger guards duplicates",
};

const sql = [
  "PRAGMA foreign_keys = ON;",
  "-- Phase 5 delta generated from explicit legacy snapshots.",
  `-- source tenant: ${sourceTenant}; target tenant: ${targetTenant}; character: ${targetCharacter}`,
  "-- Apply only to the new Luna D1 (721248ee-92a5-4fe8-b5af-08503ece8d40).",
  "-- Legacy Luna D1 and Raven D1 are never targets for this file.",
  "CREATE TABLE IF NOT EXISTS studioos_import_ledger (source_table TEXT NOT NULL, source_id TEXT NOT NULL, source_tenant_id TEXT NOT NULL, target_table TEXT NOT NULL, target_id TEXT, target_tenant_id TEXT NOT NULL, status TEXT NOT NULL, PRIMARY KEY(source_table, source_id, source_tenant_id));",
];
const addLedger = (table, id, targetTable, targetId, status = "phase5_delta_imported") => sql.push(
  `INSERT OR IGNORE INTO studioos_import_ledger (source_table, source_id, source_tenant_id, target_table, target_id, target_tenant_id, status) VALUES (${sqlValue(table)}, ${sqlValue(id)}, ${sqlValue(sourceTenant)}, ${sqlValue(targetTable)}, ${sqlValue(targetId)}, ${sqlValue(targetTenant)}, ${sqlValue(status)});`,
);
const latestRows = (table) => sourceRows(latest, table).filter(({ id }) => report.tables[table].ids.new.includes(id));
for (const { row, id } of latestRows("analytics_events")) {
  sql.push(`INSERT OR IGNORE INTO analytics_events (tenant_id, event_name, event_namespace, path, session_id, member_id, payload_json, created_at) SELECT ${sqlValue(targetTenant)}, ${sqlValue(value(row, "event_name") ?? "legacy_event")}, ${sqlValue(value(row, "event_namespace") ?? "legacy-luna")}, ${sqlValue(value(row, "page_path", "path"))}, ${sqlValue(value(row, "session_id"))}, ${sqlValue(value(row, "member_id"))}, ${sqlValue(stableJson(row))}, ${sqlValue(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'analytics_events' AND source_id = ${sqlValue(id)} AND source_tenant_id = ${sqlValue(sourceTenant)});`);
  addLedger("analytics_events", id, "analytics_events", `deterministic:analytics:${id}`);
}
for (const { row, id } of latestRows("reading_feedback")) {
  sql.push(`INSERT OR IGNORE INTO studioos_reading_feedback (source_id, source_tenant_id, tenant_id, character_id, theme, rating, comment, page_path, created_at) SELECT ${sqlValue(id)}, ${sqlValue(sourceTenant)}, ${sqlValue(targetTenant)}, ${sqlValue(targetCharacter)}, ${sqlValue(value(row, "theme"))}, ${sqlValue(value(row, "rating"))}, ${sqlValue(value(row, "comment"))}, ${sqlValue(value(row, "page_path"))}, ${sqlValue(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'reading_feedback' AND source_id = ${sqlValue(id)} AND source_tenant_id = ${sqlValue(sourceTenant)});`);
  addLedger("reading_feedback", id, "studioos_reading_feedback", `deterministic:feedback:${id}`);
}
for (const { row, id } of latestRows("blog_engine_settings").slice(0, 1)) {
  sql.push(`INSERT OR IGNORE INTO blog_engine_settings (tenant_id, enabled, default_author, default_locale, public_base_url, created_at) SELECT ${sqlValue(targetTenant)}, ${sqlValue(Number(value(row, "enabled") ?? 1))}, ${sqlValue(value(row, "default_author", "author"))}, ${sqlValue(value(row, "default_locale", "locale") ?? "ja-JP")}, ${sqlValue(value(row, "public_base_url"))}, ${sqlValue(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'blog_engine_settings' AND source_id = ${sqlValue(id)} AND source_tenant_id = ${sqlValue(sourceTenant)});`);
  addLedger("blog_engine_settings", id, "blog_engine_settings", `deterministic:settings:${id}`);
}
const allowedStatuses = new Set(["draft", "published", "scheduled", "approved"]);
for (const { row, id } of latestRows("blog_engine_articles")) {
  const status = String(value(row, "status") ?? "draft");
  if (!allowedStatuses.has(status)) continue;
  sql.push(`INSERT OR IGNORE INTO blog_engine_articles (tenant_id, slug, title, body, locale, status, published_at, created_at) SELECT ${sqlValue(targetTenant)}, ${sqlValue(value(row, "slug") ?? `legacy-${id}`)}, ${sqlValue(value(row, "title") ?? "Untitled")}, ${sqlValue(value(row, "body"))}, ${sqlValue(value(row, "locale") ?? "ja-JP")}, ${sqlValue(status)}, ${sqlValue(value(row, "published_at"))}, ${sqlValue(value(row, "created_at"))} WHERE NOT EXISTS (SELECT 1 FROM studioos_import_ledger WHERE source_table = 'blog_engine_articles' AND source_id = ${sqlValue(id)} AND source_tenant_id = ${sqlValue(sourceTenant)});`);
  addLedger("blog_engine_articles", id, "blog_engine_articles", `deterministic:article:${id}`);
}
sql.push("-- Archive-only tables are intentionally not imported by this delta file.");
sql.push("-- Updated/deleted rows are report-only and require explicit human review.");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.mkdirSync(path.dirname(sqlPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
fs.writeFileSync(sqlPath, sql.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ reportPath, sqlPath, totals: report.totals, tables: Object.fromEntries(Object.entries(report.tables).map(([table, item]) => [table, item.classifications])) }, null, 2));
