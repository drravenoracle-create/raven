import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const fixturePersistRoot = resolve(projectRoot, process.env.RAVEN_LOCAL_D1_PERSIST || ".wrangler/opening-campaign-phase1");

export function findFixtureDatabase() {
  const files = readdirSync(fixturePersistRoot, { recursive: true, withFileTypes: true });
  const database = files.find((entry) => entry.isFile() && entry.name.endsWith(".sqlite") && entry.name !== "metadata.sqlite");
  if (!database) throw new Error(`Local D1 fixture not found. Run: npm run fixture:opening-campaign`);
  return resolve(database.parentPath, database.name);
}
