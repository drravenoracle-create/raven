import { getTenantConfig } from "./tenant-config";

export type IdeaMode = "BALANCED" | "VIRAL" | "CONVERSION" | "EXPERIMENTAL" | "BRAND";

type IdeaOptions = {
  tenantId: string;
  locale?: string;
  platform?: string;
  category?: string;
  characterId?: string;
  mode?: IdeaMode;
  count?: number;
};

type Pattern = {
  name: string;
  contentType: string;
  category: string;
  hookStyle: string;
  goal: string;
  title: string;
  concept: string;
  hook: string;
};

const PATTERNS: Pattern[] = [
  { name: "quiet_love", contentType: "three_choice", category: "恋愛", hookStyle: "CURIOSITY", goal: "engagement", title: "今、あなたを密かに想っている人", concept: "相手の気持ちを3択で静かに読み解く", hook: "最近、あなたのことを考えている人がいます。" },
  { name: "next_72_hours", contentType: "three_choice", category: "近未来", hookStyle: "PREDICTION", goal: "completion", title: "72時間以内に起きること", concept: "近い未来の流れを3択で読む", hook: "72時間以内に、あなたの流れが動くこと。" },
  { name: "unsaid_truth", contentType: "pick_a_card", category: "恋愛", hookStyle: "SECRET", goal: "saves", title: "あの人が言えない本音", concept: "カードを選び、短いセリフで本音を届ける", hook: "あの人がまだ言葉にしていないこと。" },
  { name: "warning_card", contentType: "one_card", category: "自己成長", hookStyle: "WARNING", goal: "saves", title: "1枚だけ、今のあなたへの注意点", concept: "不安を煽らず、今日の行動に落とし込む", hook: "少しだけ立ち止まって確認したいこと。" },
  { name: "future_kanji", contentType: "one_card", category: "近未来", hookStyle: "CURIOSITY", goal: "shares", title: "未来を漢字一文字で", concept: "一文字の象徴から、今できる準備を読む", hook: "1か月後のあなたを漢字一文字で表すと？" },
  { name: "stop_card", contentType: "stop_card", category: "総合", hookStyle: "DIRECT", goal: "completion", title: "止まった瞬間のカード", concept: "高速表示から直感で受け取ったカードを読む", hook: "選ばなくていい。止まったカードがメッセージです。" },
  { name: "guild_ally", contentType: "character_reading", category: "ギルド", hookStyle: "EMOTIONAL", goal: "comments", title: "あなたの味方になるギルドメンバー", concept: "キャラクターの視点とカードを組み合わせる", hook: "今のあなたに一番近い言葉をくれるのは誰？" },
  { name: "screenshot_card", contentType: "screenshot_card", category: "総合", hookStyle: "PICK_A_CARD", goal: "shares", title: "スクショで受け取る運命のカード", concept: "参加者がスクリーンショットでカードを受け取る", hook: "画面を止めて、最初に見えたカードを受け取ってください。" },
  { name: "future_letter", contentType: "story", category: "自己成長", hookStyle: "EMOTIONAL", goal: "saves", title: "未来のあなたから届いた手紙", concept: "未来の自分から今の自分へ短い手紙を届ける", hook: "1か月後のあなたから、今のあなたへ。" },
  { name: "guild_table", contentType: "guild_story", category: "ギルド", hookStyle: "CURIOSITY", goal: "comments", title: "ギルドのテーブルに残されたカード", concept: "ギルドの世界観からカードの意味をひらく", hook: "今夜、ギルドのテーブルに3枚のカードが残されていました。" },
];

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function json(value: unknown) {
  return JSON.stringify(value ?? {});
}

function supportedTenant(tenantId: string) {
  return Boolean(getTenantConfig(tenantId));
}

export function listIdeaPatterns(tenantId: string) {
  if (!supportedTenant(tenantId)) return [];
  return PATTERNS.map((pattern) => ({ ...pattern, patternId: pattern.name }));
}

export async function generateIdeaCandidates(db: D1Database, options: IdeaOptions) {
  if (!supportedTenant(options.tenantId)) throw new Error("Unknown tenant.");
  const count = Math.min(Math.max(Number(options.count || 10), 1), 20);
  const locale = clean(options.locale || "ja", 12);
  const platform = clean(options.platform || "auto", 40);
  const category = clean(options.category || "auto", 80);
  const mode = options.mode || "BALANCED";
  const recent = await db.prepare(
    `SELECT title, theme, category, post_type, character, cta
       FROM sns_posts
      WHERE tenant_id = ?
      ORDER BY datetime(created_at) DESC
      LIMIT 30`,
  ).bind(options.tenantId).all<Record<string, unknown>>();
  const recentRows = recent.results || [];
  const recentText = recentRows.map((row) => `${row.title || ""} ${row.theme || ""} ${row.category || ""}`).join(" ");
  const categoryCount = new Map<string, number>();
  for (const row of recentRows) categoryCount.set(String(row.category || "総合"), (categoryCount.get(String(row.category || "総合")) || 0) + 1);

  const patterns = PATTERNS
    .filter((pattern) => category === "auto" || pattern.category === category)
    .sort((a, b) => {
      const aRecent = recentText.includes(a.title) ? 1 : 0;
      const bRecent = recentText.includes(b.title) ? 1 : 0;
      const aCategory = categoryCount.get(a.category) || 0;
      const bCategory = categoryCount.get(b.category) || 0;
      return (aRecent - bRecent) || (bCategory - aCategory);
    });
  const selected = Array.from({ length: count }, (_, index) => patterns[index % patterns.length]);
  const created: Record<string, unknown>[] = [];

  for (const [index, pattern] of selected.entries()) {
    const ideaId = crypto.randomUUID();
    const categoryUsage = categoryCount.get(pattern.category) || 0;
    const noveltyScore = Math.max(35, Math.min(98, 92 - categoryUsage * 8 - (recentText.includes(pattern.title) ? 24 : 0) + (index % 3) * 2));
    const evidence = [
      { sourceType: "measured", claim: `直近30投稿: ${recentRows.length}件`, value: { sampleSize: recentRows.length } },
      { sourceType: "measured", claim: `${pattern.category}カテゴリの直近使用数: ${categoryUsage}件`, value: { category: pattern.category, count: categoryUsage } },
    ];
    const reason = categoryUsage >= 5
      ? `直近30投稿で${pattern.category}が${categoryUsage}件あるため、同じ見せ方を避けて構成を変える案として提案します。`
      : `${pattern.category}の投稿頻度が相対的に低く、最近使っていない形式を試せるため提案します。`;
    const expectedPotential = recentRows.length < 7 ? "INSUFFICIENT_DATA" : "EXPERIMENTAL";
    await db.prepare(
      `INSERT INTO sns_ideas
        (idea_id, tenant_id, character_id, locale, platform, title, concept, category, content_type, hook, hook_style,
         recommended_duration, recommended_template, target_audience, primary_goal, reason, evidence_summary, evidence_json,
         novelty_score, expected_potential, confidence, mode, status, source_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUGGESTED', 'rule_based')`,
    ).bind(
      ideaId, options.tenantId, clean(options.characterId, 80) || null, locale, platform,
      pattern.title, pattern.concept, pattern.category, pattern.contentType, pattern.hook, pattern.hookStyle,
      20, pattern.contentType === "three_choice" ? "three-choice-reading" : pattern.contentType,
      "占い・意思決定を整理したい読者", pattern.goal, reason, evidence.map((item) => item.claim).join(" / "), json(evidence),
      noveltyScore, expectedPotential, recentRows.length < 7 ? 0 : 0.5, mode,
    ).run();
    for (const item of evidence) {
      await db.prepare(
        `INSERT INTO sns_idea_evidence (evidence_id, tenant_id, idea_id, source_type, claim, value_json, data_quality)
         VALUES (?, ?, ?, ?, ?, ?, 'measured')`,
      ).bind(crypto.randomUUID(), options.tenantId, ideaId, item.sourceType, item.claim, json(item.value)).run();
    }
    created.push({ ideaId, ...pattern, platform, locale, mode, noveltyScore, expectedPotential, confidence: recentRows.length < 7 ? 0 : 0.5, reason, evidence });
  }
  return created;
}

export async function updateIdeaStatus(db: D1Database, tenantId: string, ideaId: string, action: string, reason?: string) {
  const allowed: Record<string, string> = { save: "SAVED", adopt: "ADOPTED", reject: "REJECTED" };
  const status = allowed[action];
  if (!status) throw new Error("Unsupported idea action.");
  const idea = await db.prepare("SELECT * FROM sns_ideas WHERE tenant_id = ? AND idea_id = ? LIMIT 1").bind(tenantId, ideaId).first<Record<string, unknown>>();
  if (!idea) throw new Error("Idea not found.");
  let producedPostId = "";
  if (action === "adopt") {
    producedPostId = crypto.randomUUID();
    await db.prepare(
      `INSERT INTO sns_posts
        (id, tenant_id, platform, post_type, title, theme, category, character, purpose, cta, caption, hashtags, script, media_type, status, ai_generated, duplicate_warning)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, 'SNS Idea Plannerから作成したDraft', '', ?, '', ?, '', 'draft', 1, ?)`,
    ).bind(
      producedPostId, tenantId, idea.platform || "instagram", idea.title, idea.title, idea.category,
      idea.character_id || "", `企画: ${idea.title}\n\n${idea.hook}\n\n${idea.concept}`,
      `冒頭: ${idea.hook}\n\n構成: ${idea.concept}`,
      `idea:${ideaId}`,
    ).run();
    await db.prepare("UPDATE sns_ideas SET adopted_post_id = ?, produced_post_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND idea_id = ?")
      .bind(producedPostId, producedPostId, status, tenantId, ideaId).run();
  } else {
    await db.prepare("UPDATE sns_ideas SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND idea_id = ?")
      .bind(status, tenantId, ideaId).run();
  }
  await db.prepare("INSERT INTO sns_idea_feedback (feedback_id, tenant_id, idea_id, action, reason_code, note) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tenantId, ideaId, status, clean(reason, 80) || null, clean(reason, 1000) || null).run();
  return { ideaId, status, producedPostId: producedPostId || null };
}
