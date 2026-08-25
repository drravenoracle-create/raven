import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RAVEN_REGISTRY,
  VERSION_CENTER_FIXTURES,
  GuildRegistryRepository,
  TenantRegistryRepository,
  WorkerRegistryRepository,
  UnknownRegistryRecordError,
  buildVersionCenterEntries,
  buildReadOnlyUpdatePlan,
  getTenantRegistryRecord,
  getWorkerRegistryRecord,
} from "../app/lib/studioos-registry.ts";

test("Raven Guild, Tenant and Worker are registered", () => {
  assert.equal(new GuildRegistryRepository().getGuild("raven-guild")?.guildName, "Raven Oracle Guild");
  assert.equal(new TenantRegistryRepository().getTenant("raven-oracle")?.guildId, "raven-guild");
  assert.equal(new WorkerRegistryRepository().getWorker("raven-oracle")?.tenantId, "raven-oracle");
  assert.equal(RAVEN_REGISTRY.workers[0].provider, "cloudflare");
});

test("multi-guild fixture keeps Tenant and Worker relationships isolated", () => {
  const entries = buildVersionCenterEntries({ includeFixtures: true });
  const fixture = entries.find((entry) => entry.tenant.tenantId === "test-up-to-date");
  assert.equal(fixture?.guild.guildId, "test-global-guild");
  assert.equal(fixture?.worker?.tenantId, "test-up-to-date");
  assert.notEqual(fixture?.tenant.guildId, "raven-guild");
  assert.ok(VERSION_CENTER_FIXTURES.tenants.every((tenant) => tenant.guildId === "test-global-guild"));
});

test("Version Center reproduces all read-only statuses", () => {
  const entries = buildVersionCenterEntries({ includeFixtures: true });
  const statuses = new Set(entries.map((entry) => entry.version.status));
  for (const status of ["UP_TO_DATE", "UPDATE_AVAILABLE", "MIGRATION_REQUIRED", "INCOMPATIBLE", "ATTENTION_REQUIRED"]) assert.ok(statuses.has(status), status);
});

test("Version Center exposes plan, entitlement summary and migration state", () => {
  const raven = buildVersionCenterEntries().find((entry) => entry.tenant.tenantId === "raven-oracle");
  assert.equal(raven?.plan, "PREMIUM");
  assert.equal(raven?.migration.migrationState, "controlled");
  assert.equal(raven?.requiresHumanApproval, true);
  assert.ok((raven?.enabledFeatureCount || 0) > 0);
});

test("unknown Tenant and Worker are explicit not-found errors", () => {
  assert.throws(() => getTenantRegistryRecord("missing-tenant"), UnknownRegistryRecordError);
  assert.throws(() => getWorkerRegistryRecord("missing-worker"), UnknownRegistryRecordError);
});

test("read-only update plan cannot execute deploy or migration", () => {
  const entry = buildVersionCenterEntries({ includeFixtures: true }).find((item) => item.tenant.tenantId === "test-migration-required");
  assert.ok(entry);
  const plan = buildReadOnlyUpdatePlan(entry);
  assert.equal(plan.requiresHumanApproval, true);
  assert.equal(plan.executionAllowed, false);
  assert.ok(plan.requiredMigrations.length > 0);
});

test("registry APIs remain read-only", async () => {
  const paths = [
    "../app/api/admin/studioos/version-center/route.ts",
    "../app/api/admin/studioos/tenants/[id]/route.ts",
    "../app/api/admin/studioos/workers/[id]/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(new URL(path, import.meta.url), "utf8");
    assert.match(source, /export async function GET/);
    assert.doesNotMatch(source, /export async function (POST|PUT|PATCH|DELETE)/);
  }
});
