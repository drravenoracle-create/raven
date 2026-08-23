export type CharacterConfig = {
  id: string;
  slug: string;
  displayName: string;
  tenantId: string;
  publicProfile: { baseUrl: string; profileUrl: string };
  defaultCta: string;
  reelCta: string;
  threeChoiceCta: string;
  dailyThreeChoiceCta: string;
  threeChoiceHashtags: string[];
  dailyThreeChoiceHashtags: string[];
  threeChoicePostHashtags: string[];
  sns: {
    hashtags: string[];
    defaultPurpose: string;
    brandStyle: string;
    instagram: { enabled: boolean; defaultCaption: string; defaultHashtags: string[] };
    tiktok: { enabled: boolean; defaultCaption: string; defaultHashtags: string[] };
    youtube: { enabled: boolean; defaultTitle: string; defaultDescription: string; defaultHashtags: string[] };
  };
  brand: { tone: string; style: string };
};

export const RAVEN_CHARACTER_CONFIG: CharacterConfig = {
  id: "raven",
  slug: "raven-blackwood",
  displayName: "レイヴン・ブラックウッド",
  tenantId: "raven-oracle",
  publicProfile: { baseUrl: "https://raven.fortunestudios.jp", profileUrl: "https://raven.fortunestudios.jp/guild/" },
  defaultCta: "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。",
  reelCta: "続きはレイヴン・ブラックウッドのブログで確認してください。",
  threeChoiceCta: "詳しい鑑定はプロフィールへ",
  dailyThreeChoiceCta: "もっと詳しく占うなら、プロフィールからRaven Oracleへ。",
  threeChoiceHashtags: ["#レイヴンブラックウッド", "#3択占い", "#オラクルカード", "#今日のメッセージ"],
  dailyThreeChoiceHashtags: ["#レイヴンブラックウッド", "#3択占い", "#オラクルカード", "#占い", "#恋愛占い"],
  threeChoicePostHashtags: ["#レイヴンブラックウッド", "#3択占い", "#占い", "#オラクルカード"],
  sns: {
    hashtags: ["#レイヴンブラックウッド", "#文章鑑定", "#相談整理"],
    defaultPurpose: "テキスト鑑定への案内",
    brandStyle: "Raven Oracle, refined, readable, calm",
    instagram: { enabled: true, defaultCaption: "レイヴン・ブラックウッドからの短いメッセージです。", defaultHashtags: ["#レイヴンブラックウッド", "#占い", "#相談整理"] },
    tiktok: { enabled: true, defaultCaption: "レイヴン・ブラックウッドの短いメッセージです。", defaultHashtags: ["#レイヴンブラックウッド", "#占い", "#相談整理"] },
    youtube: { enabled: true, defaultTitle: "レイヴン・ブラックウッドの今日のメッセージ", defaultDescription: "レイヴン・ブラックウッドが、迷いを整理するための視点を届けます。", defaultHashtags: ["#レイヴンブラックウッド", "#占い", "#Shorts"] },
  },
  brand: { tone: "落ち着いて、断定を避け、現実的な次の一手を示す", style: "短く明確に、観察と助言を分ける" },
};

export function getCharacterConfig(id = RAVEN_CHARACTER_CONFIG.id) {
  return id === RAVEN_CHARACTER_CONFIG.id ? RAVEN_CHARACTER_CONFIG : undefined;
}
