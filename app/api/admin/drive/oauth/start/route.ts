import { NextResponse } from "next/server";
import { googleRedirectUri, publicOrigin, randomState, GOOGLE_STATE_COOKIE } from "@/app/lib/google-admin-auth";
import { driveOAuthScope } from "@/app/lib/google-drive-oauth";

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not configured." }, { status: 503 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: googleRedirectUri(publicOrigin(request)), response_type: "code", access_type: "offline", prompt: "consent", scope: `openid email profile ${driveOAuthScope()}`, state: `drive.${randomState()}` }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, url.searchParams.get("state")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
