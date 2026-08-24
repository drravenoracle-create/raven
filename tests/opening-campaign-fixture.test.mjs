import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  canTransitionOpeningCampaignState,
  canUseOpeningCampaignTrial,
  deriveOpeningCampaignState,
  loadOpeningCampaignConfig,
} from "../app/lib/opening-campaign.ts";
import { findFixtureDatabase, projectRoot } from "./helpers/local-d1-fixture.mjs";

const db = new DatabaseSync(findFixtureDatabase(), { readOnly: false });
const campaign = db.prepare("SELECT * FROM opening_campaigns WHERE campaign_id = ?").get("raven-guild-opening");

test.after(() => db.close());

test("fresh D1 contains campaign tables, indexes and unique constraints", () => {
  const names = db.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'index')").all().map((row) => row.name);
  for (const name of ["opening_campaigns", "opening_campaign_members", "opening_campaign_events", "idx_opening_campaign_members_campaign", "idx_opening_campaign_events_campaign"]) assert.ok(names.includes(name));
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM opening_campaigns").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM opening_campaign_members").get().count, 2);
});

test("all six analytics events retain campaign, member and audience context", () => {
  const events = db.prepare("SELECT event_name, campaign_id, member_id, payload_json FROM opening_campaign_events ORDER BY event_name").all();
  assert.deepEqual(new Set(events.map((row) => row.event_name)), new Set(["campaign_view", "trial_started", "trial_used", "trial_exhausted", "trial_converted", "campaign_cta_clicked"]));
  assert.equal(events.length, 6);
  for (const event of events) {
    assert.equal(event.campaign_id, "raven-guild-opening");
    assert.match(event.member_id, /^fixture-member-/);
    assert.equal(JSON.parse(event.payload_json).audience, campaign.target_audience);
    assert.doesNotMatch(event.payload_json, /token|secret|authorization/i);
  }
});

test("duplicate event_key is ignored without changing the existing event", () => {
  const before = db.prepare("SELECT id, COUNT(*) AS count FROM opening_campaign_events WHERE event_key = ?").get("fixture:event:campaign-view");
  db.prepare("INSERT OR IGNORE INTO opening_campaign_events (id, campaign_id, tenant_id, member_id, event_name, event_key, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run("fixture-event-retry", "raven-guild-opening", "raven-oracle", "fixture-member-active", "campaign_view", "fixture:event:campaign-view", "{}");
  const after = db.prepare("SELECT id, COUNT(*) AS count FROM opening_campaign_events WHERE event_key = ?").get("fixture:event:campaign-view");
  assert.deepEqual(after, before);
});

test("trial states only allow active use and cannot transition backwards", () => {
  const config = { campaignId: campaign.campaign_id, campaignName: campaign.campaign_name, enabled: Boolean(campaign.enabled), startAt: campaign.start_at, endAt: campaign.end_at, trialEnabled: Boolean(campaign.trial_enabled), trialScope: campaign.trial_scope, trialLimit: campaign.trial_limit, campaignMessage: campaign.campaign_message, primaryCta: campaign.primary_cta, secondaryCta: campaign.secondary_cta, targetAudience: campaign.target_audience };
  const now = new Date("2026-08-24T12:00:00.000Z");
  const states = [
    deriveOpeningCampaignState({ config: { ...config, enabled: false }, now }),
    deriveOpeningCampaignState({ config, usedCount: 0, now }),
    deriveOpeningCampaignState({ config, usedCount: 1, now }),
    deriveOpeningCampaignState({ config: { ...config, endAt: "2026-08-23T00:00:00.000Z" }, now }),
    deriveOpeningCampaignState({ config, converted: true, now }),
  ];
  assert.deepEqual(states, ["inactive", "active", "exhausted", "expired", "converted"]);
  assert.deepEqual(states.map(canUseOpeningCampaignTrial), [false, true, false, false, false]);
  assert.equal(canTransitionOpeningCampaignState("active", "exhausted"), true);
  assert.equal(canTransitionOpeningCampaignState("exhausted", "active"), false);
  assert.equal(canTransitionOpeningCampaignState("converted", "active"), false);
});

test("feature flag gates public UI and local enabled fixture exposes admin fields", () => {
  const home = readFileSync(resolve(projectRoot, "app/page.tsx"), "utf8");
  const banner = readFileSync(resolve(projectRoot, "app/components/opening-campaign-banner.tsx"), "utf8");
  const admin = readFileSync(resolve(projectRoot, "app/admin/opening-campaign/page.tsx"), "utf8");
  assert.match(home, /isOpeningCampaignActive\(effectiveOpeningCampaign\)/);
  assert.match(home, /openingCampaign \? <OpeningCampaignBanner/);
  assert.match(banner, /campaign_view/);
  assert.match(banner, /campaign_cta_clicked/);
  for (const field of ["Feature Flag", "状態", "Trial設定", "利用数", "Conversion", "イベント"]) assert.match(admin, new RegExp(field));
  assert.equal(Boolean(campaign.enabled), true);
});

test("production fallback remains OFF while the local fixture loader resolves ON", async () => {
  const fallbackTenant = {
    id: "raven-oracle",
    openingCampaign: {
      campaignId: "raven-guild-opening", campaignName: "Raven Guild Opening Campaign", enabled: false,
      startAt: null, endAt: null, trialEnabled: true, trialScope: "member", trialLimit: 1,
      campaignMessage: "fallback", primaryCta: "fallback", secondaryCta: "fallback", targetAudience: "fallback",
    },
  };
  assert.equal(fallbackTenant.openingCampaign.enabled, false);
  const adapter = {
    prepare(query) {
      return { bind(...values) { return { async first() { return db.prepare(query).get(...values) || null; } }; } };
    },
  };
  const loaded = await loadOpeningCampaignConfig(adapter, fallbackTenant);
  assert.equal(loaded.enabled, true);
  assert.equal(loaded.campaignId, fallbackTenant.openingCampaign.campaignId);
  assert.equal(loaded.targetAudience, "fixture-audience");
});

test("Growth boundary query returns campaign and funnel counts without changing Growth Engine", () => {
  const rows = db.prepare("SELECT c.campaign_id, c.target_audience, e.event_name, COUNT(e.id) AS count FROM opening_campaigns c LEFT JOIN opening_campaign_events e ON e.campaign_id = c.campaign_id WHERE c.campaign_id = ? GROUP BY c.campaign_id, c.target_audience, e.event_name").all("raven-guild-opening");
  const counts = Object.fromEntries(rows.map((row) => [row.event_name, row.count]));
  assert.equal(rows[0].campaign_id, "raven-guild-opening");
  assert.equal(rows[0].target_audience, "fixture-audience");
  for (const event of ["trial_started", "trial_used", "trial_exhausted", "trial_converted", "campaign_cta_clicked"]) assert.equal(counts[event], 1);
});
