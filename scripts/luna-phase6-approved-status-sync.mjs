import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const args = Object.fromEntries(process.argv.slice(2).reduce((out, arg, index, all) => {
  if (arg.startsWith("--")) out.push([arg.slice(2), all[index + 1]]);
  return out;
}, []));
const previousPath = args.previous;
const latestPath = args.latest;
const outputPath = args.output;
if (!previousPath || !latestPath || !outputPath) throw new Error("--previous, --latest and --output are required");
for (const file of [previousPath, latestPath]) {
  if (!path.isAbsolute(file) || !fs.existsSync(file)) throw new Error(`snapshot not found: ${file}`);
  if (file.toLowerCase().includes("production")) throw new Error("production snapshot path rejected");
}
if (!path.isAbsolute(outputPath) || outputPath.toLowerCase().includes("production")) throw new Error("production output path rejected");
const oldDb = new DatabaseSync(":memory:");
const newDb = new DatabaseSync(":memory:");
oldDb.exec(fs.readFileSync(previousPath, "utf8"));
newDb.exec(fs.readFileSync(latestPath, "utf8"));
const value = (row, ...names) => names.map((name) => row[name]).find((item) => item !== undefined && item !== null) ?? null;
const idOf = (row, index) => String(value(row, "id", "article_id") ?? `row:${index}`);
const stable = (row) => JSON.stringify(row, (_, item) => typeof item === "bigint" ? Number(item) : item, Object.keys(row).sort());
const hash = (row) => crypto.createHash("sha256").update(stable(row)).digest("hex");
const oldRows = oldDb.prepare("SELECT * FROM blog_engine_articles").all().map((row, index) => ({ row, id: idOf(row, index), hash: hash(row) }));
const newRows = newDb.prepare("SELECT * FROM blog_engine_articles").all().map((row, index) => ({ row, id: idOf(row, index), hash: hash(row) }));
const oldMap = new Map(oldRows.map((item) => [item.id, item]));
const changed = newRows.filter((item) => oldMap.has(item.id) && oldMap.get(item.id).hash !== item.hash);
if (changed.length !== 1) throw new Error(`expected exactly one changed article, found ${changed.length}`);
const item = changed[0];
const oldStatus = String(value(oldMap.get(item.id).row, "status") ?? "");
const newStatus = String(value(item.row, "status") ?? "");
if (oldStatus !== "scheduled" || newStatus !== "published") {
  throw new Error(`approved transition mismatch: ${oldStatus} -> ${newStatus}`);
}
const sourceTenant = "luna-starwind";
const targetTenant = "luna-oracle";
const esc = (input) => input === null || input === undefined ? "NULL" : typeof input === "number" ? String(input) : `'${String(input).replaceAll("'", "''")}'`;
const sql = [
  "PRAGMA foreign_keys = ON;",
  "-- Approved migration-state synchronization only; target must be new Luna D1 721248ee-92a5-4fe8-b5af-08503ece8d40.",
  `-- Explicit source tenant: ${sourceTenant}; target tenant: ${targetTenant}; source article key is intentionally not printed here.`,
  `UPDATE blog_engine_articles SET status = 'published', published_at = ${esc(value(item.row, "published_at"))} WHERE id = (SELECT CAST(target_id AS INTEGER) FROM studioos_import_ledger WHERE source_table = 'blog_engine_articles' AND source_id = ${esc(item.id)} AND source_tenant_id = ${esc(sourceTenant)} AND target_tenant_id = ${esc(targetTenant)}) AND tenant_id = ${esc(targetTenant)} AND status = 'scheduled';`,
  `UPDATE studioos_import_ledger SET status = 'status_sync_published' WHERE source_table = 'blog_engine_articles' AND source_id = ${esc(item.id)} AND source_tenant_id = ${esc(sourceTenant)} AND target_tenant_id = ${esc(targetTenant)} AND status = 'imported';`,
  "-- Re-running this file is a no-op because the target predicate requires status='scheduled' and ledger status='imported'.",
];
fs.writeFileSync(outputPath, sql.join("\n") + "\n", "utf8");
console.log(JSON.stringify({ outputPath, transition: `${oldStatus} -> ${newStatus}`, approved: true, archiveOnlyExcluded: true, settingsUpdatedAtExcluded: true }, null, 2));
