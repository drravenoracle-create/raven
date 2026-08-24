import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ravenConfig = await readFile(new URL("../wrangler.toml", import.meta.url), "utf8");
const proxyConfig = await readFile(new URL("../wrangler.official-raven-proxy.toml", import.meta.url), "utf8");

test("Raven origin deploy does not manage the official zone route", () => {
  assert.doesNotMatch(ravenConfig, /^routes\s*=|zone_name\s*=\s*"fortunestudios\.jp"/m);
  assert.match(ravenConfig, /^workers_dev\s*=\s*true$/m);
  assert.match(ravenConfig, /^account_id\s*=\s*"c7ce2613bf30affed8d2caae0068beb5"$/m);
});

test("official proxy remains the sole owner of the public Raven route", () => {
  assert.match(proxyConfig, /^account_id\s*=\s*"cfda786a82241adf6b21f772dbc87544"$/m);
  assert.match(proxyConfig, /pattern\s*=\s*"raven\.fortunestudios\.jp\/\*"/m);
  assert.match(proxyConfig, /zone_name\s*=\s*"fortunestudios\.jp"/m);
});
