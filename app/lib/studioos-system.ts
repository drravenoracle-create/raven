import { featureEntitlementResolver } from "./feature-entitlements.ts";
import { tenantConfigResolver } from "./tenant-config-resolver.ts";
import { buildTenantVersionSummary, ENGINE_VERSIONS, getBuildInfo, PRODUCTION_MIGRATION_STATE, type StudioOSBuildInfo } from "./studioos-version.ts";

export function getStudioOSSnapshot(tenantId: string, buildInput: Partial<StudioOSBuildInfo> = {}) {
  const tenant = tenantConfigResolver.requireTenantConfig(tenantId);
  const build = getBuildInfo(buildInput);
  return {
    version: buildTenantVersionSummary(tenant, build),
    build,
    engines: ENGINE_VERSIONS,
    migration: PRODUCTION_MIGRATION_STATE,
    plan: tenant.plan.planId || "PREMIUM",
    entitlements: featureEntitlementResolver.resolveAllFeatures(tenantId),
  };
}
