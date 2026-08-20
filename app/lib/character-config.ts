export type CharacterConfig = {
  id: string;
  displayName: string;
  tenantId: string;
  defaultCta: string;
  reelCta: string;
  sns: { hashtags: string[]; defaultPurpose: string };
  brand: { tone: string; style: string };
};

export const RAVEN_CHARACTER_CONFIG: CharacterConfig = {
  id: "raven",
  displayName: "レイヴン・ブラックウッド",
  tenantId: "raven-oracle",
  defaultCta: "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。",
  reelCta: "続きはレイヴン・ブラックウッドのブログで確認してください。",
  sns: { hashtags: ["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"], defaultPurpose: "テキスト鑑定への案内" },
  brand: { tone: "落ち着いて、断定を避け、現実的な次の一手を示す", style: "短く明確に、観察と助言を分ける" },
};

export function getCharacterConfig(id = RAVEN_CHARACTER_CONFIG.id) {
  return id === RAVEN_CHARACTER_CONFIG.id ? RAVEN_CHARACTER_CONFIG : undefined;
}
