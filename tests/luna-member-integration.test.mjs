import assert from "node:assert/strict";
import test from "node:test";
import { forwardMemberRead, memberReadPath } from "../worker/luna-preview.ts";

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

test("Luna forwards reads through the Member Core service binding", async () => {
  let forwarded;
  const response = await forwardMemberRead(
    new Request("https://luna-oracle.example/api/member/readings?limit=1", {
      headers: {
        "x-tenant-id": "raven-oracle",
        "x-guild-id": "wrong-guild",
        "x-character-id": "wrong-character",
        cookie: "guild_member_session=test",
      },
    }),
    { MEMBER_CORE: { fetch(request) { forwarded = request; return Promise.resolve(Response.json({ readings: [] })); } } },
  );
  assert.equal(response.status, 200);
  assert.equal(forwarded.headers.get("x-tenant-id"), "luna-oracle");
  assert.equal(forwarded.headers.get("x-guild-id"), "raven-guild");
  assert.equal(forwarded.headers.get("x-character-id"), "luna");
  assert.equal(forwarded.headers.get("cookie"), "guild_member_session=test");
  assert.equal(new URL(forwarded.url).pathname, "/api/member/readings");
});
