import { TENANT_SCHEMA_VERSION, type TenantConfig } from "./studioos-tenant-config.ts";

export const STUDIOOS_VERSION = "1.0.0";

export const ENGINE_VERSIONS = {
  analytics: "1.0.0",
  blog: "2.0.0",
  sns: "1.0.0",
  reel: "1.0.0",
  growth: "3.0.0",
  openingCampaign: "1.0.0",
  renderer: "1.0.0",
  memberBoundary: "1.0.0",
} as const;

export type VersionStatus = "UP_TO_DATE" | "UPDATE_AVAILABLE" | "MIGRATION_REQUIRED" | "INCOMPATIBLE" | "ATTENTION_REQUIRED";
export type CompatibilityStatus = "compatible" | "requiresMigration" | "incompatible";

export type StudioOSBuildInfo = {
  studioOsVersion: string;
  buildCommit: string | null;
  buildTime: string | null;
  environment: string;
  tenantSchemaVersion: number;
};

export type StudioOSMigrationState = {
  migrationState: "controlled" | "unknown" | "not_required" | "not_provisioned";
  d1MigrationVersion: string | null;
  migrationLedgerRef: string | null;
  schemaCompatibility: CompatibilityStatus;
};

export type TenantVersionSummary = {
  tenantId: string;
  studioOsVersion: string;
  tenantSchemaVersion: number;
  buildCommit: string | null;
  status: VersionStatus;
  compatibility: CompatibilityStatus;
};

export const PRODUCTION_MIGRATION_STATE: StudioOSMigrationState = {
  migrationState: "controlled",
  d1MigrationVersion: "controlled-0028-0032",
  migrationLedgerRef: "docs/operations/production-d1-controlled-migrations.md",
  schemaCompatibility: "compatible",
};

export function getBuildInfo(input: Partial<Omit<StudioOSBuildInfo, "studioOsVersion" | "tenantSchemaVersion">> = {}): StudioOSBuildInfo {
  return {
    studioOsVersion: STUDIOOS_VERSION,
    buildCommit: input.buildCommit?.trim() || null,
    buildTime: input.buildTime?.trim() || null,
    environment: input.environment?.trim() || "unknown",
    tenantSchemaVersion: TENANT_SCHEMA_VERSION,
  };
}

export function parseSemVer(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function compareSemVer(current: string, target: string): number | null {
  const left = parseSemVer(current);
  const right = parseSemVer(target);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] > right[index] ? 1 : -1;
  }
  return 0;
}

export function resolveVersionStatus(input: {
  currentVersion: string;
  targetVersion?: string | null;
  tenantSchemaVersion: number;
  requiredTenantSchemaVersion?: number | null;
  compatibility?: CompatibilityStatus;
}): VersionStatus {
  if (input.compatibility === "incompatible") return "INCOMPATIBLE";
  if (input.requiredTenantSchemaVersion != null && input.tenantSchemaVersion < input.requiredTenantSchemaVersion) return "MIGRATION_REQUIRED";
  if (!input.targetVersion) return "UP_TO_DATE";
  const comparison = compareSemVer(input.currentVersion, input.targetVersion);
  if (comparison == null) return "ATTENTION_REQUIRED";
  return comparison < 0 ? "UPDATE_AVAILABLE" : "UP_TO_DATE";
}

export function buildTenantVersionSummary(tenant: TenantConfig, build: StudioOSBuildInfo = getBuildInfo(), targetVersion?: string | null): TenantVersionSummary {
  const compatibility = PRODUCTION_MIGRATION_STATE.schemaCompatibility;
  return {
    tenantId: tenant.tenantId,
    studioOsVersion: build.studioOsVersion,
    tenantSchemaVersion: tenant.schemaVersion,
    buildCommit: build.buildCommit,
    status: resolveVersionStatus({ currentVersion: build.studioOsVersion, targetVersion, tenantSchemaVersion: tenant.schemaVersion, requiredTenantSchemaVersion: TENANT_SCHEMA_VERSION, compatibility }),
    compatibility,
  };
}
