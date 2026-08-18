import { env } from "cloudflare:workers";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseJstDateEnd(value: string) {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
  const parsed = new Date(`${normalized}T23:59:59+09:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function instagramTokenStatus() {
  const expiresAt = String(env.INSTAGRAM_TOKEN_EXPIRES_AT || "").trim();
  const expiresAtDate = parseJstDateEnd(expiresAt);
  const renewalTargetAt = String(env.INSTAGRAM_TOKEN_RENEWAL_TARGET_AT || "").trim()
    || (expiresAtDate ? formatDateOnly(addDays(expiresAtDate, -7)) : "");
  const configured = Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID);

  if (!expiresAtDate) {
    return {
      configured,
      expires_at: null,
      renewal_target_at: renewalTargetAt || null,
      days_remaining: null,
      level: "unknown",
      message: configured
        ? "Instagramトークン期限が未設定です。INSTAGRAM_TOKEN_EXPIRES_ATを設定してください。"
        : "Instagram APIが未設定です。",
    };
  }

  const daysRemaining = Math.ceil((expiresAtDate.getTime() - Date.now()) / 86_400_000);
  const level = daysRemaining < 0 ? "expired" : daysRemaining <= 7 ? "critical" : daysRemaining <= 30 ? "warning" : "ok";
  const message = daysRemaining < 0
    ? "Instagramトークン期限が切れています。再取得が必要です。"
    : daysRemaining <= 7
      ? "Instagramトークン期限が近いです。すぐに更新してください。"
      : daysRemaining <= 30
        ? "Instagramトークン期限が30日以内です。更新準備をしてください。"
        : "Instagramトークンは有効期限内です。";

  return {
    configured,
    expires_at: expiresAt,
    renewal_target_at: renewalTargetAt || null,
    days_remaining: daysRemaining,
    level,
    message,
  };
}

export function GET() {
  return Response.json(
    {
      ok: true,
      worker: "raven-oracle",
      tenantId: "raven-oracle",
      version: "sns-engine-raven-2026-08-09",
      instagram: {
        access_token_configured: Boolean(env.INSTAGRAM_ACCESS_TOKEN),
        account_id_configured: Boolean(env.INSTAGRAM_ACCOUNT_ID),
        token: instagramTokenStatus(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
