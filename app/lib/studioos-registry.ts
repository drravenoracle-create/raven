import { RAVEN_GUILD_CONFIG } from "./guild-config.ts";
import { RAVEN_STUDIOOS_TENANT_CONFIG, type TenantConfig } from "./studioos-tenant-config.ts";
import {
  ENGINE_VERSIONS,
  PRODUCTION_MIGRATION_STATE,
  STUDIOOS_VERSION,
  buildTenantVersionSummary,
  getBuildInfo,
  resolveVersionStatus,
  type CompatibilityStatus,
  type StudioOSMigrationState,
  type TenantVersionSummary,
  type VersionStatus,
} from "./studioos-version.ts";
import { featureEntitlementResolver, type FeatureDecision } from "./feature-entitlements.ts";

export type GuildStatus = "active" | "inactive" | "planned";
export type TenantStatus = "active" | "inactive" | "planned" | "attention_required";
export type WorkerStatus = "healthy" | "unknown" | "planned" | "attention_required";

export type GuildRecord = {
  guildId: string;
  guildName: string;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  status: GuildStatus;
  createdAt?: string | null;
};

export type TenantRecord = {
  tenantId: string;
  tenantKey: string;
  guildId: string;
  characterId?: string | null;
  displayName: string;
  plan: string;
  environment: string;
  status: TenantStatus;
  studioOsVersion: string;
  tenantSchemaVersion: number;
  buildCommit?: string | null;
  migration: StudioOSMigrationState;
  engineVersions: Record<string, string>;
  lastDeploy?: string | null;
  isFixture?: boolean;
  market?: string | null;
  country?: string | null;
  locale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  characterCoreId?: string | null;
  marketPersonaId?: string | null;
};

export type WorkerRecord = {
  workerId: string;
  tenantId: string;
  workerName: string;
  provider: "cloudflare";
  accountRef?: string | null;
  publicUrl?: string | null;
  environment: string;
  deployedVersion?: string | null;
  buildCommit?: string | null;
  lastDeploy?: string | null;
  status: WorkerStatus;
  isFixture?: boolean;
};

export type VersionCenterEntry = {
  tenant: TenantRecord;
  guild: GuildRecord;
  worker: WorkerRecord | null;
  version: TenantVersionSummary;
  engines: Record<string, string>;
  migration: StudioOSMigrationState;
  plan: string;
  entitlements: FeatureDecision[];
  enabledFeatureCount: number;
  deniedFeatureCount: number;
  overrideCount: number;
  lastDeploy: string | null;
  requiresHumanApproval: true;
};

export type RegistrySet = {
  guilds: GuildRecord[];
  tenants: TenantRecord[];
  workers: WorkerRecord[];
};

const RAVEN_GUILD: GuildRecord = {
  guildId: RAVEN_GUILD_CONFIG.id,
  guildName: RAVEN_GUILD_CONFIG.displayName,
  market: "jp",
  country: "JP",
  locale: "ja-JP",
  timezone: "Asia/Tokyo",
  currency: "JPY",
  status: "active",
};

const RAVEN_TENANT: TenantRecord = {
  tenantId: RAVEN_STUDIOOS_TENANT_CONFIG.tenantId,
  tenantKey: RAVEN_STUDIOOS_TENANT_CONFIG.tenantKey,
  guildId: RAVEN_GUILD.guildId,
  characterId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef,
  displayName: RAVEN_STUDIOOS_TENANT_CONFIG.identity.displayName,
  plan: RAVEN_STUDIOOS_TENANT_CONFIG.plan.planId || "PREMIUM",
  environment: "production",
  status: "active",
  studioOsVersion: STUDIOOS_VERSION,
  tenantSchemaVersion: RAVEN_STUDIOOS_TENANT_CONFIG.schemaVersion,
  buildCommit: null,
  migration: PRODUCTION_MIGRATION_STATE,
  engineVersions: ENGINE_VERSIONS,
  lastDeploy: null,
  market: "jp",
  country: "JP",
  locale: "ja-JP",
  timezone: "Asia/Tokyo",
  currency: "JPY",
  characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef,
  marketPersonaId: "raven-jp",
};

const RAVEN_WORKER: WorkerRecord = {
  workerId: "raven-oracle",
  tenantId: RAVEN_TENANT.tenantId,
  workerName: "raven-oracle",
  provider: "cloudflare",
  accountRef: "c7ce2613bf30affed8d2caae0068beb5",
  publicUrl: "https://raven-oracle.dr-ravenoracle.workers.dev",
  environment: "production",
  deployedVersion: null,
  buildCommit: null,
  lastDeploy: null,
  status: "unknown",
};

export const RAVEN_REGISTRY: RegistrySet = {
  guilds: [RAVEN_GUILD],
  tenants: [RAVEN_TENANT],
  workers: [RAVEN_WORKER],
};

export const VERSION_CENTER_FIXTURES: RegistrySet = {
  guilds: [
    { guildId: "test-global-guild", guildName: "Test Global Guild", market: "global", status: "active" },
  ],
  tenants: [
    {
      tenantId: "test-up-to-date",
      tenantKey: "test-up-to-date",
      guildId: "test-global-guild",
      displayName: "Test Up to Date",
      plan: "STANDARD",
      environment: "fixture",
      status: "active",
      studioOsVersion: STUDIOOS_VERSION,
      tenantSchemaVersion: 1,
      buildCommit: "fixture-up-to-date",
      migration: { migrationState: "not_required", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "compatible" },
      engineVersions: ENGINE_VERSIONS,
      lastDeploy: "2026-08-25T00:00:00Z",
      isFixture: true,
      market: "en-us", country: "US", locale: "en-US", timezone: "America/New_York", currency: "USD", characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef, marketPersonaId: "raven-en-us",
    },
    {
      tenantId: "test-update-available",
      tenantKey: "test-update-available",
      guildId: "test-global-guild",
      displayName: "Test Update Available",
      plan: "STANDARD",
      environment: "fixture",
      status: "active",
      studioOsVersion: "0.9.4",
      tenantSchemaVersion: 1,
      buildCommit: "fixture-update",
      migration: { migrationState: "not_required", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "compatible" },
      engineVersions: ENGINE_VERSIONS,
      lastDeploy: null,
      isFixture: true,
      market: "en-us", country: "US", locale: "en-US", timezone: "America/New_York", currency: "USD", characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef, marketPersonaId: "raven-en-us",
    },
    {
      tenantId: "test-migration-required",
      tenantKey: "test-migration-required",
      guildId: "test-global-guild",
      displayName: "Test Migration Required",
      plan: "PREMIUM",
      environment: "fixture",
      status: "attention_required",
      studioOsVersion: STUDIOOS_VERSION,
      tenantSchemaVersion: 0,
      buildCommit: "fixture-migration",
      migration: { migrationState: "controlled", d1MigrationVersion: "0028", migrationLedgerRef: "fixture-ledger", schemaCompatibility: "requiresMigration" },
      engineVersions: ENGINE_VERSIONS,
      lastDeploy: null,
      isFixture: true,
      market: "jp", country: "JP", locale: "ja-JP", timezone: "Asia/Tokyo", currency: "JPY", characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef, marketPersonaId: "raven-jp",
    },
    {
      tenantId: "test-incompatible",
      tenantKey: "test-incompatible",
      guildId: "test-global-guild",
      displayName: "Test Incompatible",
      plan: "LIGHT",
      environment: "fixture",
      status: "attention_required",
      studioOsVersion: "2.0.0",
      tenantSchemaVersion: 1,
      buildCommit: "fixture-incompatible",
      migration: { migrationState: "unknown", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "incompatible" },
      engineVersions: ENGINE_VERSIONS,
      lastDeploy: null,
      isFixture: true,
      market: "en-us", country: "US", locale: "en-US", timezone: "America/New_York", currency: "USD", characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef, marketPersonaId: "raven-en-us",
    },
    {
      tenantId: "test-attention-required",
      tenantKey: "test-attention-required",
      guildId: "test-global-guild",
      displayName: "Test Attention Required",
      plan: "STANDARD",
      environment: "fixture",
      status: "attention_required",
      studioOsVersion: STUDIOOS_VERSION,
      tenantSchemaVersion: 1,
      buildCommit: null,
      migration: { migrationState: "unknown", d1MigrationVersion: null, migrationLedgerRef: null, schemaCompatibility: "compatible" },
      engineVersions: ENGINE_VERSIONS,
      lastDeploy: null,
      isFixture: true,
      market: "en-us", country: "US", locale: "en-US", timezone: "America/New_York", currency: "USD", characterCoreId: RAVEN_STUDIOOS_TENANT_CONFIG.characterRef, marketPersonaId: "raven-en-us",
    },
  ],
  workers: [
    { workerId: "worker-test-up-to-date", tenantId: "test-up-to-date", workerName: "test-up-to-date", provider: "cloudflare", environment: "fixture", publicUrl: "https://test-up-to-date.example.invalid", deployedVersion: "fixture-1", buildCommit: "fixture-up-to-date", status: "healthy", isFixture: true },
    { workerId: "worker-test-update-available", tenantId: "test-update-available", workerName: "test-update-available", provider: "cloudflare", environment: "fixture", publicUrl: "https://test-update.example.invalid", deployedVersion: "fixture-1", buildCommit: "fixture-update", status: "healthy", isFixture: true },
    { workerId: "worker-test-migration-required", tenantId: "test-migration-required", workerName: "test-migration-required", provider: "cloudflare", environment: "fixture", publicUrl: "https://test-migration.example.invalid", deployedVersion: "fixture-1", buildCommit: "fixture-migration", status: "attention_required", isFixture: true },
    { workerId: "worker-test-incompatible", tenantId: "test-incompatible", workerName: "test-incompatible", provider: "cloudflare", environment: "fixture", publicUrl: "https://test-incompatible.example.invalid", deployedVersion: "fixture-1", buildCommit: "fixture-incompatible", status: "attention_required", isFixture: true },
    { workerId: "worker-test-attention", tenantId: "test-attention-required", workerName: "test-attention-required", provider: "cloudflare", environment: "fixture", publicUrl: "https://test-attention.example.invalid", deployedVersion: null, buildCommit: null, status: "unknown", isFixture: true },
  ],
};

function mergeRegistry(includeFixtures = false, extra?: RegistrySet): RegistrySet {
  return {
    guilds: [...RAVEN_REGISTRY.guilds, ...(includeFixtures ? VERSION_CENTER_FIXTURES.guilds : []), ...(extra?.guilds || [])],
    tenants: [...RAVEN_REGISTRY.tenants, ...(includeFixtures ? VERSION_CENTER_FIXTURES.tenants : []), ...(extra?.tenants || [])],
    workers: [...RAVEN_REGISTRY.workers, ...(includeFixtures ? VERSION_CENTER_FIXTURES.workers : []), ...(extra?.workers || [])],
  };
}

export class UnknownRegistryRecordError extends Error {
  constructor(kind: string, id: string) {
    super(`Unknown ${kind}: ${id}`);
    this.name = "UnknownRegistryRecordError";
  }
}

export class GuildRegistryRepository {
  private readonly set: RegistrySet;
  constructor(set: RegistrySet = RAVEN_REGISTRY) { this.set = set; }
  listGuilds() { return [...this.set.guilds]; }
  getGuild(guildId: string) { return this.set.guilds.find((item) => item.guildId === guildId); }
}

export class TenantRegistryRepository {
  private readonly set: RegistrySet;
  constructor(set: RegistrySet = RAVEN_REGISTRY) { this.set = set; }
  listTenants() { return [...this.set.tenants]; }
  getTenant(tenantId: string) { return this.set.tenants.find((item) => item.tenantId === tenantId); }
}

export class WorkerRegistryRepository {
  private readonly set: RegistrySet;
  constructor(set: RegistrySet = RAVEN_REGISTRY) { this.set = set; }
  listWorkers() { return [...this.set.workers]; }
  getWorker(workerId: string) { return this.set.workers.find((item) => item.workerId === workerId); }
  getWorkerForTenant(tenantId: string) { return this.set.workers.find((item) => item.tenantId === tenantId); }
}

function getEntitlements(tenant: TenantRecord): FeatureDecision[] {
  if (tenant.tenantId === RAVEN_TENANT.tenantId) return featureEntitlementResolver.resolveAllFeatures(tenant.tenantId);
  return [];
}

export function buildVersionCenterEntries(options: { includeFixtures?: boolean; targetVersion?: string; registry?: RegistrySet } = {}): VersionCenterEntry[] {
  const set = mergeRegistry(options.includeFixtures, options.registry);
  const guilds = new GuildRegistryRepository(set);
  const workers = new WorkerRegistryRepository(set);
  const tenants = new TenantRegistryRepository(set);
  return tenants.listTenants().map((tenant) => {
    const build = getBuildInfo({ buildCommit: tenant.buildCommit, environment: tenant.environment });
    const version = buildTenantVersionSummary({ ...RAVEN_STUDIOOS_TENANT_CONFIG, tenantId: tenant.tenantId, schemaVersion: tenant.tenantSchemaVersion, plan: { planId: tenant.plan }, urls: { publicUrl: RAVEN_STUDIOOS_TENANT_CONFIG.urls.publicUrl } } as TenantConfig, build, options.targetVersion);
    const compatibility: CompatibilityStatus = tenant.migration.schemaCompatibility;
    const status: VersionStatus = compatibility === "incompatible"
      ? "INCOMPATIBLE"
      : compatibility === "requiresMigration"
        ? "MIGRATION_REQUIRED"
        : tenant.buildCommit == null || tenant.migration.migrationState === "unknown"
          ? "ATTENTION_REQUIRED"
          : resolveVersionStatus({ currentVersion: tenant.studioOsVersion, targetVersion: options.targetVersion || STUDIOOS_VERSION, tenantSchemaVersion: tenant.tenantSchemaVersion, requiredTenantSchemaVersion: 1, compatibility });
    const entitlements = getEntitlements(tenant);
    const worker = workers.getWorkerForTenant(tenant.tenantId) || null;
    return {
      tenant,
      guild: guilds.getGuild(tenant.guildId) || { guildId: tenant.guildId, guildName: "Unknown Guild", status: "planned" },
      worker,
      version: { ...version, studioOsVersion: tenant.studioOsVersion, status, compatibility },
      engines: tenant.engineVersions,
      migration: tenant.migration,
      plan: tenant.plan,
      entitlements,
      enabledFeatureCount: entitlements.filter((item) => item.allowed).length,
      deniedFeatureCount: entitlements.filter((item) => !item.allowed).length,
      overrideCount: entitlements.filter((item) => item.tenantOverride !== "inherit").length,
      lastDeploy: tenant.lastDeploy || worker?.lastDeploy || null,
      requiresHumanApproval: true,
    };
  });
}

export function getTenantRegistryRecord(tenantId: string, includeFixtures = false) {
  const record = new TenantRegistryRepository(mergeRegistry(includeFixtures)).getTenant(tenantId);
  if (!record) throw new UnknownRegistryRecordError("tenant", tenantId);
  return record;
}

export function getWorkerRegistryRecord(workerId: string, includeFixtures = false) {
  const record = new WorkerRegistryRepository(mergeRegistry(includeFixtures)).getWorker(workerId);
  if (!record) throw new UnknownRegistryRecordError("worker", workerId);
  return record;
}

export type UpdatePlan = {
  tenantId: string;
  currentVersion: string;
  targetVersion: string;
  requiredMigrations: string[];
  compatibility: CompatibilityStatus;
  estimatedSteps: string[];
  requiresHumanApproval: true;
  executionAllowed: false;
};

export type ProvisioningStatus = "planned" | "configuring" | "preview" | "ready" | "published" | "attention_required";

export type TenantProvisioningRequest = {
  guildId: string;
  tenantId: string;
  characterId?: string | null;
  marketPersonaId?: string | null;
  workerName?: string | null;
  plan: string;
  status: ProvisioningStatus;
};

/** Future boundary only. Phase 5 supplies no implementation or Cloudflare call. */
export interface WorkerDeploymentService {
  planDeployment(workerId: string, targetVersion: string): Promise<UpdatePlan>;
}

/** Future boundary only. Controlled migrations remain a separate approved operation. */
export interface MigrationPlanner {
  planMigration(tenantId: string, targetSchemaVersion: number): Promise<UpdatePlan>;
}

export function buildReadOnlyUpdatePlan(entry: VersionCenterEntry, targetVersion = STUDIOOS_VERSION): UpdatePlan {
  return {
    tenantId: entry.tenant.tenantId,
    currentVersion: entry.tenant.studioOsVersion,
    targetVersion,
    requiredMigrations: entry.version.status === "MIGRATION_REQUIRED" ? [entry.migration.d1MigrationVersion || "tenant-schema"] : [],
    compatibility: entry.version.compatibility,
    estimatedSteps: ["human review", "backup", "controlled migration review", "deploy review", "smoke test"],
    requiresHumanApproval: true,
    executionAllowed: false,
  };
}

export const registry = {
  guilds: new GuildRegistryRepository(),
  tenants: new TenantRegistryRepository(),
  workers: new WorkerRegistryRepository(),
};
