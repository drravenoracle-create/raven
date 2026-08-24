export type OpeningCampaignEventRequest = {
  campaignId: string;
  eventName: string;
  eventKey: string;
  payload: Record<string, string>;
};

type AnalyticsTransport = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<unknown>;

export function sendOpeningCampaignEvent(
  event: OpeningCampaignEventRequest,
  transport: AnalyticsTransport = fetch,
) {
  void transport("/api/opening-campaign/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
