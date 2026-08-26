import assert from "node:assert/strict";
import test from "node:test";
import { memberReadPath } from "../worker/luna-preview.ts";

test("Luna exposes only read-only Member routes", () => {
  assert.equal(memberReadPath("/api/member/session"), "/api/member/session");
  assert.equal(memberReadPath("/api/member/readings"), "/api/member/readings");
  assert.equal(memberReadPath("/api/member/readings/id-1"), "/api/member/readings/id-1");
  assert.equal(memberReadPath("/api/member/trials/reserve"), null);
  assert.equal(memberReadPath("/api/member/events"), null);
});

test("Luna Member integration keeps its fixed tenant boundary in source", async () => {
  const source = await (await import("node:fs/promises")).readFile(new URL("../worker/luna-preview.ts", import.meta.url), "utf8");
  assert.match(source, /x-tenant-id.*LUNA_TENANT_ID/);
  assert.match(source, /x-guild-id.*LUNA_GUILD_ID/);
  assert.match(source, /x-character-id.*LUNA_CHARACTER_ID/);
  assert.match(source, /trial_disabled/);
  assert.doesNotMatch(source, /MEMBER_SERVICE_TOKEN/);
});
