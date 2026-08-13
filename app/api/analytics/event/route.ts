import { env } from "cloudflare:workers";

const TENANT_ID = "raven-oracle";
const allowedEvents = new Set(["page_view", "raven_text_reading", "timed_chat_start", "admin_note_view", "raven_primary_action"]);

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function hostFrom(value: string) {
  try {
    return value ? new URL(value).hostname.slice(0, 160) : "";
  } catch {
    return "";
  }
}

async function visitorHash(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const ua = request.headers.get("user-agent") || "";
  const day = new Date().toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`${ip}:${ua}:${day}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });

  const tenantId = clean(body.tenantId ?? body.tenant_id, 80) || TENANT_ID;
  if (tenantId !== TENANT_ID) return Response.json({ error: "Invalid tenant_id" }, { status: 400 });

  const eventName = clean(body.eventName ?? body.event_name, 80);
  if (!allowedEvents.has(eventName)) return Response.json({ error: "Invalid event_name" }, { status: 400 });

  const referrer = clean(body.referrer, 500);
  await env.DB.prepare(
    `INSERT INTO analytics_events
      (id, tenant_id, event_name, page_path, page_title, referrer, referrer_host, source, medium, campaign, link_url, link_text, visitor_hash, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      tenantId,
      eventName,
      clean(body.pagePath ?? body.page_path, 240) || "/",
      clean(body.pageTitle ?? body.page_title, 240),
      referrer,
      hostFrom(referrer),
      clean(body.source, 120),
      clean(body.medium, 120),
      clean(body.campaign, 180),
      clean(body.linkUrl ?? body.link_url, 500),
      clean(body.linkText ?? body.link_text, 180),
      await visitorHash(request),
      clean(request.headers.get("user-agent"), 500),
    )
    .run();

  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
