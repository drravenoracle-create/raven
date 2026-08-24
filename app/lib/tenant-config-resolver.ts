import {
  RAVEN_CHARACTER_CORE,
  RAVEN_STUDIOOS_TENANT_CONFIG,
  type AnalyticsConfigSlice,
  type BlogConfigSlice,
  type CharacterCoreConfig,
  type GrowthConfigSlice,
  type TenantConfig,
  type TenantEntitlementConfig,
  type TenantLocalizationConfig,
  type ReelConfigSlice,
  type SnsConfigSlice,
  validateTenantConfig,
} from "./studioos-tenant-config.ts";

export class UnknownTenantError extends Error {
  constructor(tenantId: string) {
    super(`Unknown tenant: ${tenantId}`);
    this.name = "UnknownTenantError";
  }
}

export class InvalidTenantConfigError extends Error {
  readonly missing: string[];

  constructor(missing: string[]) {
    super(`Invalid tenant config: missing ${missing.join(", ")}`);
    this.name = "InvalidTenantConfigError";
    this.missing = missing;
  }
}

export class TenantConfigResolver {
  private readonly tenants: ReadonlyMap<string, TenantConfig>;

  constructor(configs: readonly TenantConfig[] = [RAVEN_STUDIOOS_TENANT_CONFIG]) {
    const invalid = configs.flatMap((config) => validateTenantConfig(config));
    if (invalid.length) throw new InvalidTenantConfigError([...new Set(invalid)]);
    this.tenants = new Map(configs.map((config) => [config.tenantId, config]));
  }

  getTenantConfig(tenantId: string): TenantConfig | undefined {
    return this.tenants.get(tenantId);
  }

  requireTenantConfig(tenantId: string): TenantConfig {
    const config = this.getTenantConfig(tenantId);
    if (!config) throw new UnknownTenantError(tenantId);
    return config;
  }

  getTenantIdentity(tenantId: string) {
    return this.requireTenantConfig(tenantId).identity;
  }

  getTenantLocalization(tenantId: string): TenantLocalizationConfig {
    return this.requireTenantConfig(tenantId).localization;
  }

  getAnalyticsConfig(tenantId: string): AnalyticsConfigSlice {
    return this.requireTenantConfig(tenantId).analytics;
  }

  getBlogConfig(tenantId: string): BlogConfigSlice {
    return this.requireTenantConfig(tenantId).blog;
  }

  getSnsConfig(tenantId: string): SnsConfigSlice {
    return this.requireTenantConfig(tenantId).sns;
  }

  getReelConfig(tenantId: string): ReelConfigSlice {
    return this.requireTenantConfig(tenantId).reel;
  }

  getGrowthConfig(tenantId: string): GrowthConfigSlice {
    return this.requireTenantConfig(tenantId).growth;
  }

  getEntitlements(tenantId: string): TenantEntitlementConfig {
    return this.requireTenantConfig(tenantId).entitlements;
  }

  getCharacterConfig(characterId: string): CharacterCoreConfig | undefined {
    return characterId === RAVEN_CHARACTER_CORE.characterId ? RAVEN_CHARACTER_CORE : undefined;
  }
}

export const tenantConfigResolver = new TenantConfigResolver();

export const getTenantConfig = (tenantId: string) => tenantConfigResolver.getTenantConfig(tenantId);
export const getTenantIdentity = (tenantId: string) => tenantConfigResolver.getTenantIdentity(tenantId);
export const getTenantLocalization = (tenantId: string) => tenantConfigResolver.getTenantLocalization(tenantId);
export const resolveAnalyticsConfig = (tenantId: string) => tenantConfigResolver.getAnalyticsConfig(tenantId);
export const resolveBlogConfig = (tenantId: string) => tenantConfigResolver.getBlogConfig(tenantId);
export const resolveSnsConfig = (tenantId: string) => tenantConfigResolver.getSnsConfig(tenantId);
export const resolveReelConfig = (tenantId: string) => tenantConfigResolver.getReelConfig(tenantId);
export const resolveGrowthConfig = (tenantId: string) => tenantConfigResolver.getGrowthConfig(tenantId);
export const getEntitlements = (tenantId: string) => tenantConfigResolver.getEntitlements(tenantId);
