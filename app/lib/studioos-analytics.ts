export type StudioOSAnalyticsScope = {
  guildId: string;
  tenantId: string;
  characterId: string;
  market: string;
  locale: string;
};

const allowedTenants = new Map([
  ["atlas-oracle", "atlas"],
  ["sol-oracle", "sol"],
]);

export function requireAnalyticsScope(scope: Partial<StudioOSAnalyticsScope> | null | undefined): StudioOSAnalyticsScope {
  const required = ["guildId", "tenantId", "characterId", "market", "locale"] as const;
  if (!scope || required.some((key) => typeof scope[key] !== "string" || scope[key].trim() === "")) {
    throw new Error("ANALYTICS_TENANT_CONTEXT_REQUIRED");
  }
  const resolved = scope as StudioOSAnalyticsScope;
  if (resolved.guildId !== "raven-guild" || allowedTenants.get(resolved.tenantId) !== resolved.characterId) {
    throw new Error("ANALYTICS_TENANT_CONTEXT_INVALID");
  }
  return resolved;
}

export function analyticsReadWhere(scope: Partial<StudioOSAnalyticsScope> | null | undefined) {
  const resolved = requireAnalyticsScope(scope);
  return {
    where: "guild_id = ? AND tenant_id = ? AND character_id = ? AND market = ? AND locale = ?",
    bindings: [resolved.guildId, resolved.tenantId, resolved.characterId, resolved.market, resolved.locale] as const,
  };
}

export function analyticsWriteValues(scope: Partial<StudioOSAnalyticsScope> | null | undefined) {
  return requireAnalyticsScope(scope);
}
