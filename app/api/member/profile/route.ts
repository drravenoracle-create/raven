import { env } from "cloudflare:workers";
import { getMemberSession, guildMemberErrorResponse, guildMemberFlags } from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

function validBirthDate(value: unknown) {
  const date = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return null;
  if (parsed > new Date()) return null;
  return date;
}

async function authenticatedMember(request: Request) {
  const flags = guildMemberFlags(env);
  if (!flags.member_system_enabled || !flags.configured) {
    return { error: Response.json({ ok: false, error: "Member system is unavailable.", code: "member_system_unavailable" }, { status: 503 }) };
  }
  const sessionPayload = await getMemberSession(env, request);
  const session = sessionPayload.session;
  if (!session.authenticated || !session.member_id) {
    return { error: Response.json({ ok: false, error: "Login is required.", code: "member_login_required" }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  }
  return { memberId: session.member_id };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatedMember(request);
    if (auth.error) return auth.error;
    const row = await env.DB.prepare("SELECT birth_date, updated_at FROM member_profiles WHERE member_id = ?1").bind(auth.memberId).first<{ birth_date?: string; updated_at?: string }>();
    return Response.json({ ok: true, profile: { birth_date: row?.birth_date || null, updated_at: row?.updated_at || null } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return guildMemberErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticatedMember(request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => null) as { birth_date?: unknown } | null;
    const birthDate = validBirthDate(body?.birth_date);
    if (!birthDate) return Response.json({ ok: false, error: "生年月日は正しい日付で入力してください。", code: "invalid_birth_date" }, { status: 400 });
    await env.DB.prepare(
      `INSERT INTO member_profiles (member_id, birth_date) VALUES (?1, ?2)
       ON CONFLICT(member_id) DO UPDATE SET birth_date = excluded.birth_date, updated_at = datetime('now')`,
    ).bind(auth.memberId, birthDate).run();
    return Response.json({ ok: true, profile: { birth_date: birthDate } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return guildMemberErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await authenticatedMember(request);
    if (auth.error) return auth.error;
    await env.DB.prepare("DELETE FROM member_profiles WHERE member_id = ?1").bind(auth.memberId).run();
    return Response.json({ ok: true, profile: { birth_date: null } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return guildMemberErrorResponse(error);
  }
}
