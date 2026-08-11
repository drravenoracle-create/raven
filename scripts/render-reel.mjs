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
const title = escapeAss(arg("title", "\u7b54\u3048\u3092\u6025\u304c\u306a\u3044\u591c"));
const subtitle = escapeAss(arg("subtitle", "\u6c17\u6301\u3061\u3092\u6574\u3048\u3001\u4e00\u624b\u3092\u9078\u3076"));
const brand = escapeAss(arg("brand", "Raven Blackwood"));
const cta = escapeAss(arg("cta", "\u8a73\u3057\u3044\u9451\u5b9a\u306f\u30d7\u30ed\u30d5\u30a3\u30fc\u30eb\u304b\u3089"));

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
Style: Title,Noto Sans CJK JP,116,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,5,0,5,44,44,0,1
Style: Sub,Noto Sans CJK JP,66,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H88000000,0,0,0,0,100,100,0,0,3,4,0,5,56,56,0,1
Style: Cta,Noto Sans CJK JP,70,&H00FFFFFF,&H00FFFFFF,&H88000000,&HAA000000,-1,0,0,0,100,100,0,0,3,4,0,2,56,56,330,1
Style: Brand,Noto Sans CJK JP,42,&H00FFFFFF,&H00FFFFFF,&H66000000,&H00000000,-1,0,0,0,100,100,0,0,1,2,0,2,80,80,180,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:01:00.00,Title,,0,0,0,,${title}
Dialogue: 0,0:00:00.70,0:01:00.00,Sub,,0,0,0,,${subtitle}
Dialogue: 1,0:00:07.50,0:01:00.00,Cta,,0,0,0,,${cta}
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
