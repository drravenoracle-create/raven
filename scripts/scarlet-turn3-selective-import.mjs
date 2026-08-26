import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) throw new Error("usage: node scripts/scarlet-turn3-selective-import.mjs <legacy.sql> <import.sql>");

const source = new DatabaseSync(":memory:");
source.exec(readFileSync(sourcePath, "utf8"));

const esc = (value) => value === null || value === undefined ? "NULL" : `'${String(value).replaceAll("'", "''")}'`;
const stableInt = (value) => {
  const n = Number.parseInt(createHash("sha256").update(String(value)).digest("hex").slice(0, 12), 16);
  return -Math.max(1, n % 2000000000);
};
const rows = (sql) => source.prepare(sql).all();
const posts = rows("SELECT id, title, body, status, created_at, updated_at, slug, description, pub_date FROM posts ORDER BY id");
const events = rows("SELECT id, created_at, tenant_id, event_name, page_path, page_title, referrer, referrer_host, source, medium, campaign, link_url, link_text, visitor_hash, user_agent FROM analytics_events ORDER BY id");

const lines = [
  "PRAGMA foreign_keys = ON;",
  "INSERT OR IGNORE INTO studioos_tenant_metadata (tenant_id, tenant_key, guild_id, character_id, market, country, locale, schema_version, environment, legacy_tenant_alias) VALUES ('scarlet-donovan', 'scarlet-donovan', 'raven-guild', 'scarlet', 'jp', 'JP', 'ja-JP', 1, 'production-preview', 'scarlet-guardian');",
  "INSERT OR IGNORE INTO blog_engine_settings (tenant_id, enabled, default_author, default_locale, public_base_url) VALUES ('scarlet-donovan', 1, 'Scarlet Donovan', 'ja-JP', 'https://scarlet.fortunestudios.jp');",
];

for (const row of posts) {
  const slug = row.slug || `legacy-post-${row.id}`;
  const status = ["draft", "published", "scheduled"].includes(row.status) ? row.status : "draft";
  const publishedAt = status === "published" ? (row.pub_date || row.updated_at || row.created_at) : null;
  lines.push(`INSERT OR IGNORE INTO blog_engine_articles (id, tenant_id, slug, title, body, locale, status, published_at, created_at) VALUES (${Number(row.id)}, 'scarlet-donovan', ${esc(slug)}, ${esc(row.title || "")}, ${esc(row.body)}, 'ja-JP', ${esc(status)}, ${esc(publishedAt)}, ${esc(row.created_at)});`);
}

for (const row of events) {
  const id = stableInt(`scarlet-donovan:${row.id}`);
  const payload = JSON.stringify({ pagePath: row.page_path, title: row.page_title, referrer: row.referrer, referrerHost: row.referrer_host, source: row.source, medium: row.medium, campaign: row.campaign, linkUrl: row.link_url, linkText: row.link_text, visitorHash: row.visitor_hash, userAgent: row.user_agent });
  lines.push(`INSERT OR IGNORE INTO analytics_events (id, tenant_id, event_name, event_namespace, path, payload_json, created_at) VALUES (${id}, 'scarlet-donovan', ${esc(row.event_name || "unknown")}, 'scarlet-donovan', ${esc(row.page_path)}, ${esc(payload)}, ${esc(row.created_at)});`);
}

lines.push("");
writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(JSON.stringify({ sourceCounts: { posts: posts.length, analytics: events.length, snsDrafts: Number(source.prepare("SELECT COUNT(*) AS n FROM sns_drafts").get().n) }, importCounts: { blog_engine_articles: posts.length, analytics_events: events.length, blog_engine_settings: 1 }, archiveOnly: { sns_drafts: Number(source.prepare("SELECT COUNT(*) AS n FROM sns_drafts").get().n) }, outputPath }, null, 2));
