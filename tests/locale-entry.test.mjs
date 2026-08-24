import assert from "node:assert/strict";
import test from "node:test";
import { englishEntryRedirect } from "../app/lib/locale-entry.ts";

function request(path = "/", { method = "GET", headers = {} } = {}) {
  return new Request(`https://raven.fortunestudios.jp${path}`, { method, headers });
}

function downstreamStatus(response) {
  return response?.status ?? 200;
}

test("cookie-less Japanese root is served without redirect", () => {
  assert.equal(downstreamStatus(englishEntryRedirect(request("/", { headers: { "accept-language": "ja-JP,ja;q=0.9" } }))), 200);
});

test("saved Japanese locale serves root without redirect", () => {
  assert.equal(downstreamStatus(englishEntryRedirect(request("/", { headers: { cookie: "raven_locale=ja" } }))), 200);
});

test("English Accept-Language redirects to the English entry", () => {
  const response = englishEntryRedirect(request("/", { headers: { "accept-language": "en-US,en;q=0.9" } }));
  assert.equal(response?.status, 302);
  assert.equal(response?.headers.get("location"), "/en/");
});

test("saved English locale redirects to the English entry", () => {
  const response = englishEntryRedirect(request("/", { headers: { cookie: "raven_locale=en" } }));
  assert.equal(response?.headers.get("location"), "/en/");
});

test("explicit English locale redirects to the English entry", () => {
  const response = englishEntryRedirect(request("/?lang=en"));
  assert.equal(response?.headers.get("location"), "/en/");
});

test("explicit Japanese locale redirects once to root and then serves it", () => {
  const first = englishEntryRedirect(request("/?lang=ja"));
  assert.equal(first?.headers.get("location"), "https://raven.fortunestudios.jp/");
  const second = englishEntryRedirect(request("/", { headers: { cookie: first?.headers.get("set-cookie") || "" } }));
  assert.equal(downstreamStatus(second), 200);
});

test("Googlebot without cookies is served without redirect", () => {
  assert.equal(downstreamStatus(englishEntryRedirect(request("/", { headers: { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" } }))), 200);
});

test("SNS crawler without cookies is served without redirect", () => {
  assert.equal(downstreamStatus(englishEntryRedirect(request("/", { headers: { "user-agent": "facebookexternalhit/1.1" } }))), 200);
});

test("HEAD root bypasses locale redirect", () => {
  assert.equal(downstreamStatus(englishEntryRedirect(request("/", { method: "HEAD" }))), 200);
});
