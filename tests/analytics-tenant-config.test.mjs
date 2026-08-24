import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RAVEN_STUDIOOS_TENANT_CONFIG,
} from "../app/lib/studioos-tenant-config.ts";
import {
  UnknownTenantError,
  resolveAnalyticsConfig,
} from "../app/lib/tenant-config-resolver.ts";

const files = {
  summary: new URL("../app/api/analytics/summary/route.ts", import.meta.url),
  event: new URL("../app/api/analytics/event/route.ts", import.meta.url),
  connector: new URL("../app/lib/external-analytics.ts", import.meta.url),
  admin: new URL("../app/admin/analytics/page.tsx", import.meta.url),
  growth: new URL("../app/api/growth-engine/external-sync/route.ts", import.meta.url),
};

async function source(file) {
  return readFile(file, "utf8");
}

test("Raven Analytics slice preserves legacy identity and provider references", () => {
  const config = resolveAnalyticsConfig("raven-oracle");
  assert.equal(config.tenantId, "raven-oracle");
  assert.equal(config.enabled, RAVEN_STUDIOOS_TENANT_CONFIG.analytics.enabled);
  assert.equal(config.provider, "external-connectors");
  assert.deepEqual(config.sources, ["ga4", "search_console", "cloudflare"]);
  assert.equal(config.eventNamespace, "raven-oracle");
  assert.equal(config.publicUrl, "https://raven.fortunestudios.jp/");
  assert.deepEqual(RAVEN_STUDIOOS_TENANT_CONFIG.analytics, config);
});

test("unknown Analytics tenants never fall back to Raven", () => {
  assert.throws(() => resolveAnalyticsConfig("unknown-tenant"), UnknownTenantError);
});

test("Analytics API routes resolve tenant configuration instead of hardcoding Raven", async () => {
  const [summary, event] = await Promise.all([source(files.summary), source(files.event)]);
  for (const route of [summary, event]) {
    assert.match(route, /resolveAnalyticsConfig/);
    assert.doesNotMatch(route, /const\s+TENANT_ID\s*=\s*["']raven-oracle["']/);
  }
  assert.match(summary, /searchParams\.get\("tenantId"\)/);
  assert.match(event, /body\.tenantId/);
});

test("external Analytics connectors use the resolved public URL and tenant id", async () => {
  const connector = await source(files.connector);
  assert.match(connector, /resolveAnalyticsConfig/);
  assert.match(connector, /entityId:\s*config\.tenantId/);
  assert.match(connector, /envValue\(env, "SEARCH_CONSOLE_SITE_URL"\) \|\| config\.publicUrl/);
  assert.doesNotMatch(connector, /const\s+TENANT_ID\s*=\s*["']raven-oracle["']/);
});

test("Analytics admin derives its sync tenant from the resolver", async () => {
  const admin = await source(files.admin);
  assert.match(admin, /resolveAnalyticsConfig/);
  assert.match(admin, /tenantId:\s*ANALYTICS_TENANT_ID/);
  assert.doesNotMatch(admin, /tenantId:\s*["']raven-oracle["']/);
});

test("Growth connector boundary remains unchanged by Analytics slice migration", async () => {
  const growth = await source(files.growth);
  assert.match(growth, /fetchExternalAnalyticsMetrics/);
});

test("event namespace remains stable for existing Campaign and site events", () => {
  assert.equal(resolveAnalyticsConfig("raven-oracle").eventNamespace, "raven-oracle");
});
