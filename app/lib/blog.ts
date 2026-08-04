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
    slug: "raven-text-reading-guide",
    title: "Raven Oracle テキスト鑑定の使い方",
    description:
      "相談文や返信前の文章を、Raven Oracleの視点で整理するための基本ガイドです。",
    pubDate: "2026-07-27",
    category: "テキスト鑑定",
    tags: ["Raven Oracle", "文章鑑定", "相談文"],
    featured: true,
    body: [
      "## 文章から読むもの",
      "Raven Oracleのテキスト鑑定では、文章の温度、意図、相手に与える圧、返信前に整えるべき点を確認します。未来を断定するのではなく、次に取れる行動を見つけるための補助として使います。",
      "## 入力するときのコツ",
      "送る前のメッセージ、相手から届いた文面、相談したい状況メモをそのまま貼り付けてください。名前、住所、電話番号、勤務先など、個人を特定できる情報は入れないでください。",
      "## 結果の使い方",
      "結果は、文面を責めるためではなく整えるために使います。強く出すべき部分、引いたほうがよい部分、最後に添える一文を確認してから送信してください。",
    ].join("\n\n"),
  },
  {
    slug: "timed-chat-review-flow",
    title: "時間制チャットで相談を絞る流れ",
    description:
      "5分、10分、20分、30分の枠で、相談の焦点を絞って会話するための運用メモです。",
    pubDate: "2026-07-27",
    category: "時間制チャット",
    tags: ["チャット", "相談整理", "Raven Oracle"],
    featured: false,
    body: [
      "## 最初に焦点を一つ決める",
      "時間制チャットでは、相談を広げすぎず、今いちばん知りたいことを一つに絞ります。短い時間でも、問いが明確なら答えは実用的になります。",
      "## 途中で確認すること",
      "相手にどう伝わるか、自分が何を守りたいか、次にどの行動を選ぶかを順に確認します。迷いを広げるより、選べる形に戻すことを優先します。",
      "## 終了前のまとめ",
      "最後に、送る一文、待つ時間、保留する判断を分けて整理します。チャットの目的は、気持ちを煽ることではなく、行動前の視界を落ち着かせることです。",
    ].join("\n\n"),
  },
];

export function getSortedBlogPosts() {
  return [...blogPosts].sort((a, b) => b.pubDate.localeCompare(a.pubDate));
}

export function getBlogPost(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}
