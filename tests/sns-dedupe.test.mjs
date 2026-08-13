import assert from "node:assert/strict";
import test from "node:test";
import { findSnsDuplicate, fingerprintSnsContent, similarityScore, tokenizeSnsContent } from "../app/lib/sns-dedupe.ts";

test("SNS duplicate detector catches identical fingerprints", async () => {
  const fingerprint = await fingerprintSnsContent({ title: "返信前の文章を整える3つの視点", caption: "気持ちと目的を分けます。" });
  const duplicate = findSnsDuplicate(
    { title: "返信前の文章を整える3つの視点", caption: "気持ちと目的を分けます。", fingerprint },
    [{ id: "post-1", title: "返信前の文章を整える3つの視点", caption: "気持ちと目的を分けます。", duplicate_warning: `fingerprint:${fingerprint}` }],
  );
  assert.equal(duplicate?.candidate.id, "post-1");
  assert.equal(duplicate?.reason, "fingerprint");
});

test("SNS duplicate detector catches near duplicates", () => {
  const duplicate = findSnsDuplicate(
    { title: "返信前の文章を整える3つの視点", caption: "送る前に気持ちと目的を分けて見直します。" },
    [{ id: "post-2", title: "返信前に文章を整える視点", caption: "送信前に気持ち、目的、伝えたいことを分けます。" }],
    0.45,
  );
  assert.equal(duplicate?.candidate.id, "post-2");
  assert.equal(duplicate?.reason, "similarity");
});

test("SNS similarity stays low for clearly different content", () => {
  const love = tokenizeSnsContent("恋愛相談で相手との距離を見直す");
  const work = tokenizeSnsContent("仕事運とお金の判断タイミングを整える");
  assert.ok(similarityScore(love, work) < 0.35);
});
