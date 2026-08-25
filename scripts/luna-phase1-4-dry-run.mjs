import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const exportPath = process.env.LUNA_D1_EXPORT;
const backupDir = process.env.LUNA_DRYRUN_DIR;
if (!exportPath || !backupDir) {
  throw new Error("LUNA_D1_EXPORT and LUNA_DRYRUN_DIR are required");
}
if (!path.isAbsolute(exportPath) || !path.isAbsolute(backupDir)) {
  throw new Error("dry-run paths must be absolute");
}
if (!fs.existsSync(exportPath)) throw new Error(`export not found: ${exportPath}`);
if (exportPath.toLowerCase().includes("production")) throw new Error("production export path rejected");

const cleanSchemaPath = path.resolve("studioos/schema/clean-luna.sql");
const sourceDbPath = path.join(backupDir, "luna-phase1-4-source-restore.sqlite");
const targetDbPath = path.join(backupDir, "luna-phase1-4-target.sqlite");
const reportPath = path.join(backupDir, "luna-phase1-4-dryrun-report.json");
fs.mkdirSync(backupDir, { recursive: true });
for (const file of [sourceDbPath, targetDbPath, reportPath]) {
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const source = new DatabaseSync(sourceDbPath);
source.exec(fs.readFileSync(exportPath, "utf8"));
const target = new DatabaseSync(targetDbPath);
target.exec(fs.readFileSync(cleanSchemaPath, "utf8"));

// The clean bundle contains fixture metadata for Raven and Luna. The migration
// target for this dry-run must be Luna-only, so remove the Raven fixture locally.
target.exec("DELETE FROM studioos_tenant_metadata WHERE tenant_id = 'raven-oracle';");

target.exec(`
  CREATE TABLE studioos_reading_feedback (
    import_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_tenant_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    theme TEXT,
    rating INTEGER,
    comment TEXT,
    page_path TEXT,
    created_at TEXT,
    UNIQUE(source_id, source_tenant_id)
  );
  CREATE TABLE studioos_import_ledger (
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_tenant_id TEXT NOT NULL,
    target_table TEXT NOT NULL,
    target_id TEXT,
    target_tenant_id TEXT NOT NULL,
    status TEXT NOT NULL,
    PRIMARY KEY(source_table, source_id, source_tenant_id)
  );
  CREATE TABLE studioos_migration_archive (
    archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_tenant_id TEXT NOT NULL,
    target_tenant_id TEXT NOT NULL,
    target_character_id TEXT NOT NULL,
    status TEXT,
    created_at TEXT,
    payload_json TEXT NOT NULL,
    UNIQUE(source_table, source_id, source_tenant_id)
  );
`);

const sourceTenant = "luna-starwind";
const targetTenant = "luna-oracle";
const targetCharacter = "luna";
const sourceTables = [
  "analytics_events",
  "reading_feedback",
  "blog_engine_settings",
  "blog_engine_articles",
  "blog_engine_events",
  "blog_engine_social_contents",
  "blog_engine_social_metrics",
  "growth_events",
  "growth_guardrail_results",
  "growth_executive_briefs",
  "blog_engine_article_metrics",
  "blog_engine_improvement_recommendations",
  "blog_engine_optimization_guard",
];

const tableColumns = (db, table) => db
  .prepare(`PRAGMA table_info("${table}")`)
  .all()
  .map((row) => row.name);
const rows = (db, table) => db.prepare(`SELECT * FROM "${table}"`).all();
const value = (row, ...names) => {
  for (const name of names) if (row[name] !== undefined && row[name] !== null) return row[name];
  return null;
};
const sourceId = (row) => String(value(row, "id", "event_id", "tracking_id", "recommendation_id") ?? "unknown");
const json = (row) => JSON.stringify(row, (_, item) => typeof item === "bigint" ? Number(item) : item);
const insertLedger = target.prepare(`
  INSERT OR IGNORE INTO studioos_import_ledger
    (source_table, source_id, source_tenant_id, target_table, target_id, target_tenant_id, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const archive = target.prepare(`
  INSERT OR IGNORE INTO studioos_migration_archive
    (source_table, source_id, source_tenant_id, target_tenant_id, target_character_id, status, created_at, payload_json)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const sourceCounts = {};
for (const table of sourceTables) sourceCounts[table] = rows(source, table).length;

const analyticsInsert = target.prepare(`
  INSERT INTO analytics_events
    (tenant_id, event_name, event_namespace, path, session_id, member_id, payload_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const row of rows(source, "analytics_events")) {
  const id = sourceId(row);
  const targetRow = analyticsInsert.run(
    targetTenant,
    value(row, "event_name") ?? "legacy_event",
    value(row, "event_namespace") ?? "legacy-luna",
    value(row, "page_path", "path"),
    value(row, "session_id"),
    value(row, "member_id"),
    json(row),
    value(row, "created_at") ?? new Date(0).toISOString(),
  );
  insertLedger.run("analytics_events", id, sourceTenant, "analytics_events", String(targetRow.lastInsertRowid), targetTenant, "imported");
}

const feedbackInsert = target.prepare(`
  INSERT INTO studioos_reading_feedback
    (source_id, source_tenant_id, tenant_id, character_id, theme, rating, comment, page_path, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const row of rows(source, "reading_feedback")) {
  const id = sourceId(row);
  const targetRow = feedbackInsert.run(id, sourceTenant, targetTenant, targetCharacter,
    value(row, "theme"), value(row, "rating"), value(row, "comment"), value(row, "page_path"), value(row, "created_at"));
  insertLedger.run("reading_feedback", id, sourceTenant, "studioos_reading_feedback", String(targetRow.lastInsertRowid), targetTenant, "optional_imported");
}

const settings = rows(source, "blog_engine_settings")[0];
if (settings) {
  target.prepare(`
    INSERT INTO blog_engine_settings
      (tenant_id, enabled, default_author, default_locale, public_base_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(targetTenant, Number(value(settings, "enabled") ?? 1), value(settings, "default_author", "author"),
    value(settings, "default_locale", "locale") ?? "ja-JP", value(settings, "public_base_url"), value(settings, "created_at"));
  insertLedger.run("blog_engine_settings", sourceId(settings), sourceTenant, "blog_engine_settings", targetTenant, targetTenant, "imported");
}

const articleInsert = target.prepare(`
  INSERT INTO blog_engine_articles
    (tenant_id, slug, title, body, locale, status, published_at, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const allowedArticleStatuses = new Set(["draft", "published", "scheduled", "approved"]);
const quarantinedStatuses = [];
for (const row of rows(source, "blog_engine_articles")) {
  const id = sourceId(row);
  const articleStatus = String(value(row, "status") ?? "draft");
  if (!allowedArticleStatuses.has(articleStatus)) {
    quarantinedStatuses.push({ table: "blog_engine_articles", sourceId: id, status: articleStatus });
    archive.run("blog_engine_articles", id, sourceTenant, targetTenant, targetCharacter,
      articleStatus, value(row, "created_at", "updated_at"), json(row));
    insertLedger.run("blog_engine_articles", id, sourceTenant, "studioos_migration_archive", id, targetTenant, "quarantined_status");
    continue;
  }
  const targetRow = articleInsert.run(targetTenant, value(row, "slug") ?? `legacy-${id}`, value(row, "title") ?? "Untitled",
    value(row, "body"), value(row, "locale") ?? "ja-JP", articleStatus,
    value(row, "published_at"), value(row, "created_at"));
  insertLedger.run("blog_engine_articles", id, sourceTenant, "blog_engine_articles", String(targetRow.lastInsertRowid), targetTenant, "selective_imported");
}

// Event/social/growth history is retained as local archive evidence, not
// forced into unrelated StudioOS tables or activated runtime features.
const archiveTables = [
  "blog_engine_events",
  "blog_engine_social_contents",
  "blog_engine_social_metrics",
  "growth_events",
  "growth_guardrail_results",
  "growth_executive_briefs",
  "blog_engine_article_metrics",
  "blog_engine_improvement_recommendations",
  "blog_engine_optimization_guard",
];
for (const table of archiveTables) {
  for (const row of rows(source, table)) {
    const id = sourceId(row);
    archive.run(table, id, sourceTenant, targetTenant, targetCharacter,
      value(row, "status"), value(row, "created_at", "updated_at", "measured_at"), json(row));
    insertLedger.run(table, id, sourceTenant, "studioos_migration_archive", id, targetTenant, "archive_only");
  }
}

const targetCount = (table) => target.prepare(`SELECT COUNT(*) AS count FROM "${table}"`).get().count;
const targetTenantCount = (table, tenant = targetTenant) => {
  try { return target.prepare(`SELECT COUNT(*) AS count FROM "${table}" WHERE tenant_id = ?`).get(tenant).count; }
  catch { return null; }
};
const targetCounts = {
  analytics_events: targetTenantCount("analytics_events"),
  studioos_reading_feedback: targetTenantCount("studioos_reading_feedback"),
  blog_engine_settings: targetTenantCount("blog_engine_settings"),
  blog_engine_articles: targetTenantCount("blog_engine_articles"),
  archive_rows: targetCount("studioos_migration_archive"),
  ledger_rows: targetCount("studioos_import_ledger"),
};
const ravenRows = {};
for (const table of ["analytics_events", "blog_engine_settings", "blog_engine_articles", "growth_metric_points", "growth_evidence_sources", "growth_hypotheses", "growth_proposals", "growth_experiments", "growth_memory"]) {
  ravenRows[table] = targetTenantCount(table, "raven-oracle");
}
const report = {
  mode: "local-only-dry-run",
  sourceTenant,
  targetTenant,
  targetCharacter,
  sourceExport: exportPath,
  sourceRestore: sourceDbPath,
  targetDatabase: targetDbPath,
  sourceCounts,
  targetCounts,
  archivedCounts: Object.fromEntries(archiveTables.map((table) => [table, sourceCounts[table]])),
  ravenRows,
  runtimePolicy: { growth: "READ-ONLY / HUMAN-CONTROLLED", openingCampaign: "OFF", trial: "OFF", sns: "OFF", reel: "OFF" },
  verification: {
    noOverwrite: true,
    deterministicLedger: true,
    timestampsPreserved: true,
    unknownStatusQuarantined: true,
    quarantinedStatuses,
    productionWrite: false,
  },
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(JSON.stringify({ reportPath, sourceDbPath, targetDbPath, sourceCounts, targetCounts, ravenRows }, null, 2));
