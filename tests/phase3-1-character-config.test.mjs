import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("Phase 3.1 keeps Raven SNS and three-choice values equivalent", async () => {
  const config = await source("app/lib/character-config.ts");
  const threeChoice = await source("app/lib/three-choice-video.ts");
  const videoRoute = await source("app/api/sns/videos/[id]/route.ts");
  const renderRoute = await source("app/api/sns/videos/three-choice/render/route.ts");
  const postsRoute = await source("app/api/admin/sns/posts/route.ts");

  assert.match(config, /displayName: "レイヴン・ブラックウッド"/);
  assert.match(config, /threeChoiceCta: "詳しい鑑定はプロフィールへ"/);
  assert.match(config, /threeChoiceHashtags: \["#レイヴンブラックウッド", "#3択占い", "#オラクルカード", "#今日のメッセージ"\]/);
  assert.match(config, /threeChoicePostHashtags: \["#レイヴンブラックウッド", "#3択占い", "#占い", "#オラクルカード"\]/);
  assert.match(config, /hashtags: \["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"\]/);

  assert.match(threeChoice, /RAVEN_CHARACTER_CONFIG\.threeChoiceCta/);
  assert.match(threeChoice, /RAVEN_CHARACTER_CONFIG\.threeChoiceHashtags\.join\(" "\)/);
  for (const route of [videoRoute, renderRoute]) {
    assert.match(route, /RAVEN_CHARACTER_CONFIG\.displayName/);
    assert.match(route, /RAVEN_CHARACTER_CONFIG\.threeChoicePostHashtags\.join\(" "\)/);
  }
  assert.match(postsRoute, /RAVEN_CHARACTER_CONFIG\.displayName/);
  assert.match(postsRoute, /RAVEN_CHARACTER_CONFIG\.defaultCta/);
  assert.match(postsRoute, /RAVEN_CHARACTER_CONFIG\.sns\.hashtags\.join\(" "\)/);

  assert.doesNotMatch(threeChoice, /\|\| "詳しい鑑定はプロフィールへ"/);
  assert.doesNotMatch(videoRoute, /'レイヴン・ブラックウッド'/);
  assert.doesNotMatch(renderRoute, /'レイヴン・ブラックウッド'/);
  assert.doesNotMatch(postsRoute, /\|\| "レイヴン・ブラックウッド"/);
});
