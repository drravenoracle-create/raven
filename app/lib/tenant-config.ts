import { RAVEN_CHARACTER_CONFIG } from "./character-config";

export type TenantIdentity = {
  tenantId: string;
  tenantKey: string;
  displayName: string;
  publicUrl: string;
  primaryCharacterId: string;
};

export type TenantBranding = {
  character: typeof RAVEN_CHARACTER_CONFIG;
  characterDisplayName: string;
  tone: string;
  style: string;
};

export type TenantContent = { defaultCta: string; hashtags: string[] };

export type TenantBlogConfig = {
  enabled?: boolean;
  defaultCategories: string[];
  defaultTargetReader: string;
  defaultSearchIntent: string;
  seoTitleSuffix: string;
};

export type TenantSnsConfig = { defaultCta: string; hashtags: string[] };

export type TenantReelConfig = {
  defaultCta: string;
  defaultAspectRatio: "9:16";
  defaultDuration: 15 | 30 | 60;
  backgroundCategories: string[];
  brandPresetId: string;
  storageNamespace: string;
};

export type TenantAnalyticsConfig = { enabled?: boolean; publicUrl: string; sources: string[] };
export type TenantGrowthConfig = { tenantId: string };
export type TenantStorageConfig = { mediaNamespace: string; reelNamespace: string };
export type TenantEntitlements = { plan?: string; features?: Record<string, boolean>; limits?: Record<string, number> };

export type TenantConfig = {
  id: string;
  displayName: string;
  publicUrl: string;
  primaryCharacterId: string;
  character: typeof RAVEN_CHARACTER_CONFIG;
  identity: TenantIdentity;
  branding: TenantBranding;
  content: TenantContent;
  blog: TenantBlogConfig;
  sns: TenantSnsConfig;
  reel: TenantReelConfig;
  analytics: TenantAnalyticsConfig;
  growth: TenantGrowthConfig;
  storage: TenantStorageConfig;
  entitlements: TenantEntitlements;
};

const RAVEN_PUBLIC_URL = "https://raven.fortunestudios.jp";

export const RAVEN_TENANT_CONFIG: TenantConfig = {
  id: RAVEN_CHARACTER_CONFIG.tenantId,
  displayName: "Raven Oracle",
  publicUrl: RAVEN_PUBLIC_URL,
  primaryCharacterId: RAVEN_CHARACTER_CONFIG.id,
  character: RAVEN_CHARACTER_CONFIG,
  identity: { tenantId: RAVEN_CHARACTER_CONFIG.tenantId, tenantKey: RAVEN_CHARACTER_CONFIG.tenantId, displayName: "Raven Oracle", publicUrl: RAVEN_PUBLIC_URL, primaryCharacterId: RAVEN_CHARACTER_CONFIG.id },
  branding: { character: RAVEN_CHARACTER_CONFIG, characterDisplayName: RAVEN_CHARACTER_CONFIG.displayName, tone: RAVEN_CHARACTER_CONFIG.brand.tone, style: RAVEN_CHARACTER_CONFIG.brand.style },
  content: { defaultCta: RAVEN_CHARACTER_CONFIG.defaultCta, hashtags: RAVEN_CHARACTER_CONFIG.sns.hashtags },
  blog: {
    defaultCategories: ["今日・今週・今月の運勢", "占術解説", "仕事運・金運", "恋愛・人間関係", "意思決定・人生相談", "東洋占術・戦略占術", "レイヴン・ブラックウッド世界観・ギルドの日常", "初心者向け占い解説", "鑑定サービス紹介", "占い師がホームページを持つメリット"],
    defaultTargetReader: "レイヴン・ブラックウッドで意思決定を整理したい読者",
    defaultSearchIntent: "不安を煽らず、選択肢と次の一手を整理したい",
    seoTitleSuffix: "レイヴン・ブラックウッド",
  },
  sns: { defaultCta: RAVEN_CHARACTER_CONFIG.defaultCta, hashtags: RAVEN_CHARACTER_CONFIG.sns.hashtags },
  reel: { defaultCta: RAVEN_CHARACTER_CONFIG.reelCta, defaultAspectRatio: "9:16", defaultDuration: 30, backgroundCategories: ["calm", "oracle", "desk", "night"], brandPresetId: "Raven Blackwood", storageNamespace: "reel-assets" },
  analytics: { publicUrl: `${RAVEN_PUBLIC_URL}/`, sources: ["ga4", "search_console", "cloudflare"] },
  growth: { tenantId: RAVEN_CHARACTER_CONFIG.tenantId },
  storage: { mediaNamespace: "media", reelNamespace: "reel-assets" },
  entitlements: {},
};

export function getTenantConfig(tenantId = RAVEN_TENANT_CONFIG.id) {
  return tenantId === RAVEN_TENANT_CONFIG.id ? RAVEN_TENANT_CONFIG : undefined;
}

export function getBlogConfig(tenant: TenantConfig): TenantBlogConfig & Pick<TenantConfig, "identity" | "branding" | "content"> {
  return { identity: tenant.identity, branding: tenant.branding, content: tenant.content, ...tenant.blog };
}

export function getGrowthConfig(tenant: TenantConfig): TenantGrowthConfig & Pick<TenantConfig, "identity" | "analytics" | "entitlements"> {
  return { identity: tenant.identity, analytics: tenant.analytics, entitlements: tenant.entitlements, ...tenant.growth };
}

export function getReelConfig(tenant: TenantConfig): TenantReelConfig & Pick<TenantConfig, "identity" | "branding" | "storage" | "entitlements"> {
  return { identity: tenant.identity, branding: tenant.branding, storage: tenant.storage, entitlements: tenant.entitlements, ...tenant.reel };
}

export function getAnalyticsConfig(tenant: TenantConfig): TenantAnalyticsConfig & Pick<TenantConfig, "identity"> {
  return { identity: tenant.identity, ...tenant.analytics };
}
