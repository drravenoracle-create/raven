export type SharedCardScope = {
  guild_id: string;
  tenant_id: string;
  character_id: string;
  market?: string;
  locale?: string;
};

export type SharedCardLibraryEnv = {
  GUILD_MEMBER_WORKER?: { fetch(request: Request): Promise<Response> };
  GUILD_MEMBER_API_BASE_URL?: string;
  GUILD_MEMBER_SERVICE_TOKEN?: string;
};

function clean(value: unknown, max = 240) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function headers(env: SharedCardLibraryEnv, scope: SharedCardScope, body?: unknown) {
  const result = new Headers({ accept: "application/json" });
  result.set("x-guild-id", clean(scope.guild_id, 80));
  result.set("x-tenant-id", clean(scope.tenant_id, 80));
  result.set("x-character-id", clean(scope.character_id, 80));
  result.set("x-market", clean(scope.market || "jp", 20));
  result.set("x-locale", clean(scope.locale || "ja-JP", 20));
  if (body !== undefined) result.set("content-type", "application/json");
  if (env.GUILD_MEMBER_SERVICE_TOKEN) result.set("authorization", `Bearer ${env.GUILD_MEMBER_SERVICE_TOKEN}`);
  return result;
}

export async function sharedCardLibraryRequest<T = unknown>(env: SharedCardLibraryEnv, scope: SharedCardScope, init: { method?: string; query?: Record<string, string>; body?: unknown } = {}) {
  const path = "/api/card-library";
  const query = new URLSearchParams(init.query || {}).toString();
  const url = `https://guild-member-core.internal${path}${query ? `?${query}` : ""}`;
  const requestInit: RequestInit = {
    method: init.method || (init.body === undefined ? "GET" : "POST"),
    headers: headers(env, scope, init.body),
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  };
  const response = env.GUILD_MEMBER_WORKER
    ? await env.GUILD_MEMBER_WORKER.fetch(new Request(url, requestInit))
    : await fetch(`${String(env.GUILD_MEMBER_API_BASE_URL || "https://guild-member-core.fortune-kanri.workers.dev").replace(/\/+$/, "")}${path}${query ? `?${query}` : ""}`, requestInit);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String((payload as Record<string, unknown>).error || `Shared card library request failed (${response.status})`));
  return payload as T;
}

export function listSharedCards(env: SharedCardLibraryEnv, scope: SharedCardScope, deckId?: string) {
  return sharedCardLibraryRequest(env, scope, { query: deckId ? { deck_id: deckId } : undefined });
}

export function selectSharedCards(env: SharedCardLibraryEnv, scope: SharedCardScope, deckId: string, count = 1) {
  return sharedCardLibraryRequest(env, scope, { method: "POST", body: { action: "selectCards", deck_id: deckId, count } });
}
