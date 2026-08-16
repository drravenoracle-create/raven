export const GUILD_ID = "raven-guild";
export const RAVEN_TENANT_ID = "raven-oracle";
export const RAVEN_CHARACTER_ID = "raven";

export type GuildMemberEnv = {
  GUILD_MEMBER_WORKER?: { fetch(request: Request): Promise<Response> };
  GUILD_MEMBER_API_BASE_URL?: string;
  GUILD_MEMBER_SERVICE_TOKEN?: string;
  MEMBER_SYSTEM_ENABLED?: string;
  TRIAL_ENABLED?: string;
  READING_HISTORY_ENABLED?: string;
  CROSS_CHARACTER_ACCESS_ENABLED?: string;
};

export type MemberSession = {
  authenticated: boolean;
  member_id?: string;
  display_name?: string;
  email_verified?: boolean;
};

export type TrialReservation = {
  reservation_id: string;
  entitlement_id?: string;
  is_trial?: boolean;
};

export class GuildMemberError extends Error {
  status: number;
  code: string;
  authUrl?: string;
  registerUrl?: string;

  constructor(message: string, status = 503, code = "member_unavailable", links?: { authUrl?: string; registerUrl?: string }) {
    super(message);
    this.status = status;
    this.code = code;
    this.authUrl = links?.authUrl;
    this.registerUrl = links?.registerUrl;
  }
}

function enabled(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function cleanPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

export function guildMemberFlags(env: GuildMemberEnv) {
  const configured = Boolean(env.GUILD_MEMBER_WORKER || env.GUILD_MEMBER_API_BASE_URL);
  return {
    configured,
    member_system_enabled: enabled(env.MEMBER_SYSTEM_ENABLED, false),
    trial_enabled: enabled(env.TRIAL_ENABLED, true),
    reading_history_enabled: enabled(env.READING_HISTORY_ENABLED, true),
    cross_character_access_enabled: enabled(env.CROSS_CHARACTER_ACCESS_ENABLED, true),
  };
}

export function isGuildMemberSystemActive(env: GuildMemberEnv) {
  const flags = guildMemberFlags(env);
  return flags.member_system_enabled;
}

function requestHeaders(request: Request | null, env: GuildMemberEnv, body?: unknown) {
  const headers = new Headers();
  headers.set("accept", "application/json");
  headers.set("x-guild-id", GUILD_ID);
  headers.set("x-tenant-id", RAVEN_TENANT_ID);
  headers.set("x-character-id", RAVEN_CHARACTER_ID);
  if (body !== undefined) headers.set("content-type", "application/json");
  const cookie = request?.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (env.GUILD_MEMBER_SERVICE_TOKEN) headers.set("authorization", `Bearer ${env.GUILD_MEMBER_SERVICE_TOKEN}`);
  return headers;
}

export async function guildMemberRequest<T = unknown>(env: GuildMemberEnv, path: string, init: { method?: string; body?: unknown; request?: Request | null } = {}) {
  const flags = guildMemberFlags(env);
  if (!flags.configured) throw new GuildMemberError("Guild Member Core is not configured.", 503, "member_core_not_configured");

  const urlPath = cleanPath(path);
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);
  const requestInit: RequestInit = {
    method: init.method || (body ? "POST" : "GET"),
    headers: requestHeaders(init.request || null, env, init.body),
    body,
  };

  const response = env.GUILD_MEMBER_WORKER
    ? await env.GUILD_MEMBER_WORKER.fetch(new Request(`https://guild-member-core.internal${urlPath}`, requestInit))
    : await fetch(`${String(env.GUILD_MEMBER_API_BASE_URL).replace(/\/+$/, "")}${urlPath}`, requestInit);

  const text = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new GuildMemberError(String(payload.error || payload.message || "Guild Member Core request failed."), response.status, String(payload.code || "member_core_error"), {
      authUrl: typeof payload.auth_url === "string" ? payload.auth_url : undefined,
      registerUrl: typeof payload.register_url === "string" ? payload.register_url : undefined,
    });
  }
  return payload as T;
}

export function memberReturnTo(request: Request, fallback = "/text-reading/") {
  const url = new URL(request.url);
  return url.searchParams.get("return_to") || url.searchParams.get("returnTo") || fallback;
}

export function authContext(menuId?: string, source = "raven") {
  return {
    guild_id: GUILD_ID,
    tenant_id: RAVEN_TENANT_ID,
    character_id: RAVEN_CHARACTER_ID,
    menu_id: menuId || "",
    source,
  };
}

export async function getMemberSession(env: GuildMemberEnv, request: Request) {
  return guildMemberRequest<{ session: MemberSession; trial_summary?: unknown }>(env, "/api/member/session", { request });
}

export async function getMemberAuthLinks(env: GuildMemberEnv, request: Request, input: { returnTo: string; menuId?: string; mode?: "login" | "register" }) {
  return guildMemberRequest<{ login_url?: string; register_url?: string }>(env, "/api/member/auth/links", {
    method: "POST",
    request,
    body: {
      return_to: input.returnTo,
      mode: input.mode || "login",
      context: authContext(input.menuId, "raven_site"),
    },
  });
}

export async function reserveReadingEntitlement(env: GuildMemberEnv, request: Request, input: { menuId: string; readingMode: string; consultationSummary?: string }) {
  return guildMemberRequest<TrialReservation>(env, "/api/member/trials/reserve", {
    method: "POST",
    request,
    body: {
      ...authContext(input.menuId, "raven_reading"),
      reading_mode: input.readingMode,
      consultation_summary: input.consultationSummary || "",
    },
  });
}

export async function commitReadingEntitlement(env: GuildMemberEnv, request: Request, input: {
  reservationId: string;
  menuId: string;
  readingId?: string;
  consultationSummary?: string;
  inputSnapshot?: unknown;
  resultSnapshot: unknown;
  promptVersion: string;
  modelIdentifier?: string;
  divinationMethods?: string[];
}) {
  return guildMemberRequest<{ reading_id: string }>(env, "/api/member/trials/commit-reading", {
    method: "POST",
    request,
    body: {
      ...authContext(input.menuId, "raven_reading"),
      reservation_id: input.reservationId,
      reading_id: input.readingId,
      consultation_summary: input.consultationSummary || "",
      input_snapshot: input.inputSnapshot || {},
      result_snapshot: input.resultSnapshot,
      prompt_version: input.promptVersion,
      model_identifier: input.modelIdentifier || "",
      divination_methods: input.divinationMethods || [],
    },
  });
}

export async function releaseReadingEntitlement(env: GuildMemberEnv, request: Request, input: { reservationId: string; reason: string }) {
  return guildMemberRequest(env, "/api/member/trials/release", {
    method: "POST",
    request,
    body: { reservation_id: input.reservationId, reason: input.reason, context: authContext() },
  });
}

export async function getReadingHistory(env: GuildMemberEnv, request: Request, query = "") {
  return guildMemberRequest(env, `/api/member/readings${query ? `?${query}` : ""}`, { request });
}

export async function getReadingDetail(env: GuildMemberEnv, request: Request, readingId: string) {
  return guildMemberRequest(env, `/api/member/readings/${encodeURIComponent(readingId)}`, { request });
}

export async function recordMemberEvent(env: GuildMemberEnv, request: Request | null, eventName: string, payload: Record<string, unknown> = {}) {
  if (!guildMemberFlags(env).configured) return null;
  return guildMemberRequest(env, "/api/member/events", {
    method: "POST",
    request,
    body: {
      event_name: eventName,
      context: authContext(String(payload.menu_id || ""), "raven_site"),
      payload,
    },
  }).catch(() => null);
}

export async function exchangeMemberSession(env: GuildMemberEnv, request: Request, transferToken: string) {
  return guildMemberRequest<{
    return_to?: string;
    session_cookie?: {
      name?: string;
      value?: string;
      domain?: string;
      expires_at?: string;
    };
  }>(env, "/api/member/auth/exchange", {
    method: "POST",
    request,
    body: { transfer_token: transferToken },
  });
}

export function menuIdForRavenReading(input: { mode?: string; theme?: unknown; divination?: unknown }) {
  if (input.mode === "fortune") return `raven-free-${String(input.theme || "today")}`;
  if (input.mode === "reading") return `raven-text-${String(input.divination || "integrated")}`;
  if (input.mode === "chat") return "raven-chat-followup";
  return "raven-reading";
}

export function guildMemberErrorResponse(error: unknown) {
  if (error instanceof GuildMemberError) {
    return Response.json(
      {
        ok: false,
        error: error.message,
        code: error.code,
        auth_url: error.authUrl,
        register_url: error.registerUrl,
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return Response.json({ ok: false, error: "Guild Member System request failed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
}
