import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const persistRoot = resolve(projectRoot, process.env.RAVEN_LOCAL_D1_PERSIST || ".wrangler/opening-campaign-phase1");
const wranglerBin = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const migrationFiles = readdirSync(resolve(projectRoot, "drizzle"))
  .filter((name) => /^\d{4}.*\.sql$/.test(name))
  .sort();

if (migrationFiles.at(-1) !== "0027_opening_campaign_phase1.sql") {
  throw new Error("Expected 0027_opening_campaign_phase1.sql to be the final migration.");
}

rmSync(persistRoot, { recursive: true, force: true });
mkdirSync(persistRoot, { recursive: true });

function executeFile(file) {
  const result = spawnSync(process.execPath, [
    wranglerBin, "d1", "execute", "raven-oracle", "--local",
    "--persist-to", persistRoot, "--config", "wrangler.toml",
    "--file", file, "--yes",
  ], { cwd: projectRoot, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`Local D1 setup failed for ${file}: ${(result.stderr || result.stdout || "unknown error").trim()}`);
  }
}

for (const migration of migrationFiles) executeFile(resolve(projectRoot, "drizzle", migration));
executeFile(resolve(projectRoot, "tests/fixtures/opening-campaign-phase1.sql"));

console.log(`Opening Campaign fixture ready: ${persistRoot}`);
console.log(`Applied migrations: ${migrationFiles[0]} ... ${migrationFiles.at(-1)}`);
