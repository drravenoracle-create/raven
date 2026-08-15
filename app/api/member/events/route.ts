import { env } from "cloudflare:workers";
import { guildMemberFlags, recordMemberEvent } from "@/app/lib/guild-member-client";

const allowedEvents = new Set([
  "member_registration_started",
  "member_registered",
  "login_completed",
  "trial_offer_viewed",
  "trial_started",
  "trial_completed",
  "reading_started",
  "reading_completed",
  "reading_history_viewed",
  "reading_repeated",
  "character_switched",
  "paid_reading_purchased",
]);

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  const eventName = clean(body.event_name ?? body.eventName, 80);
  if (!allowedEvents.has(eventName)) return Response.json({ ok: false, error: "Invalid event_name." }, { status: 400 });

  const flags = guildMemberFlags(env);
  await recordMemberEvent(env, request, eventName, {
    menu_id: clean(body.menu_id, 80),
    page_path: clean(body.page_path, 240),
    target_character_id: clean(body.target_character_id, 80),
    source: clean(body.source, 80),
  });

  return Response.json({ ok: true, forwarded: flags.configured }, { headers: { "Cache-Control": "no-store" } });
}
