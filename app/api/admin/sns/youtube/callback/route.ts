import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { publicOrigin } from "@/app/lib/google-admin-auth";
import { saveSnsAccount } from "@/app/lib/sns-oauth";

const STATE_COOKIE = "raven_youtube_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const expected = request.headers.get("cookie")?.match(new RegExp(`${STATE_COOKIE}=([^;]+)`))?.[1];
  if (!state || !expected || state !== expected || !code) return NextResponse.json({ error: "Invalid YouTube OAuth session." }, { status: 400 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Google OAuth credentials are not configured." }, { status: 503 });

  const redirectUri = `${publicOrigin(request)}/api/admin/sns/youtube/callback`;
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const token = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !token.access_token) return NextResponse.json({ error: token.error_description || token.error || "YouTube token request failed." }, { status: 502 });

  const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const channelPayload = await channelResponse.json() as { items?: Array<{ id?: string; snippet?: { title?: string } }>; error?: { message?: string } };
  const channel = channelPayload.items?.[0];
  if (!channel?.id) return NextResponse.json({ error: channelPayload.error?.message || "No YouTube channel was found for this Google account." }, { status: 422 });

  await saveSnsAccount({ platform: "youtube", accountId: channel.id, displayName: channel.snippet?.title || "YouTube channel", scopes: (token.scope || "").split(" ").filter(Boolean), accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in });
  const response = NextResponse.redirect(new URL("/admin/sns?youtube=connected", request.url));
  response.cookies.delete(STATE_COOKIE);
  return response;
}
