export type TarotCard = {
  id: string;
  name: string;
  nameJa: string;
  upright: string;
  advice: string;
  caution: string;
};

export const tarotCards: TarotCard[] = [
  {
    id: "the-fool",
    name: "The Fool",
    nameJa: "愚者",
    upright: "新しい一歩、余白、未知への入り口",
    advice: "小さく試し、戻れる道を残してください。",
    caution: "勢いだけで約束や支払いを決めないこと。",
  },
  {
    id: "the-magician",
    name: "The Magician",
    nameJa: "魔術師",
    upright: "準備、言葉、手元の資源を使う力",
    advice: "いま持っている道具を一つ選び、形にしてください。",
    caution: "見せ方だけで中身を急がないこと。",
  },
  {
    id: "the-high-priestess",
    name: "The High Priestess",
    nameJa: "女教皇",
    upright: "静かな観察、直感、隠れた情報",
    advice: "答えを急がず、違和感の正体をメモしてください。",
    caution: "沈黙を相手の本心だと決めつけないこと。",
  },
  {
    id: "the-empress",
    name: "The Empress",
    nameJa: "女帝",
    upright: "育つもの、安心、受け取る力",
    advice: "整えること、休ませることにも価値を置いてください。",
    caution: "与えすぎて自分の余白を失わないこと。",
  },
  {
    id: "the-emperor",
    name: "The Emperor",
    nameJa: "皇帝",
    upright: "境界、構造、責任ある判断",
    advice: "基準を一つ決め、それに沿って動いてください。",
    caution: "正しさで押し切りすぎないこと。",
  },
  {
    id: "the-hermit",
    name: "The Hermit",
    nameJa: "隠者",
    upright: "内省、長期視点、一人で確かめる時間",
    advice: "人に聞く前に、自分の本音を一行で書いてください。",
    caution: "孤立と熟考を混同しないこと。",
  },
  {
    id: "justice",
    name: "Justice",
    nameJa: "正義",
    upright: "公平、記録、釣り合い、冷静な判断",
    advice: "感情と事実を分けて、判断材料を並べてください。",
    caution: "白黒を急ぎすぎないこと。",
  },
  {
    id: "temperance",
    name: "Temperance",
    nameJa: "節制",
    upright: "調整、回復、混ぜ合わせる知恵",
    advice: "極端な答えより、続けられる中間点を選んでください。",
    caution: "我慢を美徳にしすぎないこと。",
  },
  {
    id: "the-star",
    name: "The Star",
    nameJa: "星",
    upright: "希望、回復、遠くの目印",
    advice: "今日できる小さな回復行動を一つ入れてください。",
    caution: "理想だけで現実の手順を飛ばさないこと。",
  },
  {
    id: "the-world",
    name: "The World",
    nameJa: "世界",
    upright: "一区切り、統合、次の段階への完成",
    advice: "終わらせるものと続けるものを分けてください。",
    caution: "完成を待ちすぎて公開や共有を遅らせないこと。",
  },
];
