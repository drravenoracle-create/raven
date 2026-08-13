import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const EXPECTED = {
  worker: "raven-oracle",
  accountId: "cfda786a82241adf6b21f772dbc87544",
  accountName: "Fortune.kanri@gmail.com's Account",
  d1Name: "raven-oracle",
  d1Id: "a8a69ddd-2d8b-4e76-81f1-29abbb619a38",
  route: "raven.fortunestudios.jp/*",
  origin: "https://raven.fortunestudios.jp",
};

const REQUIRED_SECRETS = [
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ZONE_ID",
];

const OPTIONAL_SECRETS = [
  "INSTAGRAM_ACCESS_TOKEN",
  "INSTAGRAM_ACCOUNT_ID",
];

const REQUIRED_TABLES = [
  "analytics_events",
  "growth_metric_points",
  "growth_data_connectors",
  "growth_events",
  "sns_posts",
  "sns_publish_logs",
  "sns_automation_settings",
  "media_video_assets",
  "reel_engine_audit_logs",
];

const HEALTH_ENDPOINTS = [
  "/",
  "/api/sns/ping",
  "/api/sns/posts?tenantId=raven-oracle",
  "/api/analytics/summary?days=30",
  "/api/growth-engine/external-sync",
];

const errors = [];
const warnings = [];
const notes = [];

function run(command, args, options = {}) {
  const isWindowsCmd = process.platform === "win32" && command.endsWith(".cmd");
  const actualCommand = isWindowsCmd ? "cmd.exe" : command;
  const actualArgs = isWindowsCmd ? ["/d", "/c", command, ...args] : args;
  const result = spawnSync(actualCommand, actualArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    ...options,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function wrangler(args) {
  const bin = existsSync(".\\node_modules\\.bin\\wrangler.cmd") ? ".\\node_modules\\.bin\\wrangler.cmd" : "wrangler";
  return run(bin, args);
}

function readConfig() {
  const path = existsSync("dist/server/wrangler.json") ? "dist/server/wrangler.json" : "wrangler.toml";
  const text = readFileSync(path, "utf8");
  return { path, text };
}

function parseJsonConfig(text) {
  try {
    return JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    return null;
  }
}

function extractTomlValue(text, key) {
  const match = text.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "m"));
  return match?.[1] || "";
}

function configValue(config, key) {
  const json = parseJsonConfig(config.text);
  if (json) return json[key] || "";
  return extractTomlValue(config.text, key);
}

function configD1Id(config) {
  const json = parseJsonConfig(config.text);
  if (json) return json.d1_databases?.find((item) => item.binding === "DB")?.database_id || "";
  const dbBlock = config.text.match(/\[\[d1_databases\]\]([\s\S]*?)(?:\n\[\[|\n\[|$)/)?.[1] || "";
  return extractTomlValue(dbBlock, "database_id");
}

function configHasR2(config) {
  const json = parseJsonConfig(config.text);
  if (json) return Array.isArray(json.r2_buckets) && json.r2_buckets.some((item) => item.binding === "MEDIA_BUCKET");
  return config.text.includes("[[r2_buckets]]") && config.text.includes('binding = "MEDIA_BUCKET"');
}

function assertIncludes(label, text, expected) {
  if (!text.includes(expected)) errors.push(`${label}: expected "${expected}"`);
}

async function checkHttp(path) {
  const url = `${EXPECTED.origin}${path}`;
  const response = await fetch(url, { redirect: "manual" });
  const ok = response.status >= 200 && response.status < 400;
  if (!ok) {
    errors.push(`HTTP ${path}: ${response.status}`);
    return;
  }
  const version = response.headers.get("x-raven-worker-version");
  if (!version) errors.push(`HTTP ${path}: missing X-Raven-Worker-Version`);
  notes.push(`HTTP ${path}: ${response.status}`);
}

async function main() {
  const config = readConfig();
  notes.push(`Config: ${config.path}`);

  const configAccountId = configValue(config, "account_id");
  const configName = configValue(config, "name");
  const configD1 = configD1Id(config);
  const hasR2 = configHasR2(config);

  if (configName !== EXPECTED.worker) errors.push(`config name mismatch: ${configName || "(missing)"}`);
  if (configAccountId !== EXPECTED.accountId) errors.push(`config account_id mismatch: ${configAccountId || "(missing)"}`);
  if (configD1 !== EXPECTED.d1Id) errors.push(`config D1 database_id mismatch: ${configD1 || "(missing)"}`);
  if (!config.text.includes(EXPECTED.route)) errors.push(`config route missing: ${EXPECTED.route}`);
  if (!hasR2) warnings.push("R2 MEDIA_BUCKET binding is not configured in current production account. MP4 upload remains unavailable until R2 is enabled.");

  const whoami = wrangler(["whoami"]);
  if (whoami.status !== 0) {
    errors.push(`wrangler whoami failed: ${whoami.stderr || whoami.stdout}`);
  } else {
    assertIncludes("wrangler whoami account id", whoami.stdout, EXPECTED.accountId);
    assertIncludes("wrangler whoami account name", whoami.stdout, EXPECTED.accountName);
  }

  const secrets = wrangler(["secret", "list", "--config", config.path]);
  if (secrets.status !== 0) {
    errors.push(`wrangler secret list failed: ${secrets.stderr || secrets.stdout}`);
  } else {
    let names = [];
    try {
      names = JSON.parse(secrets.stdout).map((item) => item.name);
    } catch {
      errors.push("wrangler secret list did not return JSON");
    }
    for (const name of REQUIRED_SECRETS) {
      if (!names.includes(name)) errors.push(`missing required secret: ${name}`);
    }
    for (const name of OPTIONAL_SECRETS) {
      if (!names.includes(name)) warnings.push(`missing optional secret: ${name}`);
    }
  }

  const tableSql = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name";
  const d1 = wrangler(["d1", "execute", EXPECTED.d1Name, "--remote", "--config", config.path, "--command", tableSql]);
  if (d1.status !== 0) {
    errors.push(`wrangler d1 execute failed: ${d1.stderr || d1.stdout}`);
  } else {
    for (const table of REQUIRED_TABLES) {
      if (!d1.stdout.includes(`"name": "${table}"`)) errors.push(`missing D1 table: ${table}`);
    }
  }

  for (const endpoint of HEALTH_ENDPOINTS) {
    await checkHttp(endpoint);
  }

  const summaryResponse = await fetch(`${EXPECTED.origin}/api/analytics/summary?days=30`);
  if (summaryResponse.ok) {
    const summary = await summaryResponse.json();
    const connectors = summary.externalConnectors || [];
    const ga4 = connectors.find((item) => item.source === "ga4");
    const cloudflare = connectors.find((item) => item.source === "cloudflare");
    const searchConsole = connectors.find((item) => item.source === "search_console");
    if (ga4?.sync_status !== "available") errors.push(`GA4 connector not available: ${ga4?.sync_status || "missing"}`);
    if (cloudflare?.sync_status !== "available") errors.push(`Cloudflare connector not available: ${cloudflare?.sync_status || "missing"}`);
    if (searchConsole?.sync_status !== "available") warnings.push(`Search Console connector not available: ${searchConsole?.last_error || searchConsole?.sync_status || "missing"}`);
  }

  console.log("Production Preflight");
  for (const note of notes) console.log(`OK: ${note}`);
  for (const warning of warnings) console.log(`WARN: ${warning}`);
  for (const error of errors) console.error(`FAIL: ${error}`);

  if (errors.length) {
    console.error(`Preflight failed with ${errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`Preflight passed with ${warnings.length} warning(s).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
