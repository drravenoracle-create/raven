import { env } from "cloudflare:workers";
import {
  getMemberAuthLinks,
  guildMemberFlags,
  memberReturnTo,
  menuIdForRavenReading,
  recordMemberEvent,
  RAVEN_CHARACTER_ID,
  RAVEN_TENANT_ID,
} from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

function directCoreAuthUrl(origin: string, mode: "login" | "register", returnTo: string, menuId: string) {
  const base = String(env.GUILD_MEMBER_API_BASE_URL || "").replace(/\/+$/, "");
  if (!base) return "";
  const target = new URL("/api/auth/google/start", base);
  target.searchParams.set("mode", mode);
  target.searchParams.set("return_to", new URL(returnTo, origin).toString());
  target.searchParams.set("menu_id", menuId);
  target.searchParams.set("tenant_id", RAVEN_TENANT_ID);
  target.searchParams.set("character_id", RAVEN_CHARACTER_ID);
  return target.toString();
}

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

  let target = "";
  try {
    const links = await getMemberAuthLinks(env, request, { returnTo, menuId, mode });
    target = mode === "register" ? links.register_url || "" : links.login_url || "";
  } catch {
    target = directCoreAuthUrl(url.origin, mode, returnTo, menuId);
  }
  if (!target) return Response.redirect(new URL("/member/?member_unavailable=links", url.origin).toString(), 302);
  return Response.redirect(target, 302);
}
