import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("builds the current Raven server entry", async () => {
  const serverEntry = new URL("dist/server/index.js", root);
  await access(serverEntry);

  const source = await readFile(serverEntry, "utf8");
  assert.match(source, /export \{[^}]*default[^}]*\}/s);
  assert.match(source, /worker_entry_default/);
  assert.doesNotMatch(source, /Your site is taking shape|react-loading-skeleton/);
});

test("keeps the current Raven home shell and metadata in the app tree", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
  ]);

  assert.match(page, /レイヴン・ブラックウッド/);
  assert.match(page, /AI無料占い/);
  assert.match(page, /AIテキスト占い/);
  assert.match(page, /href=\"\/guild\/\"/);
  assert.match(layout, /title = \"レイヴン・ブラックウッド\"/);
  assert.match(layout, /<html lang=\"ja\">/);
});
