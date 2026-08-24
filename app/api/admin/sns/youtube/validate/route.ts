import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { decryptDriveRefreshToken, encryptDriveRefreshToken } from "@/app/lib/google-drive-oauth";
import { getAdminSession } from "@/app/lib/google-admin-auth";
import { resolveSnsConfig } from "@/app/lib/tenant-config-resolver";

const TENANT_ID = resolveSnsConfig().tenantId;

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ ok: false, error: "Admin authentication required." }, { status: 401 });
  try {
    const account = await env.DB.prepare("SELECT id, platform_account_id, display_name, refresh_token_ciphertext FROM sns_platform_accounts WHERE tenant_id = ? AND platform = 'youtube' AND status = 'connected' LIMIT 1").bind(TENANT_ID).first<{ id: string; platform_account_id?: string; display_name?: string; refresh_token_ciphertext?: string }>();
    if (!account?.refresh_token_ciphertext) return NextResponse.json({ ok: false, error: "YouTube refresh token is not stored." }, { status: 404 });
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) return NextResponse.json({ ok: false, error: "Google OAuth credentials are not configured." }, { status: 503 });
    const refreshToken = await decryptDriveRefreshToken(account.refresh_token_ciphertext);
    const refreshed = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }) });
    const token = await refreshed.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
    if (!refreshed.ok || !token.access_token) return NextResponse.json({ ok: false, step: "refresh", error: token.error_description || token.error || `Google token refresh failed (${refreshed.status})` }, { status: 502 });
    const channelResponse = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { Authorization: `Bearer ${token.access_token}` } });
    const channelPayload = await channelResponse.json().catch(() => ({})) as { items?: Array<{ id?: string; snippet?: { title?: string } }>; error?: { message?: string } };
    const channel = channelPayload.items?.[0];
    if (!channelResponse.ok || !channel?.id) return NextResponse.json({ ok: false, step: "youtube_api", error: channelPayload.error?.message || `YouTube API validation failed (${channelResponse.status})` }, { status: 502 });
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    const accessTokenCiphertext = await encryptDriveRefreshToken(token.access_token);
    await env.DB.prepare("UPDATE sns_platform_accounts SET platform_account_id = ?, display_name = ?, access_token_ciphertext = ?, token_expires_at = ?, last_validated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").bind(channel.id, channel.snippet?.title || account.display_name || "YouTube channel", accessTokenCiphertext, expiresAt, account.id, TENANT_ID).run();
    return NextResponse.json({ ok: true, platform: "youtube", account_id: channel.id, display_name: channel.snippet?.title || account.display_name || "YouTube channel", refreshed: true, token_expires_at: expiresAt, validated_at: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
