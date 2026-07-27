import { NextResponse } from "next/server";
import { GOOGLE_STATE_COOKIE, googleRedirectUri, randomState, safeRelativeReturnPath } from "@/app/lib/google-admin-auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("GOOGLE_CLIENT_ID is not configured.", { status: 503 });

  const url = new URL(request.url);
  const returnTo = safeRelativeReturnPath(url.searchParams.get("return_to"));
  const state = `${randomState()}.${encodeURIComponent(returnTo)}`;
  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", googleRedirectUri(url.origin));
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return response;
}