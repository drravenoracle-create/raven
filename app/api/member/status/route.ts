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
    const [sessionPayload, linkPayload] = await Promise.all([
      getMemberSession(env, request),
      getMemberAuthLinks(env, request, { returnTo, menuId }),
    ]);
    return Response.json(
      {
        ok: true,
        flags,
        session: sessionPayload.session,
        trial_summary: sessionPayload.trial_summary || null,
        auth_links: {
          login_url: linkPayload.login_url || inactiveLinks.login_url,
          register_url: linkPayload.register_url || inactiveLinks.register_url,
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
