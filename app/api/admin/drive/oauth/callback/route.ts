import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { adminEmail, getAdminSession, googleRedirectUri, publicOrigin, requestCookieMatches, GOOGLE_STATE_COOKIE } from "@/app/lib/google-admin-auth";
import { encryptDriveRefreshToken } from "@/app/lib/google-drive-oauth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase() || !state || !requestCookieMatches(request, GOOGLE_STATE_COOKIE, state) || !code) return NextResponse.json({ error: "Invalid Drive OAuth session." }, { status: 400 });
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return NextResponse.json({ error: "Google OAuth credentials are not configured." }, { status: 503 });
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: `${publicOrigin(request)}/api/admin/drive/oauth/callback`, grant_type: "authorization_code" }) });
  const token = await tokenResponse.json() as { refresh_token?: string; access_token?: string; error?: string; error_description?: string };
  if (!tokenResponse.ok || !token.refresh_token) return NextResponse.json({ error: token.error_description || token.error || "Google did not return a refresh token. Retry with consent." }, { status: 502 });
  const encrypted = await encryptDriveRefreshToken(token.refresh_token);
  await (env as any).DB.prepare(`INSERT INTO google_drive_credentials (id, tenant_id, google_email, refresh_token_ciphertext) VALUES (?, ?, ?, ?) ON CONFLICT(tenant_id) DO UPDATE SET google_email=excluded.google_email, refresh_token_ciphertext=excluded.refresh_token_ciphertext, updated_at=CURRENT_TIMESTAMP`).bind(crypto.randomUUID(), "raven-oracle", session.email, encrypted).run();
  const response = NextResponse.redirect(new URL("/admin/sns?drive=connected", request.url));
  response.cookies.delete(GOOGLE_STATE_COOKIE);
  return response;
}
