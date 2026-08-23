// @ts-expect-error Node-based fixture tests import TypeScript modules directly.
import { readInstagramMetaError, sanitizeInstagramResponse, type InstagramReelState } from "./instagram-reel-state.ts";

export type InstagramReconciliationResult = {
  state: InstagramReelState | "reconciliation_required";
  metaStatus: string | null;
  mediaId: string | null;
  reason: string;
  error: ReturnType<typeof readInstagramMetaError>;
  responseBody: string;
};

export function classifyInstagramReconciliation(httpStatus: number, body: unknown): InstagramReconciliationResult {
  const rawStatus = (body as { status_code?: unknown })?.status_code;
  const metaStatus = typeof rawStatus === "string" ? rawStatus.toUpperCase() : null;
  const error = readInstagramMetaError(body);
  const mediaId = typeof (body as { media_id?: unknown })?.media_id === "string" ? String((body as { media_id: string }).media_id) : null;
  const responseBody = sanitizeInstagramResponse(body);

  if (metaStatus === "ERROR" || metaStatus === "EXPIRED") {
    return { state: "failed", metaStatus, mediaId: null, reason: metaStatus === "EXPIRED" ? "Meta側でcontainerが期限切れです。再投稿前に人間確認が必要です。" : "Meta側がcontainerをエラーとして確定しました。", error, responseBody };
  }
  if (metaStatus === "PUBLISHED" && mediaId) {
    return { state: "published", metaStatus, mediaId, reason: "Meta側の公開状態とmedia IDを確認できました。", error, responseBody };
  }
  if (metaStatus === "PUBLISHED") {
    return { state: "reconciliation_required", metaStatus, mediaId: null, reason: "Meta側はPUBLISHEDですが、確実なmedia IDが返らないため自動確定しません。", error, responseBody };
  }
  if (metaStatus === "FINISHED") {
    return { state: "reconciliation_required", metaStatus, mediaId: null, reason: "Meta側はFINISHEDですが、publish結果が不明なため再publishしません。", error, responseBody };
  }
  if (metaStatus === "IN_PROGRESS") {
    return { state: "reconciliation_required", metaStatus, mediaId: null, reason: "Meta側で処理中です。完了確認まで自動再投稿しません。", error, responseBody };
  }
  return { state: "reconciliation_required", metaStatus, mediaId: null, reason: httpStatus >= 400 ? "Meta status確認自体に失敗しました。再投稿せず人間確認が必要です。" : "Meta statusとmedia IDを確定できないため人間確認が必要です。", error, responseBody };
}
