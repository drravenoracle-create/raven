import { NextResponse } from "next/server";
import { publicOrigin, randomState } from "@/app/lib/google-admin-auth";

const STATE_COOKIE = "raven_tiktok_oauth_state";
const TIKTOK_SCOPES = "user.info.basic,video.publish,video.upload";

export async function GET(request: Request) {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  if (!clientKey) return NextResponse.json({ error: "TIKTOK_CLIENT_KEY is not configured." }, { status: 503 });
  const state = randomState();
  const redirectUri = `${publicOrigin(request)}/api/admin/sns/tiktok/callback`;
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.search = new URLSearchParams({ client_key: clientKey, response_type: "code", scope: TIKTOK_SCOPES, redirect_uri: redirectUri, state }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
