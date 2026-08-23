import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { spawn } from "node:child_process";

const port = Number(process.env.PORT || 8080);
const token = String(process.env.RENDERER_TOKEN || "").trim();
const root = "/tmp/raven-renderer";
await mkdir(root, { recursive: true });
const json = (res, body, status = 200) => { res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };
const safe = (v, n = 500) => String(v ?? "").replace(/[\r\n]/g, " ").trim().slice(0, n);
const ass = (v) => safe(v).replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", "\\N");
const assWrapped = (value, maxChars = 18) => {
  const raw = String(value ?? "").replace(/\r/g, "").trim();
  const lines = [];
  for (const paragraph of raw.split(/\n+/)) {
    let line = "";
    for (const character of paragraph) {
      if (line.length >= maxChars) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
    if (line) lines.push(line);
  }
  return lines.map((line) => ass(line)).join("\\N");
};
async function readBody(req) { const chunks = []; for await (const c of req) chunks.push(c); return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
async function download(url, path) { const parsed = new URL(url); if (parsed.protocol !== "https:") throw new Error("source URL must use https"); const response = await fetch(parsed); if (!response.ok) throw new Error(`source download ${response.status}`); await writeFile(path, Buffer.from(await response.arrayBuffer())); }
async function render(input, output, p) {
  const title = ass(p.theme || p.title || "今日の3択占い");
  const hook = ass(p.hook || "直感で1枚選んでください");
  const cta = ass(p.cta || "詳しい鑑定はプロフィールから");
  const cards = Array.isArray(p.cards) ? p.cards.slice(0, 3) : [];
  const labels = ["A", "B", "C"];
  const defaultCardBack = "https://raven.fortunestudios.jp/api/reel-engine/assets?assetId=3eb80df4-8114-4f4c-9c79-c3d9ea9495e0";
  const cardBackSource = safe(p.cardBack || p.card_back || defaultCardBack, 1000);
  const cardBackPath = `${output}.card-back.png`;
  let cardBackAvailable = false;
  try {
    await download(cardBackSource, cardBackPath);
    cardBackAvailable = true;
  } catch {}
  const cardImagePaths = [];
  for (let index = 0; index < cards.length; index += 1) {
    const cardPath = `${output}.card-${index}.png`;
    try {
      await download(safe(cards[index].image, 1000), cardPath);
      cardImagePaths.push(cardPath);
    } catch {
      cardImagePaths.push(cardBackAvailable ? cardBackPath : null);
    }
  }
  const labelEvents = labels.map((label, index) => `Dialogue: 1,0:00:02.00,0:00:05.00,Label${label},,0,0,0,,{\\an5\\pos(${270 + index * 270},1135)}${label}`).join("\n");
  const resultEvents = cards.map((card, index) => {
    const start = 5 + index * 4;
    const end = start + 4;
    const label = labels[index];
    const name = assWrapped(card.name || "結果", 14);
    const reading = assWrapped(card.reading || "焦らず、今できる一手を選びます。", 14);
    return [
      `Dialogue: 0,0:00:${String(start).padStart(2, "0")}.00,0:00:${String(end).padStart(2, "0")}.00,ResultName,,0,0,0,,{\\an5\\pos(540,1080)}${label}：${name}`,
      `Dialogue: 0,0:00:${String(start).padStart(2, "0")}.00,0:00:${String(end).padStart(2, "0")}.00,ResultBody,,0,0,0,,{\\an5\\pos(540,1300)}${reading}`,
    ].join("\n");
  }).join("\n");
  const assPath = `${output}.ass`;
  await writeFile(assPath, `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Main,Noto Sans CJK JP,96,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,40,40,0,1
Style: ChoicePrompt,Noto Sans CJK JP,66,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,5,0,5,40,40,0,1
Style: LabelA,Noto Sans CJK JP,112,&H0000D7FF,&H0000D7FF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,40,40,0,1
Style: LabelB,Noto Sans CJK JP,112,&H00FFD26A,&H00FFD26A,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,40,40,0,1
Style: LabelC,Noto Sans CJK JP,112,&H00FF9CFF,&H00FF9CFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,40,40,0,1
Style: ResultName,Noto Sans CJK JP,92,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,40,40,0,1
Style: ResultBody,Noto Sans CJK JP,88,&H00FFFFFF,&H00FFFFFF,&HAA000000,&H99000000,-1,0,0,0,100,100,0,0,3,6,0,5,44,44,0,1
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Main,,0,0,0,,${title}\\N${hook}
Dialogue: 0,0:00:02.00,0:00:05.00,ChoicePrompt,,0,0,0,,{\\an5\\pos(540,580)}A・B・Cから直感で1枚選んでください
${labelEvents}
${resultEvents}
Dialogue: 1,0:00:17.00,0:00:20.00,Main,,0,0,0,,${cta}
`, "utf8");
  const subtitlePath = assPath.replaceAll("\\", "/").replace(/^([A-Za-z]):/, "$1\\:");
  const imagePaths = [cardBackAvailable ? cardBackPath : null, ...cardImagePaths].filter(Boolean);
  const inputIndex = new Map(imagePaths.map((path, index) => [path, index + 1]));
  const backIndex = cardBackAvailable ? inputIndex.get(cardBackPath) : null;
  const frontIndexes = cardImagePaths.map((path) => path ? inputIndex.get(path) : null);
  const filterParts = ["[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[base]"];
  let current = "base";
  const addOverlay = (inputLabel, x, y, enable, next) => {
    filterParts.push(`[${inputLabel}:v]scale=240:360:force_original_aspect_ratio=decrease,pad=240:360:(ow-iw)/2:(oh-ih)/2:color=black@0.2[card${next}]`);
    filterParts.push(`[${current}][card${next}]overlay=${x}:${y}:enable='${enable}'[scene${next}]`);
    current = `scene${next}`;
  };
  let overlayNumber = 0;
  if (backIndex) {
    [160, 420, 680].forEach((x) => { overlayNumber += 1; addOverlay(String(backIndex), x, 720, "between(t,2,5)", overlayNumber); });
  }
  frontIndexes.forEach((frontIndex, index) => {
    if (!frontIndex) return;
    overlayNumber += 1;
    addOverlay(String(frontIndex), 420, 500, `between(t,${5 + index * 4},${9 + index * 4})`, overlayNumber);
  });
  filterParts.push(`[${current}]subtitles='${subtitlePath}'[vout]`);
  const filter = filterParts.join(";");
  await new Promise((resolve, reject) => {
    const threads = String(process.env.FFMPEG_THREADS || "1");
    const preset = String(process.env.FFMPEG_PRESET || "ultrafast");
    const imageInputs = imagePaths.flatMap((path) => ["-loop", "1", "-i", path]);
    const child = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-threads", threads, "-filter_threads", threads, "-filter_complex_threads", threads, "-stream_loop", "-1", "-i", input, ...imageInputs, "-t", "20", "-filter_complex", filter, "-map", "[vout]", "-map", "0:a?", "-c:v", "libx264", "-preset", preset, "-pix_fmt", "yuv420p", "-b:v", "2500k", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", output]);
    let error = "";
    child.stderr.on("data", (c) => { error += c; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error || `ffmpeg exit ${code}`)));
  });
}
const server = http.createServer(async (req, res) => { try { if (token && req.headers.authorization !== `Bearer ${token}`) return json(res, { error: "Unauthorized" }, 401); if (req.method === "GET" && req.url === "/health") return json(res, { ok: true, renderer: "raven-ffmpeg" }); if (req.method === "GET" && req.url?.startsWith("/outputs/")) { const id = req.url.split("/").pop(); const data = await readFile(join(root, `${id}.mp4`)); res.writeHead(200, { "content-type": "video/mp4", "cache-control": "public, max-age=300" }); return res.end(data); } if (req.method !== "POST" || req.url !== "/jobs") return json(res, { error: "Not found" }, 404); const input = await readBody(req); const jobId = safe(input.jobId || randomUUID(), 120); const p = input.payload || {}; const sourceUrl = safe(p.background || p.sourceUrl, 1000); if (!sourceUrl) return json(res, { error: "payload.background or payload.sourceUrl is required" }, 422); const requestHost = req.headers.host ? `${req.headers["x-forwarded-proto"] || "https"}://${req.headers.host}` : undefined; const publicBaseUrl = process.env.PUBLIC_BASE_URL || requestHost || `http://localhost:${port}`; const inputPath = join(root, `${jobId}-input.mp4`); const outputPath = join(root, `${jobId}.mp4`); await download(sourceUrl, inputPath); await render(inputPath, outputPath, p); return json(res, { rendererJobId: jobId, status: "completed", outputUrl: `${publicBaseUrl}/outputs/${jobId}` }); } catch (error) { return json(res, { error: error instanceof Error ? error.message : "render_failed" }, 500); } });
server.listen(port, "0.0.0.0");
