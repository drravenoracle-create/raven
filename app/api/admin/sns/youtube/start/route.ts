import { NextResponse } from "next/server";
import { googleRedirectUri, publicOrigin, randomState } from "@/app/lib/google-admin-auth";
import { YOUTUBE_SCOPES } from "@/app/lib/sns-oauth";

const STATE_COOKIE = "raven_youtube_oauth_state";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not configured." }, { status: 503 });
  const state = randomState();
  const redirectUri = `${publicOrigin(request)}/api/admin/sns/youtube/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: YOUTUBE_SCOPES.join(" "), state }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
