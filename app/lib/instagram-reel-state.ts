export const INSTAGRAM_REEL_STATES = ["created", "processing", "ready", "publishing", "published", "failed"] as const;

export type InstagramReelState = (typeof INSTAGRAM_REEL_STATES)[number];

export type InstagramMetaError = {
  code: number | null;
  subcode: number | null;
  message: string | null;
  type: string | null;
};

export type InstagramContainerObservation = {
  state: InstagramReelState;
  metaStatus: string | null;
  error: InstagramMetaError;
};

const SECRET_KEYS = /access[_-]?token|authorization|client[_-]?secret|refresh[_-]?token/i;

export function sanitizeInstagramResponse(value: unknown, maxLength = 8000) {
  const scrub = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(scrub);
    if (input && typeof input === "object") {
      return Object.fromEntries(Object.entries(input).map(([key, item]) => [key, SECRET_KEYS.test(key) ? "[REDACTED]" : scrub(item)]));
    }
    return input;
  };
  const text = JSON.stringify(scrub(value ?? {}));
  return (text || "{}").slice(0, maxLength);
}

export function readInstagramMetaError(body: unknown): InstagramMetaError {
  const error = (body as { error?: { code?: unknown; error_subcode?: unknown; message?: unknown; type?: unknown } })?.error;
  return {
    code: Number.isFinite(Number(error?.code)) ? Number(error?.code) : null,
    subcode: Number.isFinite(Number(error?.error_subcode)) ? Number(error?.error_subcode) : null,
    message: error?.message ? String(error.message).slice(0, 500) : null,
    type: error?.type ? String(error.type).slice(0, 120) : null,
  };
}

export function observeInstagramContainer(httpStatus: number, body: unknown): InstagramContainerObservation {
  const metaStatus = typeof (body as { status_code?: unknown })?.status_code === "string" ? String((body as { status_code: string }).status_code).toUpperCase() : null;
  const error = readInstagramMetaError(body);
  const explicitError = metaStatus === "ERROR" || Boolean((body as { error?: unknown })?.error) || httpStatus >= 400;
  return {
    state: explicitError ? "failed" : metaStatus === "FINISHED" ? "ready" : "processing",
    metaStatus,
    error,
  };
}

export function isInstagramReelPost(post: { post_type?: unknown; media_type?: unknown }) {
  return String(post.post_type || "") === "reel" || String(post.media_type || "") === "video";
}
