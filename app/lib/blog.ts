export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  category: string;
  tags: string[];
  featured?: boolean;
  body: string;
};

export const blogPosts: BlogPost[] = [
  {
    slug: "ai-fortune-today-flow",
    title: "AI無料占いで今日の流れを整える読み方",
    description: "Raven Oracleの無料占いを、毎日の判断や気持ちの整理に使うための基本ガイドです。",
    pubDate: "2026-07-27",
    category: "AI占い",
    tags: ["AI占い", "今日の運勢", "開運"],
    featured: true,
    body: [
      "## 今日の流れを見る意味",
      "占いは未来を固定するものではなく、今の選択肢を落ち着いて見直すための補助線です。Raven Oracleの無料占いでは、名前とテーマから今日の流れ、注意点、小さな開運行動を確認できます。",
      "## 入力するときのコツ",
      "気になることは長く書く必要はありません。恋愛、仕事、金運、今日の過ごし方の中から近いテーマを選び、一言で今の状態を書くだけで十分です。",
      "## 結果の使い方",
      "良い結果は背中を押す材料に、厳しい結果は予定を整える合図にしてください。大きな決断ほど、占い結果だけで決めず、現実の情報と合わせて判断することが大切です。",
    ].join("\n\n"),
  },
  {
    slug: "text-reading-coming-soon",
    title: "AIテキスト鑑定で確認できること",
    description: "準備中のAIテキスト鑑定で扱う予定の相談内容と、安全に使うための考え方をまとめます。",
    pubDate: "2026-07-27",
    category: "AIテキスト鑑定",
    tags: ["文章鑑定", "恋愛相談", "AI"],
    featured: false,
    body: [
      "## 文章から読むもの",
      "AIテキスト鑑定では、書き手の文章の温度感、言葉の強さ、返信前に確認したいリスクを整理します。断定ではなく、次に取れる行動を見つけるための読み解きとして設計します。",
      "## 送らない方がよい情報",
      "本名、住所、電話番号、勤務先、相手を特定できる情報は入力しないでください。相談文は必要最小限にし、自分の判断を守るための材料として使うのが基本です。",
      "## 公開までの予定",
      "無料占いの利用状況を見ながら、安全ルール、相談文の扱い、結果の表現を整えてから公開します。",
    ].join("\n\n"),
  },
];

export function getSortedBlogPosts() {
  return [...blogPosts].sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}