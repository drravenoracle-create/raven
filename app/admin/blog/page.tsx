"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type EngineArticle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  body: string;
  category: string;
  status: string;
  quality_score: number;
  brand_score: number;
  safety_score: number;
  created_at: string;
  scheduled_at?: string;
  published_at?: string;
};
type EngineRecommendation = { id: string; article_id?: string; recommendation_type?: string; title: string; summary: string; reason?: string; evidence_json?: string; expected_effect?: string; risk_level: string; rollback_plan?: string; status: string; created_at?: string; applied_at?: string };
type EngineSettings = { enabled: number; kill_switch: number; auto_post_enabled: number; posting_mode: string; automation_levels_json: string; schedule_json?: string };
type SocialContent = { source_article_id: string; platform: string; format: string; angle: string; status: string; tracking_id: string; scheduled_at?: string };
type ArticleForm = Pick<EngineArticle, "id" | "slug" | "title" | "description" | "body" | "category" | "status"> & { scheduled_at?: string };
type DailySeries = { id: string; title: string; category: string; draft_time: string; publish_time: string; enabled: boolean };

const categories = ["今日・今週・今月の運勢", "占術解説", "仕事運・金運", "恋愛・人間関係", "意思決定・人生相談", "東洋占術／戦略占術", "レイヴン・ブラックウッド世界観・ギルドの日常", "初心者向け占い解説", "鑑定サービス紹介"];
const statusLabels: Record<string, string> = { draft: "下書き", scheduled: "予約済み", approved: "承認済み", published: "公開済み", quality_failed: "品質停止" };
type TopicSuggestion = { title: string; category: string };
const topicSuggestions: TopicSuggestion[] = [
  { title: "迷いを一つの問いに絞ると、占いの答えはどう変わるのか", category: "意思決定・人生相談" },
  { title: "奇門遁甲で見る、動くべき時と待つべき時の違い", category: "東洋占術／戦略占術" },
  { title: "六壬神課が人間関係の距離感を読む時に見るもの", category: "占術解説" },
  { title: "太乙神数で考える、大きな流れと個人の選択", category: "占術解説" },
  { title: "易経の変爻は、なぜ状況の変化を読む鍵になるのか", category: "占術解説" },
  { title: "恋愛相談で相手の気持ちだけを追いすぎないために", category: "恋愛・人間関係" },
  { title: "仕事運を見る前に整理したい、選択肢と責任の分け方", category: "仕事運・金運" },
  { title: "初めて鑑定を受ける人が、質問文で失敗しないための準備", category: "初心者向け占い解説" },
  { title: "レイヴン・ブラックウッドの鑑定で大切にしている現実的な一手", category: "鑑定サービス紹介" },
  { title: "ギルドの日常から見る、占い師が言葉を選ぶ理由", category: "レイヴン・ブラックウッド世界観・ギルドの日常" },
];
const defaultGenerationPrompt = [
  "You are Fortune Studio Blog Engine for Raven Blackwood.",
  "Write a production-ready Japanese blog article. Do not output markdown fences. Return JSON only.",
  "Brand rules: do not claim guaranteed fortune results, do not create fear-based sales copy, do not encourage dependency. Treat divination as a tool for organizing choices.",
  "The article must be useful, specific, and suitable for an official Raven Blackwood blog.",
  "Return keys: title, slug, description, body, category, tags, primaryKeyword, secondaryKeywords, searchIntent, targetReader, outline, seoTitle, metaDescription, keyMessage, recommendedSocialAngle.",
  "body must be markdown with 4-6 H2 sections and at least 1000 Japanese characters.",
].join("\n");

function parseAutomationLevels(value?: string) {
  try {
    return JSON.parse(value || "{}") as { article_generation?: boolean; auto_publish?: boolean };
  } catch {
    return {};
  }
}

function parseDailySeries(value?: string) {
  try {
    const parsed = JSON.parse(value || "{}") as { daily_series?: DailySeries[] };
    return Array.isArray(parsed.daily_series) ? parsed.daily_series : [];
  } catch {
    return [];
  }
}

function toForm(article: EngineArticle): ArticleForm {
  return {
    id: article.id,
    slug: article.slug || "",
    title: article.title || "",
    description: article.description || "",
    body: article.body || "",
    category: article.category || "",
    status: article.status || "draft",
    scheduled_at: article.scheduled_at || "",
  };
}

function nextTopicSuggestion(currentTitle: string): TopicSuggestion {
  const index = topicSuggestions.findIndex((item) => item.title === currentTitle);
  return topicSuggestions[(index + 1 + topicSuggestions.length) % topicSuggestions.length];
}

export default function BlogAdminPage() {
  const [statusMessage, setStatusMessage] = useState("待機中です。");
  const [engineTopic, setEngineTopic] = useState(topicSuggestions[0].title);
  const [engineCategory, setEngineCategory] = useState(topicSuggestions[0].category);
  const [generationPrompt, setGenerationPrompt] = useState(defaultGenerationPrompt);
  const [engineArticles, setEngineArticles] = useState<EngineArticle[]>([]);
  const [recommendations, setRecommendations] = useState<EngineRecommendation[]>([]);
  const [engineSettings, setEngineSettings] = useState<EngineSettings | null>(null);
  const [socialContents, setSocialContents] = useState<SocialContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [selected, setSelected] = useState<ArticleForm | null>(null);
  const [filter, setFilter] = useState("all");
  const [reviewStatusFilter, setReviewStatusFilter] = useState("active");
  const [reviewArticleFilter, setReviewArticleFilter] = useState("all");

  const automation = parseAutomationLevels(engineSettings?.automation_levels_json);
  const dailySeries = parseDailySeries(engineSettings?.schedule_json);
  const articleCounts = useMemo(() => ({
    draft: engineArticles.filter((article) => article.status === "draft" && !article.scheduled_at).length,
    scheduled: engineArticles.filter((article) => article.status === "scheduled" || (article.status === "draft" && !!article.scheduled_at)).length,
    approved: engineArticles.filter((article) => article.status === "approved").length,
    published: engineArticles.filter((article) => article.status === "published").length,
    failed: engineArticles.filter((article) => article.status === "quality_failed").length,
  }), [engineArticles]);

  const visibleArticles = useMemo(() => {
    if (filter === "all") return engineArticles;
    if (filter === "scheduled") return engineArticles.filter((article) => article.status === "scheduled" || (article.status === "draft" && !!article.scheduled_at));
    if (filter === "draft") return engineArticles.filter((article) => article.status === "draft" && !article.scheduled_at);
    if (filter === "failed") return engineArticles.filter((article) => article.status === "quality_failed");
    return engineArticles.filter((article) => article.status === filter);
  }, [engineArticles, filter]);
  const articleTitleById = useMemo(() => {
    return Object.fromEntries(engineArticles.map((article) => [article.id, article.title]));
  }, [engineArticles]);

  const reviewArticleOptions = useMemo(() => {
    const ids = Array.from(new Set(recommendations.map((item) => item.article_id).filter(Boolean))) as string[];
    return ids.map((id) => ({ id, title: articleTitleById[id] || id }));
  }, [articleTitleById, recommendations]);

  const visibleRecommendations = useMemo(() => {
    return recommendations.filter((item) => {
      const statusMatch = reviewStatusFilter === "all" || (reviewStatusFilter === "active" ? item.status !== "applied" && item.status !== "dismissed" : item.status === reviewStatusFilter);
      const articleMatch = reviewArticleFilter === "all" || item.article_id === reviewArticleFilter;
      return statusMatch && articleMatch;
    });
  }, [recommendations, reviewArticleFilter, reviewStatusFilter]);

  async function loadEngineDashboard() {
    const response = await fetch("/api/blog-engine/dashboard", { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    setEngineArticles(payload.articles || []);
    setRecommendations(payload.recommendations || []);
    setEngineSettings(payload.settings || null);
    setSocialContents(payload.socialContents || []);
  }

  useEffect(() => {
    void loadEngineDashboard();
  }, []);

  function refreshTopicSuggestion() {
    const suggestion = nextTopicSuggestion(engineTopic);
    setEngineTopic(suggestion.title);
    setEngineCategory(suggestion.category);
    setStatusMessage(`タイトル案を更新しました: ${suggestion.category}`);
  }

  async function generateEngineArticle() {
    if (isGenerating) return;
    setIsGenerating(true);
    setStatusMessage("記事を生成中です。完了すると下書きに追加されます。");
    try {
      const response = await fetch("/api/blog-engine/generate/", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          topic: engineTopic,
          category: engineCategory,
          primary_keyword: engineTopic,
          target_reader: "レイヴン・ブラックウッドで意思決定を整理したい読者",
          search_intent: "不安を煽らず、選択肢と次の一手を整理したい",
          custom_prompt: generationPrompt,
          status: "draft",
          idempotency_key: `manual:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      setStatusMessage(response.ok ? `下書きを作成しました: ${payload.id}` : payload.error || "記事生成に失敗しました。");
      await loadEngineDashboard();
      setFilter("draft");
      if (response.ok) {
        const suggestion = nextTopicSuggestion(engineTopic);
        setEngineTopic(suggestion.title);
        setEngineCategory(suggestion.category);
      }
    } catch {
      setStatusMessage("記事生成に失敗しました。通信状態を確認してください。");
    } finally {
      setIsGenerating(false);
    }
  }

  async function saveArticle(next = selected) {
    if (!next) return;
    const response = await fetch("/api/blog-engine/article/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: "raven-oracle", ...next }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatusMessage(response.ok ? "記事を保存しました。" : payload.error || "記事保存に失敗しました。");
    await loadEngineDashboard();
  }

  async function deleteArticle(article: EngineArticle) {
    if (!window.confirm(`この記事を削除しますか？\n${article.title}`)) return;
    const response = await fetch("/api/blog-engine/article/", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: "raven-oracle", id: article.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatusMessage(response.ok ? "記事を削除しました。" : payload.error || "記事削除に失敗しました。");
    if (selected?.id === article.id) setSelected(null);
    await loadEngineDashboard();
  }

  async function updateArticleStatus(article: EngineArticle, nextStatus: string) {
    await saveArticle({ ...toForm(article), status: nextStatus });
  }

  async function updateEngineSettings(next: { enabled?: boolean; articleGeneration?: boolean; autoPublish?: boolean; killSwitch?: boolean }) {
    const response = await fetch("/api/blog-engine/settings/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenant_id: "raven-oracle",
        enabled: next.enabled ?? !!engineSettings?.enabled,
        kill_switch: next.killSwitch ?? !!engineSettings?.kill_switch,
        article_generation: next.articleGeneration ?? !!automation.article_generation,
        auto_publish: next.autoPublish ?? !!automation.auto_publish,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatusMessage(response.ok ? "自動運用設定を更新しました。" : payload.error || "設定更新に失敗しました。");
    await loadEngineDashboard();
  }

  async function createReview() {
    if (isReviewing) return;
    setIsReviewing(true);
    setStatusMessage("改善レビューを作成中です。既存記事を確認して提案を追加します。");
    try {
      const response = await fetch("/api/blog-engine/review", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatusMessage(payload.error || "改善レビューに失敗しました。");
        return;
      }
      setStatusMessage(payload.message || `改善提案を ${payload.created || 0} 件作成しました。`);
      await loadEngineDashboard();
    } catch {
      setStatusMessage("改善レビューに失敗しました。通信状態を確認してください。");
    } finally {
      setIsReviewing(false);
    }
  }
  async function syncArticleSocial(article: EngineArticle) {
    const response = await fetch("/api/blog-engine/sns-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ article_id: article.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatusMessage(response.ok ? payload.message || `SNS派生 ${payload.created || 0} 件、SNS下書き ${payload.queued || 0} 件を作成しました。` : payload.error || "SNS派生コンテンツの作成に失敗しました。");
    await loadEngineDashboard();
  }

  async function updateRecommendationStatus(item: EngineRecommendation, nextStatus: string) {
    const response = await fetch("/api/blog-engine/review", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenant_id: "raven-oracle", id: item.id, status: nextStatus }),
    });
    const payload = await response.json().catch(() => ({}));
    setStatusMessage(response.ok ? payload.message || "改善提案の状態を更新しました。" : payload.error || "改善提案の更新に失敗しました。");
    await loadEngineDashboard();
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-7xl">
        <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">Raven Oracle Blog Engine v2.0</p>
          <h1 className="mt-2 text-4xl font-semibold">ブログエンジン管理</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">記事を作る、確認する、公開する、直す、止める。操作順が分かるように整理しています。</p>
        </header>

        <section className="sticky top-0 z-10 -mx-5 mt-5 border-y border-[#d7cabc] bg-[#f5f0e8]/95 px-5 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-sm font-semibold">
              <StatusPill label="下書き" value={articleCounts.draft} active={filter === "draft"} onClick={() => setFilter("draft")} />
              <StatusPill label="予約" value={articleCounts.scheduled} active={filter === "scheduled"} onClick={() => setFilter("scheduled")} />
              <StatusPill label="承認" value={articleCounts.approved} active={filter === "approved"} onClick={() => setFilter("approved")} />
              <StatusPill label="公開" value={articleCounts.published} active={filter === "published"} onClick={() => setFilter("published")} />
              <StatusPill label="停止" value={articleCounts.failed} active={filter === "failed"} onClick={() => setFilter("failed")} />
              <StatusPill label="全件" value={engineArticles.length} active={filter === "all"} onClick={() => setFilter("all")} />
            </div>
            <p className="text-sm font-semibold text-[#596d51]">{statusMessage}</p>
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid gap-5">
            <Panel eyebrow="Step 1" title="記事を作る">
              <div className="grid gap-3 md:grid-cols-[1fr_220px_auto]">
                <input className="admin-field" value={engineTopic} onChange={(event) => setEngineTopic(event.target.value)} aria-label="記事テーマ" placeholder="記事テーマ" />
                <select className="admin-field" value={engineCategory} onChange={(event) => setEngineCategory(event.target.value)}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
                <button className="rounded bg-[#222820] px-5 py-3 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={generateEngineArticle} disabled={isGenerating}>{isGenerating ? "生成中" : "下書きを生成"}</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded border border-[#d7cabc] bg-white p-3">
                <p className="text-sm font-semibold text-[#596d51]">タイトル案とカテゴリは、生成前に差し替えできます。</p>
                <button className="rounded border border-[#596d51] px-4 py-2 text-sm font-semibold text-[#596d51] disabled:opacity-60" type="button" onClick={refreshTopicSuggestion} disabled={isGenerating}>新しい案に更新</button>
              </div>
              <details className="mt-4 rounded border border-[#d7cabc] bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#596d51]">生成プロンプトを確認・編集</summary>
                <textarea className="admin-field mt-3 min-h-64 font-mono text-sm leading-6" value={generationPrompt} onChange={(event) => setGenerationPrompt(event.target.value)} />
                <button className="mt-3 rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => setGenerationPrompt(defaultGenerationPrompt)}>標準に戻す</button>
              </details>
            </Panel>

            <Panel eyebrow="Step 2" title="記事を管理する">
              <div className="grid gap-3">
                {visibleArticles.map((article) => <ArticleCard key={article.id} article={article} selected={selected?.id === article.id} onSelect={() => setSelected(toForm(article))} onStatus={(nextStatus) => updateArticleStatus(article, nextStatus)} onDelete={() => deleteArticle(article)} onSocialSync={() => syncArticleSocial(article)} socialCount={socialContents.filter((item) => item.source_article_id === article.id).length} />)}
                {!visibleArticles.length ? <p className="rounded border border-[#d7cabc] bg-white p-4 text-sm text-[#5e625c]">該当記事はありません。</p> : null}
              </div>
            </Panel>
          </div>

          <aside className="grid content-start gap-5">
            <Panel eyebrow="Automation" title="自動運用設定">
              <div className="grid gap-3">
                <Toggle label="エンジン" checked={!!engineSettings?.enabled} onChange={(checked) => updateEngineSettings({ enabled: checked })} />
                <Toggle label="記事自動生成" checked={!!automation.article_generation} onChange={(checked) => updateEngineSettings({ articleGeneration: checked })} />
                <Toggle label="自動公開" checked={!!automation.auto_publish} onChange={(checked) => updateEngineSettings({ autoPublish: checked })} />
                <Toggle label="緊急停止" checked={!!engineSettings?.kill_switch} onChange={(checked) => updateEngineSettings({ killSwitch: checked })} danger />
              </div>
              <p className="mt-3 rounded border border-[#d7cabc] bg-white p-3 text-sm font-semibold text-[#596d51]">モード: {engineSettings?.posting_mode || "読込中"}</p>
              <div className="mt-3 grid gap-2">
                {dailySeries.map((series) => (
                  <div key={series.id} className="rounded border border-[#d7cabc] bg-white p-3">
                    <p className="text-xs font-semibold uppercase text-[#6c5f3d]">{series.enabled ? "有効" : "停止"} / {series.id}</p>
                    <p className="mt-1 font-semibold">{series.publish_time} {series.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[#5e625c]">カテゴリ: {series.category} / 下書き {series.draft_time} / 公開 {series.publish_time}</p>
                  </div>
                ))}
                {!dailySeries.length ? <p className="rounded border border-[#d7cabc] bg-white p-3 text-sm text-[#5e625c]">スケジュール未設定です。</p> : null}
              </div>
            </Panel>

            <EditorPanel article={selected} onChange={setSelected} onSave={() => saveArticle()} onClose={() => setSelected(null)} />

            <RecommendationPanel
              recommendations={visibleRecommendations}
              allCount={recommendations.length}
              articleOptions={reviewArticleOptions}
              articleTitleById={articleTitleById}
              statusFilter={reviewStatusFilter}
              articleFilter={reviewArticleFilter}
              isReviewing={isReviewing}
              onCreate={createReview}
              onStatusFilter={setReviewStatusFilter}
              onArticleFilter={setReviewArticleFilter}
              onStatusChange={updateRecommendationStatus}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5"><p className="text-xs font-semibold uppercase text-[#6c5f3d]">{eyebrow}</p><h2 className="mt-1 text-2xl font-semibold">{title}</h2><div className="mt-4">{children}</div></section>;
}

function StatusPill({ label, value, active, onClick }: { label: string; value: number; active: boolean; onClick: () => void }) {
  return <button className={`rounded border px-3 py-2 ${active ? "border-[#222820] bg-[#222820] text-[#fff8ed]" : "border-[#d7cabc] bg-white text-[#20241f]"}`} type="button" onClick={onClick}>{label} {value}</button>;
}

function Toggle({ label, checked, onChange, danger = false }: { label: string; checked: boolean; onChange: (checked: boolean) => void; danger?: boolean }) {
  return <label className="flex items-center justify-between gap-3 rounded border border-[#d7cabc] bg-white p-4 text-sm font-semibold"><span>{label}</span><input className={danger ? "accent-red-700" : "accent-[#596d51]"} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function ArticleCard({ article, selected, onSelect, onStatus, onDelete, onSocialSync, socialCount }: { article: EngineArticle; selected: boolean; onSelect: () => void; onStatus: (status: string) => void; onDelete: () => void; onSocialSync: () => void; socialCount: number }) {
  const statusLabel = statusLabels[article.status] || article.status;
  return <article className={`rounded border bg-white p-4 ${selected ? "border-[#596d51] ring-2 ring-[#596d51]/20" : "border-[#d7cabc]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#6c5f3d]">{statusLabel} / {article.category}</p><h3 className="mt-1 text-lg font-semibold leading-6">{article.title}</h3><p className="mt-1 text-sm leading-6 text-[#5e625c]">{article.description}</p><p className="mt-2 text-xs text-[#5e625c]">作成 {article.created_at} / 公開予定 {article.scheduled_at || "未設定"} / 公開済み {article.published_at || "未公開"} / SNS派生 {socialCount}</p></div><div className="flex min-w-44 flex-wrap justify-end gap-2"><button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={onSelect}>編集</button><button className="rounded border border-red-300 px-3 py-2 text-sm font-semibold text-red-700" type="button" onClick={onDelete}>削除</button></div></div><div className="mt-3 flex flex-wrap gap-2"><button className="rounded border border-[#d7cabc] px-3 py-1 text-sm font-semibold" type="button" onClick={() => onStatus("draft")}>下書きへ</button><button className="rounded border border-[#d7cabc] px-3 py-1 text-sm font-semibold" type="button" onClick={() => onStatus("scheduled")}>予約へ</button><button className="rounded bg-[#222820] px-3 py-1 text-sm font-semibold text-[#fff8ed]" type="button" onClick={() => onStatus("published")}>公開する</button><button className="rounded bg-[#596d51] px-3 py-1 text-sm font-semibold text-[#fff8ed]" type="button" onClick={onSocialSync}>SNS下書き生成</button></div></article>;
}

function EditorPanel({ article, onChange, onSave, onClose }: { article: ArticleForm | null; onChange: (article: ArticleForm) => void; onSave: () => void; onClose: () => void }) {
  if (!article) return <Panel eyebrow="Edit" title="記事編集"><p className="text-sm leading-6 text-[#5e625c]">一覧から記事を選ぶと、ここでタイトル・説明文・本文を編集できます。</p></Panel>;
  return <Panel eyebrow="Edit" title="記事編集"><div className="grid gap-3"><Field label="タイトル" value={article.title} onChange={(title) => onChange({ ...article, title })} /><Field label="スラッグ" value={article.slug} onChange={(slug) => onChange({ ...article, slug })} /><Field label="カテゴリ" value={article.category} onChange={(category) => onChange({ ...article, category })} /><label className="grid gap-2 text-sm font-semibold">ステータス<select className="admin-field" value={article.status} onChange={(event) => onChange({ ...article, status: event.target.value })}><option value="draft">下書き</option><option value="scheduled">予約済み</option><option value="approved">承認済み</option><option value="published">公開済み</option><option value="quality_failed">品質停止</option></select></label><label className="grid gap-2 text-sm font-semibold">説明文<textarea className="admin-field min-h-24" value={article.description} onChange={(event) => onChange({ ...article, description: event.target.value })} /></label><label className="grid gap-2 text-sm font-semibold">本文<textarea className="admin-field min-h-72 font-mono text-sm leading-7" value={article.body} onChange={(event) => onChange({ ...article, body: event.target.value })} /></label><div className="flex gap-2"><button className="flex-1 rounded bg-[#222820] px-4 py-3 font-semibold text-[#fff8ed]" type="button" onClick={onSave}>保存</button><button className="rounded border border-[#d7cabc] px-4 py-3 font-semibold" type="button" onClick={onClose}>閉じる</button></div></div></Panel>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<input className="admin-field" value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}
function RecommendationPanel({ recommendations, allCount, articleOptions, articleTitleById, statusFilter, articleFilter, isReviewing, onCreate, onStatusFilter, onArticleFilter, onStatusChange }: { recommendations: EngineRecommendation[]; allCount: number; articleOptions: { id: string; title: string }[]; articleTitleById: Record<string, string>; statusFilter: string; articleFilter: string; isReviewing: boolean; onCreate: () => void; onStatusFilter: (value: string) => void; onArticleFilter: (value: string) => void; onStatusChange: (item: EngineRecommendation, status: string) => void }) {
  return (
    <Panel eyebrow="Review" title="改善提案">
      <button className="w-full rounded border border-[#d7cabc] bg-white px-4 py-2 font-semibold disabled:opacity-60" type="button" onClick={onCreate} disabled={isReviewing}>{isReviewing ? "レビュー中" : "改善レビュー作成"}</button>
      <div className="mt-3 grid gap-2 rounded border border-[#d7cabc] bg-white p-3">
        <label className="grid gap-1 text-xs font-semibold text-[#5e625c]">状態<select className="admin-field" value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}><option value="active">未対応</option><option value="applied">適用済み</option><option value="dismissed">見送り</option><option value="all">全件</option></select></label>
        <label className="grid gap-1 text-xs font-semibold text-[#5e625c]">記事別<select className="admin-field" value={articleFilter} onChange={(event) => onArticleFilter(event.target.value)}><option value="all">全記事</option>{articleOptions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <p className="text-xs font-semibold text-[#596d51]">表示 {recommendations.length} 件 / 全 {allCount} 件</p>
      </div>
      <div className="mt-3 grid max-h-[720px] gap-3 overflow-auto pr-1">
        {recommendations.map((item) => <RecommendationCard key={item.id} item={item} articleTitle={item.article_id ? articleTitleById[item.article_id] : undefined} onStatusChange={onStatusChange} />)}
        {!recommendations.length ? <p className="rounded border border-[#d7cabc] bg-white p-4 text-sm text-[#5e625c]">条件に合う改善提案はありません。</p> : null}
      </div>
    </Panel>
  );
}

function RecommendationCard({ item, articleTitle, onStatusChange }: { item: EngineRecommendation; articleTitle?: string; onStatusChange: (item: EngineRecommendation, status: string) => void }) {
  return (
    <article className="rounded border border-[#d7cabc] bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#6c5f3d]"><span>{item.risk_level}</span><span>/</span><span>{item.status}</span>{item.created_at ? <span>/ 作成 {item.created_at}</span> : null}{item.applied_at ? <span>/ 適用 {item.applied_at}</span> : null}</div>
      <h3 className="mt-2 font-semibold leading-6">{item.title}</h3>
      {articleTitle ? <p className="mt-1 text-xs font-semibold text-[#596d51]">対象記事: {articleTitle}</p> : null}
      <div className="mt-3 grid gap-3 text-sm leading-6 text-[#5e625c]">
        <p>{item.summary}</p>
        {item.reason ? <InfoBlock label="理由" value={item.reason} /> : null}
        {item.expected_effect ? <InfoBlock label="期待効果" value={item.expected_effect} /> : null}
        {item.rollback_plan ? <InfoBlock label="戻し方" value={item.rollback_plan} /> : null}
        {item.evidence_json ? <InfoBlock label="根拠データ" value={item.evidence_json} mono /> : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="rounded bg-[#222820] px-3 py-2 text-sm font-semibold text-[#fff8ed]" type="button" onClick={() => onStatusChange(item, "applied")}>適用済みにする</button>
        <button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => onStatusChange(item, "proposed")}>未対応に戻す</button>
        <button className="rounded border border-[#d7cabc] px-3 py-2 text-sm font-semibold" type="button" onClick={() => onStatusChange(item, "dismissed")}>見送り</button>
      </div>
    </article>
  );
}

function InfoBlock({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><p className="text-xs font-semibold text-[#20241f]">{label}</p><p className={mono ? "mt-1 whitespace-pre-wrap break-words font-mono text-xs" : "mt-1 whitespace-pre-wrap"}>{value}</p></div>;
}



