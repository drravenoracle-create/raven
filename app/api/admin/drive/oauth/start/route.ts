import { NextResponse } from "next/server";
import { adminEmail, getAdminSession, googleRedirectUri, publicOrigin, randomState, safeRelativeReturnPath, GOOGLE_STATE_COOKIE } from "@/app/lib/google-admin-auth";
import { driveOAuthScope } from "@/app/lib/google-drive-oauth";

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) return NextResponse.redirect(new URL(`/api/admin/auth/google/start?return_to=${encodeURIComponent("/admin/sns")}`, request.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.json({ error: "GOOGLE_CLIENT_ID is not configured." }, { status: 503 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${publicOrigin(request)}/api/admin/drive/oauth/callback`, response_type: "code", access_type: "offline", prompt: "consent", scope: `openid email profile ${driveOAuthScope()}`, state: randomState() }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, url.searchParams.get("state")!, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
