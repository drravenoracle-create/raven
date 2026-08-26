import { readFileSync, writeFileSync } from "node:fs";
const [tenantId, characterId, displayName, outputPath] = process.argv.slice(2);
if (!tenantId || !characterId || !displayName || !outputPath) throw new Error("usage: node scripts/generate-clean-tenant-schema.mjs <tenant> <character> <display name> <output>");
const template = readFileSync(new URL("../studioos/schema/clean-scarlet.sql", import.meta.url), "utf8");
const sql = template.replaceAll("scarlet-donovan", tenantId).replaceAll("scarlet", characterId).replaceAll("Scarlet Donovan", displayName).replaceAll("scarlet-guardian", `${characterId}-legacy`);
writeFileSync(outputPath, sql, "utf8");
console.log(JSON.stringify({ tenantId, characterId, outputPath }));
