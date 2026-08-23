import { env } from "cloudflare:workers";
import {
  getMemberAuthLinks,
  getMemberSession,
  guildMemberFlags,
  GuildMemberError,
  memberReturnTo,
  menuIdForRavenReading,
} from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const flags = guildMemberFlags(env);
  const returnTo = memberReturnTo(request, "/member/");
  const url = new URL(request.url);
  const menuId = url.searchParams.get("menu_id") || menuIdForRavenReading({ mode: "reading" });
  const inactiveLinks = {
    login_url: `/api/member/auth/start?mode=login&return_to=${encodeURIComponent(returnTo)}&menu_id=${encodeURIComponent(menuId)}`,
    register_url: `/api/member/auth/start?mode=register&return_to=${encodeURIComponent(returnTo)}&menu_id=${encodeURIComponent(menuId)}`,
  };

  if (!flags.member_system_enabled || !flags.configured) {
    return Response.json(
      {
        ok: true,
        flags,
        session: { authenticated: false },
        auth_links: inactiveLinks,
        unavailable_reason: flags.member_system_enabled ? "member_core_not_configured" : "member_system_disabled",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const linkPayload = await getMemberAuthLinks(env, request, { returnTo, menuId }).catch(() => inactiveLinks);
    const sessionPayload = await getMemberSession(env, request).catch((error) => {
      if (error instanceof GuildMemberError && (error.status === 401 || error.code === "member_login_required" || error.code === "service_unauthorized")) {
        return { session: { authenticated: false }, trial_summary: null };
      }
      throw error;
    });
    const profile = sessionPayload.session?.authenticated && sessionPayload.session.member_id
      ? await env.DB.prepare("SELECT birth_date FROM member_profiles WHERE member_id = ?1").bind(sessionPayload.session.member_id).first<{ birth_date?: string }>().catch(() => null)
      : null;
    return Response.json(
      {
        ok: true,
        flags,
        session: sessionPayload.session,
        profile: { birth_date: profile?.birth_date || null },
        trial_summary: sessionPayload.trial_summary || null,
        auth_links: {
          login_url: linkPayload.login_url || inactiveLinks.login_url,
          register_url: linkPayload.register_url || inactiveLinks.register_url,
          google_login_url: linkPayload.google_login_url || linkPayload.login_url || inactiveLinks.login_url,
          google_register_url: linkPayload.google_register_url || linkPayload.register_url || inactiveLinks.register_url,
          email_login_url: linkPayload.email_login_url,
          email_register_url: linkPayload.email_register_url,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof GuildMemberError ? error.status : 503;
    return Response.json(
      {
        ok: false,
        flags,
        session: { authenticated: false },
        auth_links: inactiveLinks,
        error: error instanceof Error ? error.message : "Guild Member System is unavailable.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
