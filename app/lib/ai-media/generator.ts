export const AI_MEDIA_TENANT_ID = "raven-oracle";

export type AiMediaSettings = {
  tenant_id: string;
  enabled: number;
  provider: string;
  model: string;
  quality: string;
  default_aspect_ratio: string;
  images_per_post: number;
  monthly_budget_limit: number;
  per_post_cost_limit: number;
  fallback_policy: string;
};

export type MediaGenerationRequest = {
  tenantId: string;
  theme: string;
  characterId: string;
  divinationType: string;
  season: string;
  mood: string;
  scene: string;
  platform: string;
  aspectRatio: string;
  brandStyle: string;
  negativeInstructions: string;
  postId?: string;
  experimentId?: string;
};

export type MediaGenerationProvider = {
  providerId: string;
  generateImage(request: MediaGenerationRequest & { prompt: string; model: string; quality: string; size: string }): Promise<{ mimeType: string; bytes: ArrayBuffer; responseJson: unknown; actualCost?: number }>;
  getEstimatedCost(request: MediaGenerationRequest & { model: string; quality: string; units: number }): number;
  getCapabilities(): Record<string, unknown>;
};

export function cleanAiMediaText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export function sizeForAspectRatio(aspectRatio: string) {
  if (aspectRatio === "1:1") return { size: "1024x1024", width: 1024, height: 1024 };
  if (aspectRatio === "4:5") return { size: "1024x1536", width: 1024, height: 1536 };
  return { size: "1024x1536", width: 1024, height: 1536 };
}

export function buildPrompt(template: string, request: MediaGenerationRequest) {
  const replacements: Record<string, string> = {
    character_id: cleanAiMediaText(request.characterId, 80),
    theme: cleanAiMediaText(request.theme, 180),
    divination_type: cleanAiMediaText(request.divinationType, 80),
    season: cleanAiMediaText(request.season, 80),
    mood: cleanAiMediaText(request.mood, 80),
    scene: cleanAiMediaText(request.scene, 160),
    platform: cleanAiMediaText(request.platform, 80),
    aspect_ratio: cleanAiMediaText(request.aspectRatio, 20),
    brand_style: cleanAiMediaText(request.brandStyle, 240),
    negative_instructions: cleanAiMediaText(request.negativeInstructions, 300),
  };
  return template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => replacements[key] ?? "");
}

export function hasPromptInjectionRisk(value: unknown) {
  const text = String(value ?? "").toLowerCase();
  return /ignore previous|system prompt|developer message|api key|secret|token|jailbreak|命令を無視|システムプロンプト/.test(text);
}

export function estimateConfiguredCost(monthlySpent: number, settings: AiMediaSettings, units = 1) {
  const estimated = Math.max(1, units) * Math.min(Number(settings.per_post_cost_limit || 20), 20);
  return {
    estimated,
    monthlySpent,
    remainingMonthlyBudget: Math.max(Number(settings.monthly_budget_limit || 0) - monthlySpent, 0),
    allowed: Boolean(settings.enabled) && estimated <= Number(settings.per_post_cost_limit || 0) && monthlySpent + estimated <= Number(settings.monthly_budget_limit || 0),
  };
}

export class OpenAiImageProvider implements MediaGenerationProvider {
  providerId = "openai-image";
  constructor(private apiKey: string) {}

  getCapabilities() {
    return { generateImage: true, editImage: false, generateVideo: false, aspectRatios: ["9:16", "4:5", "1:1"] };
  }

  getEstimatedCost() {
    return 0;
  }

  async generateImage(request: MediaGenerationRequest & { prompt: string; model: string; quality: string; size: string }) {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not configured.");
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: request.model,
        prompt: request.prompt,
        size: request.size,
        quality: request.quality,
        n: 1,
        response_format: "b64_json",
      }),
    });
    const data = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string }>; error?: { message?: string; code?: string } };
    if (!response.ok) throw new Error(data.error?.message || `OpenAI image API failed: ${response.status}`);
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image API returned no image data.");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { mimeType: "image/png", bytes: bytes.buffer, responseJson: { provider: this.providerId, model: request.model } };
  }
}
