import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";

type CountRow = { event_name: string; count: number };
type PathRow = { page_path: string; count: number };
type ReferrerRow = { referrer_host: string; count: number };
type DailyRow = { day: string; count: number };
type ExternalMetricRow = { source: string; metric_name: string; metric_value: number; measured_at: string; window_start?: string; window_end?: string; data_quality: string };
type ConnectorRow = { source: string; provider: string; enabled: number; sync_status: string; last_success_at?: string; last_attempt_at?: string; last_error?: string };

function daysFromPeriod(period: string | null) {
  const value = Number(period || 30);
  if (!Number.isFinite(value)) return 30;
  const normalized = Math.floor(value);
  return normalized >= 1 && normalized <= 365 ? normalized : 30;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = daysFromPeriod(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [eventCounts, uniqueVisitors, topPages, referrers, daily, externalMetrics, externalConnectors] = await Promise.all([
    env.DB.prepare("SELECT event_name, COUNT(*) AS count FROM analytics_events WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY event_name").bind(TENANT_ID, since).all<CountRow>(),
    env.DB.prepare("SELECT COUNT(DISTINCT visitor_hash) AS count FROM analytics_events WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) AND visitor_hash != ''").bind(TENANT_ID, since).first<{ count: number }>(),
    env.DB.prepare("SELECT page_path, COUNT(*) AS count FROM analytics_events WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY page_path ORDER BY count DESC LIMIT 10").bind(TENANT_ID, since).all<PathRow>(),
    env.DB.prepare("SELECT referrer_host, COUNT(*) AS count FROM analytics_events WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) AND referrer_host != '' GROUP BY referrer_host ORDER BY count DESC LIMIT 10").bind(TENANT_ID, since).all<ReferrerRow>(),
    env.DB.prepare("SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count FROM analytics_events WHERE tenant_id = ? AND datetime(created_at) >= datetime(?) GROUP BY day ORDER BY day ASC").bind(TENANT_ID, since).all<DailyRow>(),
    env.DB.prepare("SELECT source, metric_name, metric_value, measured_at, window_start, window_end, data_quality FROM growth_metric_points WHERE tenant_id = ? AND source IN ('ga4','search_console','cloudflare') ORDER BY datetime(measured_at) DESC LIMIT 30").bind(TENANT_ID).all<ExternalMetricRow>(),
    env.DB.prepare("SELECT source, provider, enabled, sync_status, last_success_at, last_attempt_at, last_error FROM growth_data_connectors WHERE tenant_id = ? AND source IN ('ga4','search_console','cloudflare') ORDER BY source").bind(TENANT_ID).all<ConnectorRow>(),
  ]);

  const counts = eventCounts.results || [];
  const count = (eventName: string) => Number(counts.find((row) => row.event_name === eventName)?.count || 0);
  return Response.json(
    {
      periodDays: days,
      visits: count("page_view"),
      readings: count("raven_text_reading"),
      readingFormViews: count("reading_form_viewed"),
      readingSubmitClicks: count("reading_submit_clicked"),
      readingInputEmpty: count("reading_input_empty"),
      readingApiFailures: count("reading_api_failed"),
      readingCompletions: count("reading_completed"),
      chatStarts: count("timed_chat_start"),
      noteViews: count("admin_note_view"),
      primaryActions: count("raven_primary_action"),
      uniqueVisitors: Number(uniqueVisitors?.count || 0),
      eventCounts: counts,
      topPages: topPages.results || [],
      referrers: referrers.results || [],
      daily: daily.results || [],
      externalMetrics: externalMetrics.results || [],
      externalConnectors: externalConnectors.results || [],
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
