import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
test("opening campaign migration is additive and idempotent", async () => { const sql = await readFile(new URL("../drizzle/0027_opening_campaign_phase1.sql", import.meta.url), "utf8"); assert.match(sql, /CREATE TABLE IF NOT EXISTS opening_campaigns/); assert.match(sql, /CREATE TABLE IF NOT EXISTS opening_campaign_members/); assert.match(sql, /CREATE TABLE IF NOT EXISTS opening_campaign_events/); assert.match(sql, /UNIQUE\(campaign_id, member_id\)/); assert.match(sql, /event_key TEXT NOT NULL UNIQUE/); assert.doesNotMatch(sql, /ALTER TABLE/i); const db = new DatabaseSync(":memory:"); db.exec(sql); db.exec(sql); assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name LIKE 'opening_campaign_%'").get().count, 3); db.close(); });
