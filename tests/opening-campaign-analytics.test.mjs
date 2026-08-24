import assert from "node:assert/strict";
import test from "node:test";
import { sendOpeningCampaignEvent } from "../app/lib/opening-campaign-analytics.ts";

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
