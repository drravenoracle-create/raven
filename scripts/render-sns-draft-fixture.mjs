import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const args = process.argv.slice(2); const value = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] || fallback : fallback; };
const input = resolve(value("input", "public/sns-test/three-choice-sample.mp4")); const output = resolve(value("output", "./.tmp/sns-draft-fixture.mp4"));
const result = spawnSync("node", ["scripts/render-reel.mjs", "--input", input, "--output", output, "--title", value("title", "今のあなたへの一枚"), "--subtitle", value("subtitle", "気持ちを整えて、一手を選ぶ"), "--cta", value("cta", "続きはプロフィールへ")], { stdio: "inherit" });
process.exit(result.status || 0);
