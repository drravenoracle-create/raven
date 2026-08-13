export const REEL_ENGINE_TENANT_ID = "raven-oracle";
export const REEL_ENGINE_VERSION = "reel-engine-v1.0";

export type ReelDuration = 15 | 30 | 60;
export type ReelStatus = "draft" | "planned" | "rendering" | "rendered" | "approved" | "scheduled" | "published" | "failed";

export type ReelScript = {
  hook: string;
  scenes: Array<{ index: number; overlayText: string; narration: string }>;
  cta: string;
  backgroundCategories: string[];
  tempo: "slow" | "medium" | "fast";
  bgmMood: string;
};

export type ReelScene = {
  startTime: number;
  endTime: number;
  assetId?: string;
  crop: "center" | "top" | "bottom";
  fit: "cover" | "contain";
  motion: "none" | "slow_zoom" | "pan_up";
  transition: "cut" | "fade";
  textLayerIds: string[];
};

export type ReelTextLayer = {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: "top" | "middle" | "bottom";
  alignment: "left" | "center" | "right";
  fontPreset: string;
  sizePreset: "small" | "medium" | "large";
  emphasis: boolean;
  safeArea: boolean;
};

export type VideoAsset = {
  assetId: string;
  tenantId: string;
  source: "uploaded" | "generated" | "shared" | "stock";
  storageKey: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  duration: number;
  width: number;
  height: number;
  tags: string[];
  category: string;
  mood: string;
  usageCount: number;
  performanceScore: number;
};

export interface ReelStorageProvider {
  putObject(input: { key: string; body: ReadableStream | ArrayBuffer | Blob; contentType: string; metadata?: Record<string, string> }): Promise<{ key: string; size?: number }>;
  getObject(key: string): Promise<{ body: ReadableStream; contentType: string; size?: number } | null>;
  deleteObject(key: string): Promise<{ deleted: boolean }>;
}

export type ReelProject = {
  tenantId: string;
  reelId: string;
  title: string;
  objective: string;
  platform: string;
  aspectRatio: string;
  duration: ReelDuration;
  status: ReelStatus;
  script: ReelScript;
  scenes: ReelScene[];
  backgroundAssetIds: string[];
  textLayers: ReelTextLayer[];
  brandPresetId: string;
  audioAssetId?: string;
  rendererProvider: string;
  outputAssetId?: string;
  campaignId?: string;
  sourceContentId?: string;
};

export type ReelEntitlement = {
  reel_engine: boolean;
  reel_basic: boolean;
  reel_advanced: boolean;
  ai_video_generation: boolean;
  monthly_render_limit: number;
};

export interface VideoRendererProvider {
  createRenderJob(project: ReelProject): Promise<{ jobId: string; status: "queued" | "unavailable"; message?: string }>;
  getRenderStatus(jobId: string): Promise<{ jobId: string; status: string; outputAssetId?: string; error?: string }>;
  cancelRenderJob(jobId: string): Promise<{ jobId: string; cancelled: boolean }>;
  getOutput(jobId: string): Promise<{ outputAssetId?: string; url?: string }>;
}

export function defaultEntitlement(plan = "STANDARD", overrides: Partial<ReelEntitlement> = {}): ReelEntitlement {
  const normalized = plan.toUpperCase();
  const base = normalized === "LIGHT"
    ? { reel_engine: false, reel_basic: false, reel_advanced: false, ai_video_generation: false, monthly_render_limit: 0 }
    : normalized === "PREMIUM"
      ? { reel_engine: true, reel_basic: true, reel_advanced: true, ai_video_generation: true, monthly_render_limit: 120 }
      : { reel_engine: true, reel_basic: true, reel_advanced: false, ai_video_generation: false, monthly_render_limit: 30 };
  return { ...base, ...overrides };
}

export function assertReelEntitlement(entitlement: ReelEntitlement) {
  if (!entitlement.reel_engine || !entitlement.reel_basic) return { allowed: false, reason: "reel_engine_disabled" };
  return { allowed: true, reason: "ok" };
}

export function generateReelScript(input: { title: string; objective?: string; duration?: ReelDuration; cta?: string }): ReelScript {
  const duration = input.duration || 30;
  const count = duration === 15 ? 3 : duration === 60 ? 6 : 4;
  const cta = input.cta || "続きはレイヴン・ブラックウッドのブログで確認してください。";
  const sceneTexts = [
    "問いを一つに絞る",
    "未来を決めつけず、選択肢を見る",
    "今できる小さな一手へ下ろす",
    "必要なら鑑定で一緒に整理する",
    "不安を煽らず、判断材料を増やす",
    "自分で選べる状態に戻る",
  ];
  return {
    hook: `${input.title}で迷ったら、最初に整えることがあります。`,
    scenes: sceneTexts.slice(0, count).map((text, index) => ({ index: index + 1, overlayText: text, narration: `${text}。落ち着いて視界を整えます。` })),
    cta,
    backgroundCategories: ["calm", "oracle", "desk", "night"],
    tempo: duration === 15 ? "fast" : "medium",
    bgmMood: "calm_mystic",
  };
}

export function selectBackgroundAssets(script: ReelScript, assets: VideoAsset[], needed: number) {
  const preferred = new Set(script.backgroundCategories);
  return [...assets]
    .sort((a, b) => {
      const aFit = preferred.has(a.category) || a.tags.some((tag) => preferred.has(tag)) ? 1 : 0;
      const bFit = preferred.has(b.category) || b.tags.some((tag) => preferred.has(tag)) ? 1 : 0;
      return bFit - aFit || a.usageCount - b.usageCount || b.performanceScore - a.performanceScore;
    })
    .slice(0, Math.max(1, needed));
}

export function composeScenes(duration: ReelDuration, script: ReelScript, assetIds: string[]) {
  const count = script.scenes.length || 1;
  const sceneLength = duration / count;
  const textLayers: ReelTextLayer[] = [];
  const scenes: ReelScene[] = script.scenes.map((scene, index) => {
    const startTime = Math.round(index * sceneLength * 10) / 10;
    const endTime = Math.round((index + 1) * sceneLength * 10) / 10;
    const textId = `text-${index + 1}`;
    textLayers.push({ id: textId, text: scene.overlayText, startTime, endTime, position: index === 0 ? "middle" : "bottom", alignment: "center", fontPreset: "brand-default", sizePreset: index === 0 ? "large" : "medium", emphasis: index === 0, safeArea: true });
    return { startTime, endTime, assetId: assetIds[index % Math.max(assetIds.length, 1)], crop: "center", fit: "cover", motion: index % 2 ? "pan_up" : "slow_zoom", transition: index === 0 ? "cut" : "fade", textLayerIds: [textId] };
  });
  return { scenes, textLayers };
}

export function validateComposition(project: Pick<ReelProject, "duration" | "scenes" | "textLayers">) {
  const errors: string[] = [];
  if (!project.scenes.length) errors.push("scenes_required");
  for (const scene of project.scenes) {
    if (scene.startTime < 0 || scene.endTime <= scene.startTime || scene.endTime > project.duration) errors.push("invalid_scene_time");
  }
  for (const layer of project.textLayers) {
    if (!layer.safeArea) errors.push("text_safe_area_required");
    if (layer.startTime < 0 || layer.endTime <= layer.startTime || layer.endTime > project.duration) errors.push("invalid_text_time");
  }
  return { valid: errors.length === 0, errors: Array.from(new Set(errors)) };
}

export class MockVideoRendererProvider implements VideoRendererProvider {
  async createRenderJob(project: ReelProject) {
    if (!project.rendererProvider || project.rendererProvider === "unconfigured") return { jobId: `render-${project.reelId}`, status: "unavailable" as const, message: "Renderer provider is not configured." };
    return { jobId: `render-${project.reelId}`, status: "queued" as const };
  }
  async getRenderStatus(jobId: string) {
    return { jobId, status: "unavailable", error: "Renderer provider is not configured." };
  }
  async cancelRenderJob(jobId: string) {
    return { jobId, cancelled: true };
  }
  async getOutput() {
    return {};
  }
}

export function reelProjectToSnsDraft(project: ReelProject) {
  return {
    platform: project.platform,
    postType: "reel",
    title: project.title,
    theme: project.script.hook,
    category: "Reel Engine",
    character: project.brandPresetId,
    purpose: project.objective,
    cta: project.script.cta,
    caption: `${project.script.hook}\n\n${project.script.scenes.map((scene) => scene.overlayText).join("\n")}\n\n${project.script.cta}`,
    script: project.script.scenes.map((scene) => `${scene.index}. ${scene.narration}`).join("\n"),
  };
}
