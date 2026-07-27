import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  GOOGLE_STATE_COOKIE,
  adminEmail,
  adminSessionMaxAge,
  createSessionCookie,
  googleRedirectUri,
} from "@/app/lib/google-admin-auth";

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type UserInfo = {
  email?: string;
  email_verified?: boolean;
};

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return new Response("Google OAuth is not configured.", { status: 503 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = request.headers.get("cookie")?.match(new RegExp(`${GOOGLE_STATE_COOKIE}=([^;]+)`))?.[1];
  if (!code || !state || !storedState || decodeURIComponent(storedState) !== state) {
    return new Response("Invalid Google OAuth state.", { status: 400 });
  }

  const returnTo = decodeURIComponent(state.split(".").slice(1).join(".")) || "/admin/";
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(url.origin),
    }),
  });
  const token = (await tokenResponse.json()) as TokenResponse;
  if (!tokenResponse.ok || !token.access_token) {
    return new Response(token.error_description || token.error || "Google token request failed.", { status: 502 });
  }

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  const user = (await userResponse.json()) as UserInfo;
  if (!userResponse.ok || !user.email || !user.email_verified) {
    return new Response("Google account email could not be verified.", { status: 403 });
  }
  if (user.email.toLowerCase() !== adminEmail().toLowerCase()) {
    return new Response("This Google account is not allowed to access Raven admin.", { status: 403 });
  }

  const response = NextResponse.redirect(new URL(returnTo, url.origin));
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  response.cookies.set(ADMIN_SESSION_COOKIE, await createSessionCookie(user.email), {
    httpOnly: true,
    maxAge: adminSessionMaxAge(),
    path: "/",
    sameSite: "lax",
    secure: true,
  });
  return response;
}