import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  GOOGLE_STATE_COOKIE,
  adminEmail,
  adminSessionMaxAge,
  createSessionCookie,
  googleRedirectUri,
  publicOrigin,
  requestCookieMatches,
} from "@/app/lib/google-admin-auth";
import { env } from "cloudflare:workers";
import { encryptDriveRefreshToken } from "@/app/lib/google-drive-oauth";

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
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
  const origin = publicOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !requestCookieMatches(request, GOOGLE_STATE_COOKIE, state)) {
    return new Response("Invalid Google OAuth state.", { status: 400 });
  }

  const isDriveConnection = state.startsWith("drive.");
  const returnTo = isDriveConnection ? "/admin/sns" : decodeURIComponent(state.split(".").slice(1).join(".")) || "/admin/";
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: googleRedirectUri(origin),
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

  if (isDriveConnection) {
    if (!token.refresh_token) return new Response("Google did not return a refresh token. Retry the Drive connection with consent.", { status: 502 });
    const encrypted = await encryptDriveRefreshToken(token.refresh_token);
    await (env as any).DB.prepare(`INSERT INTO google_drive_credentials (id, tenant_id, google_email, refresh_token_ciphertext) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET google_email=excluded.google_email, refresh_token_ciphertext=excluded.refresh_token_ciphertext, updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(), "raven-oracle", user.email, encrypted).run();
  }

  const response = NextResponse.redirect(new URL(returnTo, origin));
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
