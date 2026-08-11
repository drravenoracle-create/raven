import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function escapeAss(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/\r?\n/g, "\\N");
}

const input = resolve(arg("input"));
const output = resolve(arg("output"));
const title = escapeAss(arg("title", "答えを急がない夜"));
const subtitle = escapeAss(arg("subtitle", "気持ちを整え、一手を選ぶ"));
const brand = escapeAss(arg("brand", "Raven Blackwood"));

const workDir = mkdtempSync(join(tmpdir(), "raven-reel-"));
const assPath = join(workDir, "caption.ass");

writeFileSync(assPath, `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Noto Sans CJK JP,82,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,4,0,5,80,80,0,1
Style: Sub,Noto Sans CJK JP,48,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H88000000,0,0,0,0,100,100,0,0,3,3,0,5,80,80,0,1
Style: Brand,Noto Sans CJK JP,42,&H00FFFFFF,&H00FFFFFF,&H66000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,80,80,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:01:00.00,Title,,0,0,0,,${title}
Dialogue: 0,0:00:00.70,0:01:00.00,Sub,,0,0,0,,${subtitle}
Dialogue: 0,0:00:00.00,0:01:00.00,Brand,,0,0,0,,${brand}
`, "utf8");

const assFilterPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");
const filters = [
  "scale=1080:1920:force_original_aspect_ratio=increase",
  "crop=1080:1920",
  "drawbox=x=0:y=0:w=1080:h=1920:color=black@0.18:t=fill",
  `subtitles='${assFilterPath}'`,
].join(",");

const result = spawnSync("ffmpeg", [
  "-y",
  "-hide_banner",
  "-i", input,
  "-vf", filters,
  "-c:v", "libx264",
  "-pix_fmt", "yuv420p",
  "-profile:v", "high",
  "-level", "4.1",
  "-r", "30",
  "-b:v", "3500k",
  "-c:a", "aac",
  "-b:a", "128k",
  "-movflags", "+faststart",
  output,
], { stdio: "inherit" });

if (result.status !== 0) process.exit(result.status || 1);
