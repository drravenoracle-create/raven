import { env } from "cloudflare:workers";
import { encryptDriveRefreshToken } from "@/app/lib/google-drive-oauth";
import { resolveSnsConfig } from "@/app/lib/tenant-config-resolver";

export const SNS_TENANT_ID = resolveSnsConfig().tenantId;
export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
export const YOUTUBE_READ_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const YOUTUBE_SCOPES = [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_READ_SCOPE] as const;

export async function saveSnsAccount(input: { platform: string; accountId: string; displayName: string; scopes: string[]; accessToken: string; refreshToken?: string; expiresIn?: number }) {
  const row = await (env as any).DB.prepare("SELECT id FROM sns_platform_accounts WHERE tenant_id = ? AND platform = ? LIMIT 1").bind(SNS_TENANT_ID, input.platform).first();
  const id = row?.id || crypto.randomUUID();
  const expiresAt = input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000).toISOString() : null;
  const accessTokenCiphertext = await encryptDriveRefreshToken(input.accessToken);
  const refreshTokenCiphertext = input.refreshToken ? await encryptDriveRefreshToken(input.refreshToken) : null;
  await (env as any).DB.prepare(`INSERT INTO sns_platform_accounts (id, tenant_id, platform, platform_account_id, display_name, status, scopes_json, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, last_validated_at) VALUES (?, ?, ?, ?, ?, 'connected', ?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET platform_account_id=excluded.platform_account_id, display_name=excluded.display_name, status='connected', scopes_json=excluded.scopes_json, access_token_ciphertext=excluded.access_token_ciphertext, refresh_token_ciphertext=COALESCE(excluded.refresh_token_ciphertext, refresh_token_ciphertext), token_expires_at=excluded.token_expires_at, last_validated_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP`).bind(id, SNS_TENANT_ID, input.platform, input.accountId, input.displayName, JSON.stringify(input.scopes), accessTokenCiphertext, refreshTokenCiphertext, expiresAt).run();
}
