import { env } from "cloudflare:workers";
import {
  getMemberAuthLinks,
  guildMemberFlags,
  memberReturnTo,
  menuIdForRavenReading,
  recordMemberEvent,
} from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "register" ? "register" : "login";
  const returnTo = memberReturnTo(request, "/member/");
  const menuId = url.searchParams.get("menu_id") || menuIdForRavenReading({ mode: "reading" });
  const flags = guildMemberFlags(env);

  if (!flags.member_system_enabled || !flags.configured) {
    const fallback = new URL("/member/", url.origin);
    fallback.searchParams.set("member_unavailable", flags.member_system_enabled ? "core" : "disabled");
    fallback.searchParams.set("return_to", returnTo);
    return Response.redirect(fallback.toString(), 302);
  }

  if (mode === "register") {
    await recordMemberEvent(env, request, "member_registration_started", { menu_id: menuId, return_to: returnTo });
  }

  const links = await getMemberAuthLinks(env, request, { returnTo, menuId, mode });
  const target = mode === "register" ? links.register_url : links.login_url;
  if (!target) return Response.redirect(new URL("/member/?member_unavailable=links", url.origin).toString(), 302);
  return Response.redirect(target, 302);
}
