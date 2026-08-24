import test from "node:test";
import assert from "node:assert/strict";
import { deriveOpeningCampaignState, isOpeningCampaignActive, isOpeningCampaignEvent } from "../app/lib/opening-campaign.ts";

const base = { campaignId: "test", campaignName: "Test", enabled: true, startAt: "2026-08-24T00:00:00Z", endAt: "2026-08-31T00:00:00Z", trialEnabled: true, trialScope: "member", trialLimit: 1, campaignMessage: "", primaryCta: "", secondaryCta: "", targetAudience: "" };
test("feature flag off preserves inactive state", () => { assert.equal(isOpeningCampaignActive({ ...base, enabled: false }, new Date("2026-08-25T00:00:00Z")), false); assert.equal(deriveOpeningCampaignState({ config: { ...base, enabled: false }, now: new Date("2026-08-25T00:00:00Z") }), "inactive"); });
test("active, exhausted, expired, converted states", () => { const now = new Date("2026-08-25T00:00:00Z"); assert.equal(deriveOpeningCampaignState({ config: base, now }), "active"); assert.equal(deriveOpeningCampaignState({ config: base, usedCount: 1, now }), "exhausted"); assert.equal(deriveOpeningCampaignState({ config: base, now: new Date("2026-09-01T00:00:00Z") }), "expired"); assert.equal(deriveOpeningCampaignState({ config: base, converted: true, now }), "converted"); });
test("campaign event names are bounded", () => { assert.equal(isOpeningCampaignEvent("campaign_view"), true); assert.equal(isOpeningCampaignEvent("unknown"), false); });
