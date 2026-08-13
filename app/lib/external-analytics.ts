const TENANT_ID = "raven-oracle";

export type ExternalMetric = {
  source: "ga4" | "search_console" | "cloudflare";
  entityType: string;
  entityId: string;
  metricName: string;
  metricValue: number;
  measuredAt: string;
  windowStart: string;
  windowEnd: string;
  dataQuality: "measured" | "partial";
  metadata?: Record<string, unknown>;
};

export type ConnectorSyncResult = {
  source: ExternalMetric["source"];
  configured: boolean;
  ok: boolean;
  metrics: ExternalMetric[];
  error?: string;
};

type RuntimeEnv = Record<string, string | undefined>;

function envValue(env: unknown, name: string) {
  return String((env as RuntimeEnv)?.[name] || "").trim();
}

function isoDate(offsetDays: number) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function base64Url(input: ArrayBuffer | Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input instanceof Uint8Array ? input : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePrivateKey(raw: string) {
  let value = raw.trim();

  if (value.startsWith("{") && value.includes("private_key")) {
    try {
      const parsed = JSON.parse(value) as { private_key?: string };
      value = parsed.private_key || value;
    } catch {
      // Fall through to string cleanup below.
    }
  }

  value = value.trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  value = value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  const match = value.match(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/);
  if (match) value = match[0];

  const base64 = value.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  if (!base64 || base64.length % 4 === 1) throw new Error("Invalid private key base64 content");
  return base64;
}

function pemToArrayBuffer(pem: string) {
  const normalized = normalizePrivateKey(pem);
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function googleAccessToken(env: unknown, scope: string) {
  const clientEmail = envValue(env, "GOOGLE_SERVICE_ACCOUNT_EMAIL");
  const privateKey = envValue(env, "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  if (!clientEmail || !privateKey) return { configured: false, token: "" };

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: clientEmail,
    scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claim))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToArrayBuffer(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${base64Url(signature)}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  const payload = (await response.json().catch(() => ({}))) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || payload.error || `google_token_${response.status}`);
  return { configured: true, token: payload.access_token };
}

function metric(source: ExternalMetric["source"], metricName: string, value: number, start: string, end: string, metadata?: Record<string, unknown>): ExternalMetric {
  return {
    source,
    entityType: "site",
    entityId: TENANT_ID,
    metricName,
    metricValue: Number.isFinite(value) ? value : 0,
    measuredAt: new Date().toISOString(),
    windowStart: start,
    windowEnd: end,
    dataQuality: "measured",
    metadata,
  };
}

export async function fetchGa4Metrics(env: unknown, days: number): Promise<ConnectorSyncResult> {
  const propertyId = envValue(env, "GA4_PROPERTY_ID");
  if (!propertyId) return { source: "ga4", configured: false, ok: false, metrics: [], error: "GA4_PROPERTY_ID is not configured" };
  try {
    const auth = await googleAccessToken(env, "https://www.googleapis.com/auth/analytics.readonly");
    if (!auth.configured) return { source: "ga4", configured: false, ok: false, metrics: [], error: "Google service account secrets are not configured" };
    const start = isoDate(-days);
    const end = isoDate(-1);
    const response = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ dateRanges: [{ startDate: start, endDate: end }], metrics: [{ name: "activeUsers" }, { name: "screenPageViews" }, { name: "sessions" }, { name: "engagementRate" }] }),
    });
    const payload = (await response.json().catch(() => ({}))) as { rows?: { metricValues?: { value?: string }[] }[]; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `ga4_${response.status}`);
    const values = payload.rows?.[0]?.metricValues || [];
    return {
      source: "ga4",
      configured: true,
      ok: true,
      metrics: [
        metric("ga4", "active_users", Number(values[0]?.value || 0), start, end),
        metric("ga4", "page_views", Number(values[1]?.value || 0), start, end),
        metric("ga4", "sessions", Number(values[2]?.value || 0), start, end),
        metric("ga4", "engagement_rate", Number(values[3]?.value || 0), start, end),
      ],
    };
  } catch (error) {
    return { source: "ga4", configured: true, ok: false, metrics: [], error: error instanceof Error ? error.message : "GA4 sync failed" };
  }
}

export async function fetchSearchConsoleMetrics(env: unknown, days: number): Promise<ConnectorSyncResult> {
  const siteUrl = envValue(env, "SEARCH_CONSOLE_SITE_URL") || "https://raven.fortunestudios.jp/";
  try {
    const auth = await googleAccessToken(env, "https://www.googleapis.com/auth/webmasters.readonly");
    if (!auth.configured) return { source: "search_console", configured: false, ok: false, metrics: [], error: "Google service account secrets are not configured" };
    const start = isoDate(-days);
    const end = isoDate(-1);
    const response = await fetch(`https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: start, endDate: end, dimensions: ["date"], rowLimit: 25000 }),
    });
    const payload = (await response.json().catch(() => ({}))) as { rows?: { clicks?: number; impressions?: number; ctr?: number; position?: number }[]; error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || `search_console_${response.status}`);
    const totals = (payload.rows || []).reduce(
      (sum, row) => ({ clicks: sum.clicks + Number(row.clicks || 0), impressions: sum.impressions + Number(row.impressions || 0), ctr: sum.ctr + Number(row.ctr || 0), position: sum.position + Number(row.position || 0), rows: sum.rows + 1 }),
      { clicks: 0, impressions: 0, ctr: 0, position: 0, rows: 0 },
    );
    return {
      source: "search_console",
      configured: true,
      ok: true,
      metrics: [
        metric("search_console", "clicks", totals.clicks, start, end, { siteUrl }),
        metric("search_console", "impressions", totals.impressions, start, end, { siteUrl }),
        metric("search_console", "ctr", totals.rows ? totals.ctr / totals.rows : 0, start, end, { siteUrl }),
        metric("search_console", "average_position", totals.rows ? totals.position / totals.rows : 0, start, end, { siteUrl }),
      ],
    };
  } catch (error) {
    return { source: "search_console", configured: true, ok: false, metrics: [], error: error instanceof Error ? error.message : "Search Console sync failed" };
  }
}

export async function fetchCloudflareAnalyticsMetrics(env: unknown, days: number): Promise<ConnectorSyncResult> {
  const token = envValue(env, "CLOUDFLARE_API_TOKEN");
  const zoneTag = envValue(env, "CLOUDFLARE_ZONE_ID");
  if (!token || !zoneTag) return { source: "cloudflare", configured: false, ok: false, metrics: [], error: "CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID is not configured" };
  try {
    const start = isoDate(-days);
    const end = isoDate(0);
    const query = `query ZoneAnalytics($zoneTag: string, $start: Date, $end: Date) { viewer { zones(filter: { zoneTag: $zoneTag }) { httpRequests1dGroups(limit: 100, filter: { date_geq: $start, date_lt: $end }) { sum { requests pageViews bytes threats } } } } }`;
    const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { zoneTag, start, end } }),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: { viewer?: { zones?: { httpRequests1dGroups?: { sum?: Record<string, number> }[] }[] } }; errors?: { message?: string }[] };
    if (!response.ok || payload.errors?.length) throw new Error(payload.errors?.[0]?.message || `cloudflare_${response.status}`);
    const sums = payload.data?.viewer?.zones?.[0]?.httpRequests1dGroups || [];
    const total = sums.reduce((acc, item) => ({ requests: acc.requests + Number(item.sum?.requests || 0), pageViews: acc.pageViews + Number(item.sum?.pageViews || 0), bytes: acc.bytes + Number(item.sum?.bytes || 0), threats: acc.threats + Number(item.sum?.threats || 0) }), { requests: 0, pageViews: 0, bytes: 0, threats: 0 });
    return {
      source: "cloudflare",
      configured: true,
      ok: true,
      metrics: [
        metric("cloudflare", "requests", total.requests, start, end, { zoneTag }),
        metric("cloudflare", "page_views", total.pageViews, start, end, { zoneTag }),
        metric("cloudflare", "bytes", total.bytes, start, end, { zoneTag }),
        metric("cloudflare", "threats", total.threats, start, end, { zoneTag }),
      ],
    };
  } catch (error) {
    return { source: "cloudflare", configured: true, ok: false, metrics: [], error: error instanceof Error ? error.message : "Cloudflare Analytics sync failed" };
  }
}

export async function fetchExternalAnalyticsMetrics(env: unknown, days: number) {
  return Promise.all([fetchGa4Metrics(env, days), fetchSearchConsoleMetrics(env, days), fetchCloudflareAnalyticsMetrics(env, days)]);
}


