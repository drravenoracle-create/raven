import { env } from "cloudflare:workers";
import { exchangeMemberSession } from "@/app/lib/guild-member-client";

export const dynamic = "force-dynamic";

function safeReturnTo(value: string | null) {
  if (!value) return "/member/";
  try {
    const url = new URL(value);
    if (url.origin === "https://raven.fortunestudios.jp") return url.toString();
  } catch {}
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  return "/member/";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const transferToken = url.searchParams.get("transfer_token") || "";
  const fallbackReturnTo = safeReturnTo(url.searchParams.get("return_to"));
  if (!transferToken) return Response.redirect(new URL("/member/?auth_error=missing_transfer", url.origin), 302);

  try {
    const result = await exchangeMemberSession(env, request, transferToken);
    const cookie = result.session_cookie;
    if (!cookie?.name || !cookie.value || !cookie.expires_at) {
      return Response.redirect(new URL("/member/?auth_error=session_cookie", url.origin), 302);
    }
    const parts = [
      `${cookie.name}=${encodeURIComponent(cookie.value)}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Lax",
      `Expires=${new Date(cookie.expires_at).toUTCString()}`,
    ];
    if (cookie.domain) parts.push(`Domain=${cookie.domain}`);
    return new Response(null, {
      status: 302,
      headers: {
        Location: safeReturnTo(result.return_to || fallbackReturnTo),
        "Set-Cookie": parts.join("; "),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.redirect(new URL("/member/?auth_error=exchange_failed", url.origin), 302);
  }
}
