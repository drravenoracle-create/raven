import { pilotEntitlementResolver, pilotTenantConfigResolver } from "./studioos-pilot.ts";
import type { TenantConfig } from "./studioos-tenant-config.ts";

export type TenantAlias = {
  alias: string;
  canonicalTenantId: string;
  source: "legacy" | "migration";
};

export const STUDIOOS_TENANT_ALIASES: readonly TenantAlias[] = [
  { alias: "luna-starwind", canonicalTenantId: "luna-oracle", source: "legacy" },
  { alias: "scarlet-guardian", canonicalTenantId: "scarlet-donovan", source: "legacy" },
];

const HOST_TO_TENANT = new Map([
  ["raven.fortunestudios.jp", "raven-oracle"],
  ["luna.fortunestudios.jp", "luna-oracle"],
  ["scarlet.fortunestudios.jp", "scarlet-donovan"],
  ["atlas.fortunestudios.jp", "atlas-oracle"],
  ["sol.fortunestudios.jp", "sol-oracle"],
]);

export class UnknownRuntimeTenantError extends Error {
  constructor(value: string) {
    super(`Unknown runtime tenant: ${value}`);
    this.name = "UnknownRuntimeTenantError";
  }
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveTenantIdFromHost(host: string): string {
  const tenantId = HOST_TO_TENANT.get(normalizeHost(host));
  if (!tenantId) throw new UnknownRuntimeTenantError(host);
  return tenantId;
}

export function resolveTenantIdFromHint(hint: string): string {
  const normalized = hint.trim().toLowerCase();
  const alias = STUDIOOS_TENANT_ALIASES.find((item) => item.alias === normalized);
  const tenantId = alias?.canonicalTenantId ?? normalized;
  if (!pilotTenantConfigResolver.getTenantConfig(tenantId)) throw new UnknownRuntimeTenantError(hint);
  return tenantId;
}

export type RuntimeResolutionInput = { host?: string; tenantHint?: string };

export type TenantRuntimeContext = {
  tenantId: string;
  config: TenantConfig;
  character: NonNullable<ReturnType<typeof pilotTenantConfigResolver.getCharacterConfig>>;
  localization: ReturnType<typeof pilotTenantConfigResolver.getTenantLocalization>;
  entitlements: ReturnType<typeof pilotEntitlementResolver.resolveAllFeatures>;
  analytics: ReturnType<typeof pilotTenantConfigResolver.getAnalyticsConfig>;
  blog: ReturnType<typeof pilotTenantConfigResolver.getBlogConfig>;
  sns: ReturnType<typeof pilotTenantConfigResolver.getSnsConfig>;
  reel: ReturnType<typeof pilotTenantConfigResolver.getReelConfig>;
  growth: ReturnType<typeof pilotTenantConfigResolver.getGrowthConfig>;
  alias?: TenantAlias;
};

export function resolveRuntimeTenantId(input: RuntimeResolutionInput): string {
  if (input.tenantHint) return resolveTenantIdFromHint(input.tenantHint);
  if (input.host) return resolveTenantIdFromHost(input.host);
  throw new UnknownRuntimeTenantError("missing host and tenant hint");
}

export function resolveRuntimeContext(input: RuntimeResolutionInput): TenantRuntimeContext {
  const requestedHint = input.tenantHint?.trim().toLowerCase();
  const alias = requestedHint ? STUDIOOS_TENANT_ALIASES.find((item) => item.alias === requestedHint) : undefined;
  const tenantId = resolveRuntimeTenantId(input);
  const config = pilotTenantConfigResolver.requireTenantConfig(tenantId);
  const character = pilotTenantConfigResolver.getCharacterConfig(config.characterRef);
  if (!character) throw new UnknownRuntimeTenantError(`missing character: ${config.characterRef}`);

  const slices = {
    localization: pilotTenantConfigResolver.getTenantLocalization(tenantId),
    entitlements: pilotEntitlementResolver.resolveAllFeatures(tenantId),
    analytics: pilotTenantConfigResolver.getAnalyticsConfig(tenantId),
    blog: pilotTenantConfigResolver.getBlogConfig(tenantId),
    sns: pilotTenantConfigResolver.getSnsConfig(tenantId),
    reel: pilotTenantConfigResolver.getReelConfig(tenantId),
    growth: pilotTenantConfigResolver.getGrowthConfig(tenantId),
  };

  for (const slice of [slices.analytics, slices.blog, slices.sns, slices.reel, slices.growth]) {
    if (slice.tenantId !== tenantId) throw new Error(`Tenant slice mismatch: ${tenantId}`);
  }
  if (config.identity.tenantId !== tenantId || config.characterRef !== character.characterId) {
    throw new Error(`Tenant identity mismatch: ${tenantId}`);
  }

  return { tenantId, config, character, ...slices, alias };
}
