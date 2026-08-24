import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpeningCampaignEvent,
  getOpeningCampaignLocale,
  sendOpeningCampaignEvent,
} from "../app/lib/opening-campaign-analytics.ts";

const config = {
  campaignId: "test-campaign",
  campaignName: "Test campaign",
  enabled: true,
  startAt: "2026-08-24T00:00:00Z",
  endAt: null,
  trialEnabled: true,
  trialScope: "reading",
  trialLimit: 1,
  campaignMessage: "Test message",
  primaryCta: "Primary",
  secondaryCta: "Secondary",
  targetAudience: "test-audience",
};

const event = {
  campaignId: "test-campaign",
  eventName: "campaign_cta_clicked",
  eventKey: "test-campaign:campaign_cta_clicked:/",
  payload: { page_path: "/" },
};

test("campaign analytics uses a navigation-safe keepalive request", async () => {
  let request;
  sendOpeningCampaignEvent(event, async (input, init) => {
    request = { input, init };
    return new Response(null, { status: 204 });
  });
  await Promise.resolve();

  assert.equal(request.input, "/api/opening-campaign/events");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.keepalive, true);
  assert.equal(request.init.headers["content-type"], "application/json");
  assert.deepEqual(JSON.parse(request.init.body), event);
});

test("campaign analytics failure does not throw or block navigation", async () => {
  assert.doesNotThrow(() => {
    sendOpeningCampaignEvent(event, async () => {
      throw new Error("analytics unavailable");
    });
  });
  await Promise.resolve();
});

test("campaign view payload includes the campaign analytics dimensions", () => {
  const request = buildOpeningCampaignEvent({
    config,
    eventType: "campaign_view",
    pagePath: "/",
    locale: "ja",
  });
  assert.deepEqual(request.payload, {
    campaign_id: "test-campaign",
    event_type: "campaign_view",
    audience: "test-audience",
    page_path: "/",
    locale: "ja",
  });
});

test("primary and secondary CTA payloads are distinguishable and idempotent", () => {
  const primary = buildOpeningCampaignEvent({ config, eventType: "campaign_cta_clicked", pagePath: "/", locale: "ja", ctaType: "primary" });
  const primaryRetry = buildOpeningCampaignEvent({ config, eventType: "campaign_cta_clicked", pagePath: "/", locale: "ja", ctaType: "primary" });
  const secondary = buildOpeningCampaignEvent({ config, eventType: "campaign_cta_clicked", pagePath: "/", locale: "ja", ctaType: "secondary" });

  assert.equal(primary.payload.cta_type, "primary");
  assert.equal(secondary.payload.cta_type, "secondary");
  assert.equal(primary.eventKey, primaryRetry.eventKey);
  assert.notEqual(primary.eventKey, secondary.eventKey);
  assert.deepEqual(primary.payload, {
    campaign_id: "test-campaign",
    event_type: "campaign_cta_clicked",
    audience: "test-audience",
    page_path: "/",
    locale: "ja",
    cta_type: "primary",
  });
});

test("locale uses the existing rendered document language boundary", () => {
  assert.equal(getOpeningCampaignLocale("en-US"), "en");
  assert.equal(getOpeningCampaignLocale("ja"), "ja");
  assert.equal(getOpeningCampaignLocale(""), "ja");
});
