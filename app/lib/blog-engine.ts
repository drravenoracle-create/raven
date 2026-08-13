export const BLOG_ENGINE_TENANT_ID = "raven-oracle";
export const BLOG_ENGINE_VERSION = "blog-engine-v2.0";

export type BlogEngineInput = {
  topic?: string;
  category?: string;
  primaryKeyword?: string;
  targetReader?: string;
  searchIntent?: string;
};

export type BlogEngineDraft = {
  title: string;
  slug: string;
  description: string;
  body: string;
  category: string;
  tags: string[];
  primaryKeyword: string;
  secondaryKeywords: string[];
  searchIntent: string;
  targetReader: string;
  outline: string[];
  seoTitle: string;
  metaDescription: string;
  keyMessage: string;
  recommendedSocialAngle: string;
  qualityScore: number;
  brandScore: number;
  safetyScore: number;
  qualityReport: { warnings: string[]; blocked: boolean };
};

const defaultCategories = [
  "今日・今週・今月の運勢",
  "占術解説",
  "仕事運・金運",
  "恋愛・人間関係",
  "意思決定・人生相談",
  "東洋占術・戦略占術",
  "レイヴン・ブラックウッド世界観・ギルドの日常",
  "初心者向け占い解説",
  "鑑定サービス紹介",
  "占い師がホームページを持つメリット",
];

const prohibitedPatterns = [
  "絶対当たる",
  "必ず復縁",
  "不幸になる",
  "呪い",
  "依存してください",
  "今すぐ買わないと",
];

const homepageBenefitAngles = [
  "占い師がホームページを持つと、SNSだけでは流れてしまう信頼情報を残せる",
  "料金や鑑定メニューを整理しておくと、相談前の不安を減らせる",
  "プロフィールや考え方を掲載すると、相性の合う相談者に届きやすくなる",
  "ブログを蓄積すると、検索から新しい相談者に見つけてもらえる",
  "予約導線を整えると、相談したい気持ちを迷わせず受け止められる",
  "口コミや実績を安全に見せる場所があると、初回相談の心理的な壁が下がる",
  "SNS投稿とホームページをつなぐと、発信が一度きりで終わらない",
];

function pick<T>(items: T[], seed = new Date().getDate()) {
  return items[Math.abs(seed) % items.length];
}

export function slugify(value: string) {
  const ascii = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii.slice(0, 120);
  return `raven-blog-${Date.now()}`;
}

function buildHomepageBenefitsDraft(input: Required<BlogEngineInput>): BlogEngineDraft {
  const angle = input.topic || pick(homepageBenefitAngles);
  const title = angle;
  const primaryKeyword = input.primaryKeyword || "占い師 ホームページ メリット";
  const outline = [
    "SNSだけでは残りにくい情報",
    "相談前の不安を減らす役割",
    "予約までの道筋を整える",
    "レイヴン・ブラックウッドでの考え方",
  ];
  const body = [
    "## SNSだけでは残りにくい情報",
    "占い師の発信はSNSでも届きます。けれどSNSは流れが速く、料金、鑑定方針、得意な相談内容、予約方法のような大事な情報が、過去投稿の中に埋もれやすい場所でもあります。",
    "ホームページは、その流れてしまう情報を落ち着いて置いておける拠点です。初めて来た人が、占い師の雰囲気や相談できる内容を一度で確認できます。",
    "## 相談前の不安を減らす役割",
    "相談者は、申し込む前に多くの小さな不安を抱えています。どんな人が鑑定するのか。料金はいくらか。相談してよい内容なのか。強く売り込まれないか。",
    "ホームページに基本情報が整理されていると、その不安を一つずつ減らせます。これは派手な宣伝ではなく、相談者が安心して判断するための土台です。",
    "## 予約までの道筋を整える",
    "SNSで興味を持っても、次に何をすればよいか分からなければ、相談者はそこで止まります。プロフィール、鑑定メニュー、注意事項、予約ボタンが同じ場所にあるだけで、行動の迷いはかなり減ります。",
    "占い師側にとっても、毎回同じ説明を繰り返す負担が減ります。事前に読んでほしいことをページに置けるからです。",
    "## レイヴン・ブラックウッドでの考え方",
    "レイヴン・ブラックウッドでは、ホームページを単なる看板ではなく、相談者が自分のペースで確かめるための静かな受付として考えます。SNSで出会い、ブログで理解し、必要な人だけが鑑定へ進む。",
    "その流れが整うほど、占い師の言葉は一度きりの投稿ではなく、長く働く案内になります。",
  ].join("\n\n");
  return applyBrandGuard({
    title,
    slug: `fortune-teller-website-benefits-${new Date().toISOString().slice(0, 10)}`,
    description: "占い師がホームページを持つことで、信頼情報、予約導線、ブログ資産をどう整えられるかを解説します。",
    body,
    category: "占い師がホームページを持つメリット",
    tags: ["占い師", "ホームページ", "集客", "レイヴン・ブラックウッド", "Fortune Studio"],
    primaryKeyword,
    secondaryKeywords: ["占い師 集客", "占い師 ブログ", "予約導線", "信頼作り"],
    searchIntent: input.searchIntent || "占い師としてホームページを持つ実務的な利点を知りたい",
    targetReader: input.targetReader || "SNS発信だけに限界を感じている占い師・個人鑑定者",
    outline,
    seoTitle: `${title} | レイヴン・ブラックウッド Blog`,
    metaDescription: "占い師がホームページを持つメリットを、信頼形成、予約導線、ブログ蓄積の観点から整理します。",
    keyMessage: "ホームページは占い師の情報を一か所に整え、相談者が安心して判断するための拠点になる。",
    recommendedSocialAngle: "educational",
    qualityScore: 92,
    brandScore: 96,
    safetyScore: 98,
    qualityReport: { warnings: [], blocked: false },
  });
}

export function buildBlogDraft(input: BlogEngineInput = {}): BlogEngineDraft {
  const todaySeed = Number(new Date().toISOString().slice(8, 10));
  const category = input.category?.trim() || pick(defaultCategories, todaySeed);
  const topic = input.topic?.trim() || (category === "占い師がホームページを持つメリット" ? pick(homepageBenefitAngles, todaySeed) : "迷った時に未来を決めつけず、選択肢を整える方法");
  const normalizedInput = {
    topic,
    category,
    primaryKeyword: input.primaryKeyword?.trim() || topic,
    targetReader: input.targetReader?.trim() || "レイヴン・ブラックウッドで意思決定を整理したい読者",
    searchIntent: input.searchIntent?.trim() || "不安を煽らず、選択肢と次の一手を整理したい",
  };
  if (category === "占い師がホームページを持つメリット") {
    return buildHomepageBenefitsDraft(normalizedInput);
  }

  const title = topic;
  const outline = ["問いを一つに絞る", "占いを判断材料として扱う", "選択肢と次の一手を整理する", "レイヴン・ブラックウッドで確認できること"];
  const body = [
    "## 問いを一つに絞る",
    "迷いが強い時ほど、知りたいことは増えていきます。けれど最初に必要なのは、今いちばん整理したい問いを一つに絞ることです。",
    "## 占いを判断材料として扱う",
    "占いは未来を決めつけるものではありません。今の状況、気持ちの偏り、選択肢の見落としを確認するための補助として使うと、行動に戻しやすくなります。",
    "## 選択肢と次の一手を整理する",
    "進む、待つ、確認する、距離を置く。行動を小さく分けるだけで、迷いは扱いやすくなります。大きな決断に見えていたものも、今日できる一手まで下ろせます。",
    "## レイヴン・ブラックウッドで確認できること",
    "レイヴン・ブラックウッドの鑑定では、問いの置き方、選択肢の見え方、次に取れる現実的な行動を整理します。不安を煽るのではなく、自分で選ぶための視界を整えます。",
  ].join("\n\n");

  return applyBrandGuard({
    title,
    slug: slugify(title),
    description: `${category}について、レイヴン・ブラックウッドの視点で不安を煽らず選択肢を整理する記事です。`,
    body,
    category,
    tags: ["レイヴン・ブラックウッド", category, normalizedInput.primaryKeyword],
    primaryKeyword: normalizedInput.primaryKeyword,
    secondaryKeywords: ["未来を選ぶ助け", "相談整理", "意思決定"],
    searchIntent: normalizedInput.searchIntent,
    targetReader: normalizedInput.targetReader,
    outline,
    seoTitle: `${title} | レイヴン・ブラックウッド`,
    metaDescription: `${normalizedInput.targetReader}に向けて、${normalizedInput.primaryKeyword}を落ち着いて整理します。`.slice(0, 150),
    keyMessage: "占いは未来を決めつけるものではなく、未来を選ぶ助けです。",
    recommendedSocialAngle: "educational",
    qualityScore: 90,
    brandScore: 96,
    safetyScore: 98,
    qualityReport: { warnings: [], blocked: false },
  });
}

export function applyBrandGuard(draft: BlogEngineDraft): BlogEngineDraft {
  const text = `${draft.title}\n${draft.description}\n${draft.body}`;
  const warnings = prohibitedPatterns.filter((pattern) => text.includes(pattern));
  const keywordHits = draft.primaryKeyword ? text.split(draft.primaryKeyword).length - 1 : 0;
  if (keywordHits > 12) warnings.push("primary_keyword_stuffing");
  const safetyScore = Math.max(0, draft.safetyScore - warnings.length * 20);
  const qualityScore = draft.body.length < 500 ? Math.min(draft.qualityScore, 60) : draft.qualityScore;
  return { ...draft, safetyScore, qualityScore, qualityReport: { warnings, blocked: safetyScore < 90 || qualityScore < 70 } };
}

export function calculatePerformanceScore(input: { pageViews?: number; users?: number; organicTraffic?: number; socialReferral?: number; ctr?: number; ctaClicks?: number; conversions?: number; articleAgeDays?: number }) {
  const page = Math.min((input.pageViews || 0) / 1000, 1) * 25;
  const organic = Math.min((input.organicTraffic || 0) / 500, 1) * 20;
  const social = Math.min((input.socialReferral || 0) / 300, 1) * 15;
  const ctr = Math.min((input.ctr || 0) / 0.08, 1) * 15;
  const cta = Math.min((input.ctaClicks || 0) / 50, 1) * 15;
  const conversion = Math.min((input.conversions || 0) / 10, 1) * 10;
  const freshnessPenalty = Math.max(0, ((input.articleAgeDays || 0) - 365) / 365) * 10;
  return Math.max(0, Math.round((page + organic + social + ctr + cta + conversion - freshnessPenalty) * 10) / 10);
}

export function calculateContentGrowthScore(input: { organicScore?: number; socialScore?: number; engagementScore?: number; conversionScore?: number; evergreenScore?: number; freshnessScore?: number; growthVelocity?: number }) {
  const organic = Math.min(input.organicScore || 0, 100) * 0.25;
  const social = Math.min(input.socialScore || 0, 100) * 0.2;
  const engagement = Math.min(input.engagementScore || 0, 100) * 0.15;
  const conversion = Math.min(input.conversionScore || 0, 100) * 0.2;
  const evergreen = Math.min(input.evergreenScore || 0, 100) * 0.1;
  const freshness = Math.min(input.freshnessScore || 0, 100) * 0.05;
  const velocity = Math.min(input.growthVelocity || 0, 100) * 0.05;
  return Math.round((organic + social + engagement + conversion + evergreen + freshness + velocity) * 10) / 10;
}

export function createTrackingId(input: { articleId: string; platform: string; format: string; angle: string }) {
  return `${input.articleId}:${input.platform}:${input.format}:${input.angle}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160);
}

export function createBlogEvent(input: { eventType: string; articleId?: string; article?: Partial<BlogEngineDraft> & { url?: string; publishedAt?: string } }) {
  return {
    event_id: crypto.randomUUID(),
    schema_version: "1.0",
    event_type: input.eventType,
    tenant_id: BLOG_ENGINE_TENANT_ID,
    article_id: input.articleId,
    payload: {
      article_id: input.articleId,
      title: input.article?.title,
      slug: input.article?.slug,
      url: input.article?.url,
      summary: input.article?.description,
      category: input.article?.category,
      tags: input.article?.tags,
      primary_keyword: input.article?.primaryKeyword,
      secondary_keywords: input.article?.secondaryKeywords,
      search_intent: input.article?.searchIntent,
      key_message: input.article?.keyMessage,
      target_reader: input.article?.targetReader,
      published_at: input.article?.publishedAt,
      recommended_social_angle: input.article?.recommendedSocialAngle,
      content_version: 1,
      source_engine_version: BLOG_ENGINE_VERSION,
    },
  };
}

export function createSocialDerivatives(articleId: string, draft: BlogEngineDraft) {
  const items = [
    { platform: "instagram", format: "carousel", angle: draft.recommendedSocialAngle, content: `${draft.title}\n\n${draft.keyMessage}\n\n詳しくはレイヴン・ブラックウッドの記事へ。` },
    { platform: "instagram", format: "reel_script", angle: "hook", content: `0-3秒: ${draft.primaryKeyword}\n3-10秒: ${draft.keyMessage}\n10-22秒: ${draft.outline.join(" / ")}\n22-30秒: レイヴン・ブラックウッドの記事へ案内` },
    { platform: "instagram", format: "story", angle: "question", content: `${draft.primaryKeyword}で迷ったら、まず何を整理したいですか？\n記事で考え方をまとめています。` },
    { platform: "x", format: "short", angle: "question", content: `${draft.primaryKeyword}で迷った時は、結論を急ぐ前に問いを一つに絞る。${draft.keyMessage}` },
    { platform: "x", format: "thread", angle: "tips", content: `${draft.title}\n1. ${draft.outline[0]}\n2. ${draft.outline[1]}\n3. ${draft.outline[2]}\n詳しくは記事へ。` },
    { platform: "facebook", format: "post", angle: "summary", content: `${draft.description}\n\n${draft.keyMessage}` },
    { platform: "line", format: "message", angle: "summary", content: `新しい記事: ${draft.title}\n${draft.description}` },
  ];
  return items.map((item) => ({ ...item, trackingId: createTrackingId({ articleId, platform: item.platform, format: item.format, angle: item.angle }) }));
}

export function guardOptimization(input: { brandScore: number; safetyScore: number; sampleSize: number; riskLevel: string; locked?: boolean }) {
  if (input.locked) return { allowed: false, reason: "locked_setting" };
  if (input.brandScore < 80) return { allowed: false, reason: "brand_score_below_threshold" };
  if (input.safetyScore < 90) return { allowed: false, reason: "safety_score_below_threshold" };
  if (input.sampleSize < 30 && input.riskLevel !== "low") return { allowed: false, reason: "insufficient_sample_size" };
  if (input.riskLevel === "high") return { allowed: false, reason: "human_approval_required" };
  return { allowed: true, reason: "ok" };
}

