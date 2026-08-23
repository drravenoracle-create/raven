import { NextResponse } from "next/server";
import { publicOrigin } from "@/app/lib/google-admin-auth";
import { saveSnsAccount } from "@/app/lib/sns-oauth";

const STATE_COOKIE = "raven_tiktok_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.headers.get("Cookie")?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !expected || state !== expected) return NextResponse.json({ error: "Invalid TikTok OAuth session." }, { status: 400 });
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) return NextResponse.json({ error: "TikTok OAuth secrets are not configured." }, { status: 503 });
  const redirectUri = `${publicOrigin(request)}/api/admin/sns/tiktok/callback`;
  const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: clientKey, client_secret: clientSecret, code, grant_type: "authorization_code", redirect_uri: redirectUri }) });
  const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token || !token.open_id) return NextResponse.json({ error: token.error_description || token.error || "TikTok token request failed." }, { status: 502 });
  const profileResponse = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const profile = await profileResponse.json() as { data?: { user?: { open_id?: string; display_name?: string } }; error?: { message?: string } };
  if (!profileResponse.ok || !profile.data?.user?.open_id) return NextResponse.json({ error: profile.error?.message || "TikTok account info request failed." }, { status: 502 });
  await saveSnsAccount({ platform: "tiktok", accountId: profile.data.user.open_id, displayName: profile.data.user.display_name || "TikTok account", scopes: (token.scope || "").split(",").filter(Boolean), accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in });
  const response = NextResponse.redirect(new URL("/admin/sns?tiktok=connected", request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
