export type SocialPlatform = "instagram" | "tiktok" | "youtube";

export type PlatformCapability = {
  platform: SocialPlatform;
  label: string;
  enabled: boolean;
  configured: boolean;
  mode: "official" | "mock" | "manual";
  supports: string[];
  notes: string[];
};

export function platformCapabilities(env: Record<string, unknown>, flags: Record<string, boolean> = {}) {
  const officialTikTok = Boolean(env.TIKTOK_CLIENT_KEY && env.TIKTOK_CLIENT_SECRET);
  const officialYouTube = Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET);
  return [
    {
      platform: "instagram" as const,
      label: "Instagram",
      enabled: true,
      configured: Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID),
      mode: "official" as const,
      supports: ["image", "carousel", "reel"],
      notes: [],
    },
    {
      platform: "tiktok" as const,
      label: "TikTok",
      enabled: flags.tiktok ?? false,
      configured: officialTikTok,
      mode: officialTikTok ? "official" as const : "mock" as const,
      supports: ["video"],
      notes: officialTikTok ? [] : ["TikTok OAuth / Content Posting API設定が必要です。"],
    },
    {
      platform: "youtube" as const,
      label: "YouTube Shorts",
      enabled: flags.youtube ?? false,
      configured: officialYouTube,
      mode: officialYouTube ? "official" as const : "mock" as const,
      supports: ["video"],
      notes: officialYouTube ? [] : ["YouTube OAuth / Data API設定が必要です。"],
    },
  ];
}

export function validateShortVideo(input: { mediaType?: string; mediaUrl?: string; duration?: number; width?: number; height?: number }) {
  const errors: string[] = [];
  if (input.mediaType && input.mediaType !== "video") errors.push("動画ファイルが必要です。");
  if (!input.mediaUrl) errors.push("R2等の動画URLが必要です。");
  if (input.duration !== undefined && (input.duration <= 0 || input.duration > 180)) errors.push("動画時間は180秒以内にしてください。");
  if (input.width !== undefined && input.height !== undefined && input.height < input.width) errors.push("縦型動画を指定してください。");
  return { valid: errors.length === 0, errors };
}
