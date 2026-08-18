"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Slide = { heading: string; body: string };
type SnsPost = { id: string; title: string; status: string; platform: string; post_type: string; scheduled_at?: string; created_at?: string };
type SnsSettings = { automation_level?: number; emergency_stop_all?: number; schedule_json?: string };
type SnsPing = {
  instagram?: {
    access_token_configured?: boolean;
    account_id_configured?: boolean;
    token?: {
      configured?: boolean;
      expires_at?: string | null;
      renewal_target_at?: string | null;
      days_remaining?: number | null;
      level?: "unknown" | "ok" | "warning" | "critical" | "expired";
      message?: string;
    };
  };
};
type DeckOption = { id: string; name: string; status: string; sns_use_allowed: number };
type UploadedMedia = { assetId: string; url: string; fileName: string; sizeBytes: number; mimeType: string };
type SnsAction = "idle" | "loading" | "generating" | "saving" | "uploading" | "publishing" | "copying" | "downloading" | "deleting";
type ThreeChoiceCard = { slot: "A" | "B" | "C"; cardId: string; name: string; image: string; reading: string };
type ThreeChoicePayload = { theme: string; category: string; deckId: string; hook: string; character: string; cta: string; cards: ThreeChoiceCard[]; background: string; music: string; experimentId?: string; variantId?: string; timeline: Array<{ id: string; start: number; end: number; label: string }> };
type VideoJob = { id: string; status: string; theme: string; category?: string; output_url?: string; error_code?: string; error_message?: string; retry_count?: number; created_at?: string; completed_at?: string };
type GrowthLoopState = {
  topics: Array<{ topic_id: string; category: string; title: string; performance_score?: number }>;
  backgrounds: Array<{ background_id: string; category: string; file: string; performance_score?: number }>;
  bgm: Array<{ bgm_id: string; title: string; mood?: string; file: string; performance_score?: number }>;
  variants: Array<{ variant_id: string; experiment_id: string; variant_label: string; hook_text: string; status: string }>;
  metrics: Array<{ metric_id: string; variant_id?: string; video_job_id?: string; views?: number; completion_rate?: number; performance_score?: number; fetched_at?: string }>;
  winningPatterns: Array<{ pattern_id: string; character_id: string; topic_category: string; hook_style: string; confidence: number; performance_summary?: string }>;
};

const ideas = [
  "返信前の文章を整える3つの視点",
  "時間制チャットで相談を絞る流れ",
  "相手に伝わる文面にするための小さな確認",
];

export default function SnsAdminPage() {
  const [topic, setTopic] = useState(ideas[0]);
  const [goal, setGoal] = useState("テキスト鑑定への案内");
  const [tone, setTone] = useState("静かで知的");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("投稿前です。");
  const [posts, setPosts] = useState<SnsPost[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [settings, setSettings] = useState<SnsSettings | null>(null);
  const [snsPing, setSnsPing] = useState<SnsPing | null>(null);
  const [decks, setDecks] = useState<DeckOption[]>([]);
  const [cardDeckId, setCardDeckId] = useState("");
  const [cardCount, setCardCount] = useState(0);
  const [cardSelectionMode, setCardSelectionMode] = useState("random");
  const [cardTag, setCardTag] = useState("");
  const [cardExcludeRecentDays, setCardExcludeRecentDays] = useState(14);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] = useState<{ id: string; title?: string; created_at?: string; score?: number } | null>(null);
  const [activeAction, setActiveAction] = useState<SnsAction>("loading");
  const [threeChoiceTheme, setThreeChoiceTheme] = useState("近いうちに起こる嬉しいこと");
  const [threeChoiceCategory, setThreeChoiceCategory] = useState("near_future");
  const [threeChoiceDeckId, setThreeChoiceDeckId] = useState("");
  const [threeChoiceCta, setThreeChoiceCta] = useState("詳しい鑑定はプロフィールへ");
  const [threeChoiceBackground, setThreeChoiceBackground] = useState("media://raven/default-background");
  const [threeChoiceMusic, setThreeChoiceMusic] = useState("media://raven/default-bgm");
  const [threeChoiceHook, setThreeChoiceHook] = useState("");
  const [threeChoiceCharacter, setThreeChoiceCharacter] = useState("raven");
  const [threeChoiceExperimentId, setThreeChoiceExperimentId] = useState("");
  const [threeChoiceVariantId, setThreeChoiceVariantId] = useState("");
  const [hookCandidates, setHookCandidates] = useState<string[]>([]);
  const [ctaCandidates, setCtaCandidates] = useState<string[]>([]);
  const [threeChoicePreview, setThreeChoicePreview] = useState<ThreeChoicePayload | null>(null);
  const [videoJobs, setVideoJobs] = useState<VideoJob[]>([]);
  const [growthLoop, setGrowthLoop] = useState<GrowthLoopState>({ topics: [], backgrounds: [], bgm: [], variants: [], metrics: [], winningPatterns: [] });
  const postCounts = {
    draft: posts.filter((post) => post.status === "draft").length,
    scheduled: posts.filter((post) => post.status === "scheduled").length,
    published: posts.filter((post) => post.status === "published").length,
    failed: posts.filter((post) => post.status === "failed").length,
  };
  const activeSnsDecks = decks.filter((deck) => deck.status === "active" && deck.sns_use_allowed);

  async function loadPosts() {
    try {
      const response = await fetch("/api/sns/posts?tenantId=raven-oracle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "SNS投稿一覧の取得に失敗しました。");
        return;
      }
      setPosts(payload.posts || []);
      setSettings(payload.settings || null);
    } catch {
      setStatus("SNS投稿一覧の取得に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction((current) => (current === "loading" ? "idle" : current));
    }
  }

  async function loadSnsPing() {
    try {
      const response = await fetch("/api/admin/sns/ping", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setSnsPing(payload);
    } catch {}
  }

  async function loadDecks() {
    try {
      const response = await fetch("/api/card-library?resource=decks&tenantId=raven-oracle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setDecks(payload.decks || []);
    } catch {}
  }

  async function loadVideoJobs() {
    try {
      const response = await fetch("/api/sns/videos/three-choice/render", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) setVideoJobs(payload.jobs || []);
    } catch {}
  }

  async function loadGrowthLoop() {
    try {
      const response = await fetch("/api/sns/videos/growth-loop?tenantId=raven-oracle", { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) {
        setGrowthLoop({
          topics: payload.topics || [],
          backgrounds: payload.backgrounds || [],
          bgm: payload.bgm || [],
          variants: payload.variants || [],
          metrics: payload.metrics || [],
          winningPatterns: payload.winningPatterns || [],
        });
      }
    } catch {}
  }

  function suggestTheme() {
    const nextTopic = ideas[Math.floor(Math.random() * ideas.length)];
    setTopic(nextTopic);
    setStatus(`テーマを「${nextTopic}」に変更しました。必要なら生成を押してください。`);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/sns/posts?tenantId=raven-oracle", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { posts: [] }))
      .then((payload) => {
        if (active) {
          setPosts(payload.posts || []);
          setSettings(payload.settings || null);
        }
      })
      .catch(() => {
        if (active) {
          setPosts([]);
          setStatus("SNS投稿一覧の取得に失敗しました。");
        }
      })
      .finally(() => {
        if (active) setActiveAction("idle");
      });
    loadDecks();
    loadVideoJobs();
    loadGrowthLoop();
    loadSnsPing();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!threeChoiceDeckId) {
      const firstActive = decks.find((deck) => deck.status === "active" && deck.sns_use_allowed);
      if (firstActive) setThreeChoiceDeckId(firstActive.id);
    }
  }, [decks, threeChoiceDeckId]);

  async function generateThreeChoicePreview() {
    if (activeAction !== "idle") return;
    setActiveAction("generating");
    setStatus("3択動画のプレビューを生成しています。");
    try {
      const response = await fetch("/api/sns/videos/three-choice/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          theme: threeChoiceTheme,
          category: threeChoiceCategory,
          deck_id: threeChoiceDeckId,
          cta: threeChoiceCta,
          hook: threeChoiceHook,
          character: threeChoiceCharacter,
          experiment_id: threeChoiceExperimentId,
          variant_id: threeChoiceVariantId,
          background: threeChoiceBackground,
          music: threeChoiceMusic,
          selection_mode: "least_used",
          exclude_recent_days: 14,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "3択動画プレビューの生成に失敗しました。");
        return;
      }
      setThreeChoicePreview(payload.payload);
      setStatus("3択動画プレビューを生成しました。カードと短文を確認してください。");
    } catch {
      setStatus("3択動画プレビューの生成に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function generateHooksForThreeChoice() {
    if (activeAction !== "idle") return;
    setActiveAction("generating");
    setStatus("HOOK案とCTA案を生成しています。");
    try {
      const response = await fetch("/api/sns/videos/growth-loop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          action: "generate_hooks",
          theme: threeChoiceTheme,
          category: threeChoiceCategory,
          character: threeChoiceCharacter,
          experiment_id: threeChoiceExperimentId,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "HOOK案の生成に失敗しました。");
        return;
      }
      const hooks = (payload.hooks || []).map((item: { text: string }) => item.text).filter(Boolean);
      setHookCandidates(hooks);
      setCtaCandidates(payload.ctas || []);
      setThreeChoiceExperimentId(payload.experimentId || "");
      if (hooks[0]) setThreeChoiceHook(hooks[0]);
      if (payload.ctas?.[0]) setThreeChoiceCta(payload.ctas[0]);
      setStatus("HOOK案を生成しました。AB Variantを作る場合は候補を確認してください。");
      await loadGrowthLoop();
    } catch {
      setStatus("HOOK案の生成に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function createAbVariants() {
    if (activeAction !== "idle") return;
    const hooks = hookCandidates.length ? hookCandidates : [threeChoiceHook || threeChoiceTheme];
    setActiveAction("saving");
    setStatus("ABテストVariantを作成しています。");
    try {
      const response = await fetch("/api/sns/videos/growth-loop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          action: "create_ab_variants",
          experiment_id: threeChoiceExperimentId,
          theme: threeChoiceTheme,
          category: threeChoiceCategory,
          character: threeChoiceCharacter,
          hooks,
          cta: threeChoiceCta,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "AB Variant作成に失敗しました。");
        return;
      }
      setThreeChoiceExperimentId(payload.experimentId || "");
      setThreeChoiceVariantId(payload.variants?.[0]?.variant_id || "");
      setStatus(`AB Variantを作成しました: ${payload.variants?.length || 0}件`);
      await loadGrowthLoop();
    } catch {
      setStatus("AB Variant作成に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function renderThreeChoiceVideo() {
    if (activeAction !== "idle") return;
    if (!threeChoicePreview) {
      setStatus("先に3択動画プレビューを生成してください。");
      return;
    }
    setActiveAction("saving");
    setStatus("3択動画ジョブを登録しています。Renderer未接続時はfailedとして記録されます。");
    try {
      const response = await fetch("/api/sns/videos/three-choice/render", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: "raven-oracle", job_payload: threeChoicePreview }),
      });
      const payload = await response.json().catch(() => ({}));
      setStatus(response.ok ? `3択動画ジョブを登録しました: ${payload.jobId} / ${payload.status}` : payload.error || "3択動画ジョブ登録に失敗しました。");
      await loadVideoJobs();
    } catch {
      setStatus("3択動画ジョブ登録に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function retryVideoJob(jobId: string) {
    if (activeAction !== "idle") return;
    setActiveAction("saving");
    setStatus("3択動画ジョブを再試行しています。");
    try {
      const response = await fetch(`/api/sns/videos/jobs/${encodeURIComponent(jobId)}/retry`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setStatus(response.ok ? `再試行しました: ${payload.status}` : payload.error || "再試行に失敗しました。");
      await loadVideoJobs();
    } catch {
      setStatus("再試行に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function queueVideoToSns(jobId: string) {
    if (activeAction !== "idle") return;
    setActiveAction("saving");
    setStatus("完成動画をSNS下書きへ送っています。");
    try {
      const response = await fetch(`/api/sns/videos/${encodeURIComponent(jobId)}`, { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      setStatus(response.ok ? `SNS下書きを作成しました: ${payload.snsPostId}` : payload.error || "SNS下書き作成に失敗しました。");
      await Promise.all([loadPosts(), loadVideoJobs()]);
    } catch {
      setStatus("SNS下書き作成に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  function generateSlides() {
    setActiveAction("generating");
    const generated = [
      { heading: topic, body: "今の気持ちを責めずに、まず一文で整理します。" },
      { heading: "意図を見る", body: "何を伝えたいのか、相手に何を返してほしいのかを分けます。" },
      { heading: "圧を下げる", body: "正しさが強すぎる時は、要望と気持ちを別の文にします。" },
      { heading: "次の一手", body: "送る、待つ、保留する。行動を一つだけ選びます。" },
      { heading: "レイヴン・ブラックウッド", body: "テキスト鑑定と時間制チャットで、文面を落ち着いて整えます。" },
    ];
    setSlides(generated);
    setCaption(`${topic}\n\n${tone}なトーンで、送信前の迷いを短く整えるための投稿です。\n\n${goal}として、レイヴン・ブラックウッドのテキスト鑑定へ案内します。\n\n#レイヴンブラックウッド #文章鑑定 #相談整理 #返信前チェック`);
    setStatus("スライド案を生成しました。内容を確認してから投稿準備してください。");
    setActiveAction("idle");
  }

  function scheduleLabel() {
    try {
      const parsed = JSON.parse(settings?.schedule_json || "");
      if (Array.isArray(parsed?.windows)) return parsed.windows.map((window: { start: string; end: string }) => `${window.start}-${window.end}`).join(" / ");
    } catch {}
    return "01:00-07:00 / 13:00-17:00";
  }

  function tokenPanelClass(level?: string) {
    if (level === "expired" || level === "critical") return "border-red-300 bg-red-50 text-red-800";
    if (level === "warning" || level === "unknown") return "border-[#b98043] bg-[#fff6e8] text-[#7a451b]";
    return "border-[#b8cfb0] bg-[#f1f8ed] text-[#3d5f37]";
  }

  async function saveDraft(nextStatus = "draft", allowDuplicate = false) {
    if (activeAction !== "idle") return;
    setActiveAction("saving");
    setStatus(nextStatus === "scheduled" ? "予約投稿を保存しています。" : "下書きを保存しています。");
    const hasVideo = Boolean(uploadedMedia);
    const preparedSlides = slides.length ? slides : buildSlides(topic);
    const preparedCaption = caption.trim() || buildCaption(topic, tone, goal);
    if (!slides.length) setSlides(preparedSlides);
    if (!caption.trim()) setCaption(preparedCaption);
    try {
      const response = await fetch("/api/sns/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tenant_id: "raven-oracle",
          platform: "instagram",
          post_type: hasVideo ? "reel" : "carousel",
          title: topic,
          theme: topic,
          category: hasVideo ? "完成済み動画" : "文章鑑定",
          character: "レイヴン・ブラックウッド",
          purpose: goal,
          cta: "必要なら、レイヴン・ブラックウッドのテキスト鑑定で一緒に整理します。",
          caption: preparedCaption,
          script: preparedSlides.map((slide, index) => `${index + 1}. ${slide.heading}: ${slide.body}`).join("\n"),
          media_type: hasVideo ? "video" : "",
          media_url: uploadedMedia?.url || "",
          status: nextStatus,
          scheduled_at: scheduledAt,
          card_deck_id: cardDeckId,
          card_count: cardCount,
          card_selection_mode: cardSelectionMode,
          card_tag: cardTag,
          card_exclude_recent_days: cardExcludeRecentDays,
          allow_duplicate: allowDuplicate,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 409 && payload.duplicatePost) {
          setDuplicateCandidate(payload.duplicatePost);
        }
        setStatus(payload.error || "保存に失敗しました。");
        return;
      }
      setDuplicateCandidate(null);
      setStatus(nextStatus === "scheduled" ? "予約投稿として保存しました。" : "下書き保存しました。");
      await loadPosts();
    } catch {
      setStatus("保存に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function uploadCompletedVideo() {
    if (activeAction !== "idle") return;
    if (!videoFile) {
      setStatus("MP4ファイルを選択してください。");
      return;
    }
    if (videoFile.type !== "video/mp4") {
      setStatus("アップロードできるのはMP4のみです。");
      return;
    }
    const form = new FormData();
    form.append("file", videoFile);
    form.append("source", "uploaded");
    form.append("category", "sns-ready-video");
    form.append("mood", "ready");
    form.append("license_type", "owned");
    form.append("tags", "sns,ready,mp4,no-processing");
    setActiveAction("uploading");
    setStatus("MP4をR2へアップロードしています。");
    try {
      const response = await fetch("/api/reel-engine/assets", { method: "POST", body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setStatus(payload.error || "MP4アップロードに失敗しました。");
        return;
      }
      const url = `/api/reel-engine/assets?assetId=${encodeURIComponent(payload.assetId)}`;
      setUploadedMedia({ assetId: payload.assetId, url, fileName: videoFile.name, sizeBytes: payload.sizeBytes || videoFile.size, mimeType: payload.mimeType || videoFile.type });
      setStatus("MP4をアップロードしました。予約保存すると、この動画を無加工で投稿予約します。");
    } catch {
      setStatus("MP4アップロードに失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function clearUploadedVideo() {
    if (activeAction !== "idle") return;
    const media = uploadedMedia;
    setVideoFile(null);
    setUploadedMedia(null);
    if (!media) {
      setStatus("動画選択を解除しました。");
      return;
    }
    setActiveAction("deleting");
    setStatus("アップロード済みMP4を削除しています。");
    try {
      const response = await fetch("/api/reel-engine/assets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ asset_id: media.assetId }),
      });
      const payload = await response.json().catch(() => ({}));
      setStatus(response.ok ? "アップロード済みMP4を削除しました。" : payload.error || "MP4削除に失敗しました。");
    } catch {
      setStatus("MP4削除に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function publishPost(id: string) {
    if (activeAction !== "idle") return;
    setActiveAction("publishing");
    setStatus("投稿処理を実行しています。");
    try {
      const response = await fetch("/api/sns/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenant_id: "raven-oracle", id }),
      });
      const payload = await response.json().catch(() => ({}));
      const detail = payload.details?.error?.message ? ` Meta: ${payload.details.error.message}` : "";
      setStatus(payload.ok ? "公開処理を記録しました。" : `${payload.error || "公開処理に失敗しました。"}${detail}`);
      await loadPosts();
    } catch {
      setStatus("公開処理に失敗しました。通信状態を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  async function copyCaption() {
    if (activeAction !== "idle") return;
    const preparedCaption = caption.trim() || buildCaption(topic, tone, goal);
    if (!caption.trim()) setCaption(preparedCaption);
    setActiveAction("copying");
    try {
      await navigator.clipboard.writeText(preparedCaption);
      setStatus("キャプションをコピーしました。");
    } catch {
      setStatus("コピーできませんでした。ブラウザのクリップボード権限を確認してください。");
    } finally {
      setActiveAction("idle");
    }
  }

  function downloadSlide(index: number) {
    if (activeAction !== "idle") return;
    const slide = slides[index];
    if (!slide) {
      setStatus("先に生成を押してスライド案を作成してください。");
      return;
    }
    setActiveAction("downloading");
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const gradient = ctx.createLinearGradient(0, 0, 1080, 1920);
    gradient.addColorStop(0, "#f5f0e8");
    gradient.addColorStop(0.55, "#edf3e8");
    gradient.addColorStop(1, "#171d1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = "#20241f";
    ctx.font = "700 48px sans-serif";
    ctx.fillText("レイヴン・ブラックウッド", 90, 150);
    ctx.font = "700 78px sans-serif";
    wrap(ctx, slide.heading, 90, 430, 900, 96);
    ctx.font = "500 48px sans-serif";
    wrap(ctx, slide.body, 90, 760, 900, 72);
    ctx.fillStyle = "#fff8ed";
    ctx.font = "500 36px sans-serif";
    ctx.fillText(`${index + 1}/${slides.length}`, 90, 1760);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `raven-oracle-${String(index + 1).padStart(2, "0")}.png`;
    link.click();
    setStatus("PNGを書き出しました。");
    setActiveAction("idle");
  }

  return (
    <main className="min-h-screen bg-[#f5f0e8] px-5 py-8 text-[#20241f]">
      <div className="mx-auto max-w-6xl">
        <nav className="flex flex-wrap gap-3">
          <div className="flex flex-wrap gap-4">
            <Link className="text-sm font-semibold text-[#596d51]" href="/admin/">管理ダッシュボード</Link>
            <Link className="text-sm font-semibold text-[#596d51]" href="/admin/sns/templates">投稿テンプレート</Link>
          </div>
          <Link className="text-sm font-semibold text-[#596d51]" href="/admin/decks/">Deck Manager</Link>
        </nav>
        <header className="mt-5 border-b border-[#d7cabc] pb-6">
          <p className="text-sm font-semibold uppercase text-[#6c5f3d]">SNS Creator</p>
          <h1 className="mt-2 text-4xl font-semibold">SNSコンテンツ生成</h1>
          <p className="mt-3 max-w-3xl leading-7 text-[#5e625c]">Instagram向けスライド案、PNG、キャプション、Reels台本、予約、投稿履歴を管理します。Instagram API未設定時は公開を止め、失敗ログを保存します。</p>
        </header>
        <section className="mt-8 grid gap-3 md:grid-cols-4">
          <Metric label="下書き" value={postCounts.draft} />
          <Metric label="予約済み" value={postCounts.scheduled} />
          <Metric label="投稿済み" value={postCounts.published} />
          <Metric label="失敗" value={postCounts.failed} />
        </section>
        <section className="mt-4 rounded border border-[#d7cabc] bg-[#fffaf2] p-4 text-sm leading-7 text-[#5e625c]">
          <span className="font-semibold text-[#20241f]">自動投稿予約:</span> {settings?.automation_level ? "有効" : "無効"} / 投稿枠 {scheduleLabel()} / 緊急停止 {settings?.emergency_stop_all ? "ON" : "OFF"}
        </section>
        <section className={`mt-4 rounded border p-4 text-sm leading-7 ${tokenPanelClass(snsPing?.instagram?.token?.level)}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#20241f]">Instagramトークン期限</p>
              <p>{snsPing?.instagram?.token?.message || "Instagram接続状態を確認しています。"}</p>
              <p>
                期限: {snsPing?.instagram?.token?.expires_at || "未設定"} / 更新目安: {snsPing?.instagram?.token?.renewal_target_at || "未設定"}
                {typeof snsPing?.instagram?.token?.days_remaining === "number" ? ` / 残り${snsPing.instagram.token.days_remaining}日` : ""}
              </p>
              <p className="text-xs">投稿停止を避けるため、期限の7日前までに長期トークンを再取得し、INSTAGRAM_ACCESS_TOKENとINSTAGRAM_TOKEN_EXPIRES_ATを更新してください。</p>
            </div>
            <button className="rounded border border-current px-3 py-2 text-xs font-semibold disabled:opacity-60" type="button" onClick={loadSnsPing} disabled={activeAction !== "idle"}>再確認</button>
          </div>
        </section>
        <section className="mt-6 rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-[#6c5f3d]">20s Three Choice Video</p>
              <h2 className="mt-1 text-2xl font-semibold">20秒3択動画生成</h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-[#5e625c]">Deck Managerのカード3枚を使い、0-2秒HOOK、2-5秒選択、5-17秒A/B/C、17-20秒CTAの20秒縦型動画JSONを作成します。重いFFmpeg処理は外部Rendererへ渡します。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded border border-[#d7cabc] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={loadGrowthLoop} disabled={activeAction !== "idle"}>Growth更新</button>
              <button className="rounded border border-[#d7cabc] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={loadVideoJobs} disabled={activeAction !== "idle"}>ジョブ更新</button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold">キャラクター<select className="admin-field" value={threeChoiceCharacter} onChange={(event) => setThreeChoiceCharacter(event.target.value)}><option value="raven">Raven</option><option value="luna">Luna</option><option value="scarlet">Scarlet</option><option value="atlas">Atlas</option><option value="sol">Sol Aurora</option></select></label>
              <label className="grid gap-2 text-sm font-semibold">テーマ<input className="admin-field" value={threeChoiceTheme} onChange={(event) => setThreeChoiceTheme(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">カテゴリ<select className="admin-field" value={threeChoiceCategory} onChange={(event) => setThreeChoiceCategory(event.target.value)}><option value="love">恋愛</option><option value="relationship">相手の気持ち</option><option value="work">仕事</option><option value="money">金運</option><option value="near_future">近未来</option><option value="daily_message">今日のメッセージ</option><option value="yes_no">YES / NO</option></select></label>
              <label className="grid gap-2 text-sm font-semibold">使用デッキ<select className="admin-field" value={threeChoiceDeckId} onChange={(event) => setThreeChoiceDeckId(event.target.value)}><option value="">選択してください</option>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name} / {deck.status} / SNS {deck.sns_use_allowed ? "可" : "不可"}</option>)}</select></label>
              {!activeSnsDecks.length ? <p className="rounded border border-[#b98043] bg-[#fff6e8] p-3 text-xs leading-5 text-[#7a451b]">3択動画の選出には、Deck Managerで「active」かつ「SNS可」のデッキと、有効なSNS可カードが3枚以上必要です。</p> : null}
              <label className="grid gap-2 text-sm font-semibold">HOOK<input className="admin-field" value={threeChoiceHook} onChange={(event) => setThreeChoiceHook(event.target.value)} placeholder="未入力ならテーマから自動作成" /></label>
              <label className="grid gap-2 text-sm font-semibold">背景<input className="admin-field" value={threeChoiceBackground} onChange={(event) => setThreeChoiceBackground(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">BGM<input className="admin-field" value={threeChoiceMusic} onChange={(event) => setThreeChoiceMusic(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">CTA<input className="admin-field" value={threeChoiceCta} onChange={(event) => setThreeChoiceCta(event.target.value)} /></label>
              <label className="grid gap-2 text-sm font-semibold">Experiment ID<input className="admin-field" value={threeChoiceExperimentId} onChange={(event) => setThreeChoiceExperimentId(event.target.value)} placeholder="自動生成可" /></label>
              <label className="grid gap-2 text-sm font-semibold">Variant ID<select className="admin-field" value={threeChoiceVariantId} onChange={(event) => setThreeChoiceVariantId(event.target.value)}><option value="">未選択</option>{growthLoop.variants.map((variant) => <option key={variant.variant_id} value={variant.variant_id}>{variant.variant_label} / {variant.hook_text}</option>)}</select></label>
              <div className="flex flex-wrap gap-2">
                <button className="rounded border border-[#596d51] px-4 py-2 text-sm font-semibold text-[#596d51] disabled:opacity-60" type="button" onClick={generateHooksForThreeChoice} disabled={activeAction !== "idle"}>HOOK案</button>
                <button className="rounded border border-[#596d51] px-4 py-2 text-sm font-semibold text-[#596d51] disabled:opacity-60" type="button" onClick={createAbVariants} disabled={activeAction !== "idle"}>AB作成</button>
                <button className="rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={generateThreeChoicePreview} disabled={activeAction !== "idle"}>プレビュー生成</button>
                <button className="rounded bg-[#596d51] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={renderThreeChoiceVideo} disabled={activeAction !== "idle" || !threeChoicePreview}>動画生成</button>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <LibraryList title="テーマ候補" items={growthLoop.topics.slice(0, 6).map((item) => ({ id: item.topic_id, title: item.title, meta: `${item.category} / score ${item.performance_score || 0}` }))} onPick={(item) => { setThreeChoiceTheme(item.title); const found = growthLoop.topics.find((topic) => topic.topic_id === item.id); if (found) setThreeChoiceCategory(found.category); }} />
                <LibraryList title="背景" items={growthLoop.backgrounds.slice(0, 6).map((item) => ({ id: item.background_id, title: item.category, meta: item.file }))} onPick={(item) => setThreeChoiceBackground(growthLoop.backgrounds.find((background) => background.background_id === item.id)?.file || threeChoiceBackground)} />
                <LibraryList title="BGM" items={growthLoop.bgm.slice(0, 6).map((item) => ({ id: item.bgm_id, title: item.title, meta: `${item.mood || "-"} / ${item.file}` }))} onPick={(item) => setThreeChoiceMusic(growthLoop.bgm.find((bgm) => bgm.bgm_id === item.id)?.file || threeChoiceMusic)} />
              </div>
              {(hookCandidates.length || ctaCandidates.length) ? <div className="rounded border border-[#d7cabc] bg-white p-3">
                <p className="font-semibold text-[#20241f]">生成候補</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {hookCandidates.map((hook) => <button key={hook} className="rounded border border-[#d7cabc] p-2 text-left text-xs leading-5 hover:border-[#596d51]" type="button" onClick={() => setThreeChoiceHook(hook)}>{hook}</button>)}
                  {ctaCandidates.map((cta) => <button key={cta} className="rounded border border-[#d7cabc] p-2 text-left text-xs leading-5 hover:border-[#596d51]" type="button" onClick={() => setThreeChoiceCta(cta)}>{cta}</button>)}
                </div>
              </div> : null}
              <div className="grid gap-3 md:grid-cols-3">
                {threeChoicePreview?.cards.map((card) => <article key={card.slot} className="rounded border border-[#d7cabc] bg-white p-3"><p className="text-xs font-semibold text-[#6c5f3d]">{card.slot}</p>{card.image && (card.image.startsWith("http") || card.image.startsWith("/")) ? <img className="mt-2 aspect-[3/4] w-full rounded border border-[#d7cabc] object-cover" src={card.image} alt={`${card.name}のカード画像`} /> : null}<h3 className="mt-3 font-semibold">{card.name}</h3><p className="mt-2 text-sm leading-6 text-[#5e625c]">{card.reading}</p>{card.image ? <p className="mt-2 break-all text-xs text-[#5e625c]">{card.image}</p> : <p className="mt-2 text-xs text-[#b55]">画像未設定</p>}</article>)}
                {!threeChoicePreview ? <p className="rounded border border-dashed border-[#d7cabc] bg-white p-4 text-sm leading-7 text-[#5e625c] md:col-span-3">プレビュー生成後、A/B/Cのカードと4秒で読める短文がここに表示されます。</p> : null}
              </div>
              {threeChoicePreview ? <div className="rounded border border-[#d7cabc] bg-white p-3 text-xs leading-5 text-[#5e625c]"><p className="font-semibold text-[#20241f]">HOOK / CTA</p><p>{threeChoicePreview.hook}</p><p>{threeChoicePreview.cta}</p></div> : null}
              {threeChoicePreview ? <div className="rounded border border-[#d7cabc] bg-white p-3 text-xs leading-5 text-[#5e625c]"><p className="font-semibold text-[#20241f]">タイムライン</p>{threeChoicePreview.timeline.map((item) => <p key={item.id}>{item.start.toFixed(1)}-{item.end.toFixed(1)}秒: {item.label}</p>)}</div> : null}
              <div className="grid gap-3 md:grid-cols-2">
                <LibraryList title="AB Variant" items={growthLoop.variants.slice(0, 6).map((item) => ({ id: item.variant_id, title: `${item.variant_label}: ${item.hook_text}`, meta: `${item.status} / ${item.experiment_id}` }))} onPick={(item) => { const variant = growthLoop.variants.find((candidate) => candidate.variant_id === item.id); if (variant) { setThreeChoiceVariantId(variant.variant_id); setThreeChoiceExperimentId(variant.experiment_id); setThreeChoiceHook(variant.hook_text); } }} />
                <LibraryList title="勝ちパターン" items={growthLoop.winningPatterns.slice(0, 6).map((item) => ({ id: item.pattern_id, title: `${item.character_id} / ${item.topic_category}`, meta: `${item.hook_style} / confidence ${item.confidence}` }))} />
              </div>
              <div className="grid gap-3">
                {videoJobs.slice(0, 6).map((job) => <article key={job.id} className="rounded border border-[#d7cabc] bg-white p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#6c5f3d]">{job.status} / {job.category || "-"}</p><h3 className="mt-1 font-semibold">{job.theme}</h3><p className="mt-1 text-xs text-[#5e625c]">{job.created_at || "-"} / retry {job.retry_count || 0}</p>{job.error_message ? <p className="mt-2 text-xs text-red-700">{job.error_code}: {job.error_message}</p> : null}{job.output_url ? <p className="mt-2 break-all text-xs text-[#596d51]">{job.output_url}</p> : null}</div><div className="flex flex-wrap gap-2"><button className="rounded border border-[#d7cabc] px-3 py-2 text-xs font-semibold disabled:opacity-60" type="button" onClick={() => retryVideoJob(job.id)} disabled={activeAction !== "idle"}>Retry</button><button className="rounded border border-[#596d51] px-3 py-2 text-xs font-semibold text-[#596d51] disabled:opacity-60" type="button" onClick={() => queueVideoToSns(job.id)} disabled={activeAction !== "idle" || job.status !== "completed"}>SNSへ</button></div></div></article>)}
                {!videoJobs.length ? <p className="rounded border border-dashed border-[#d7cabc] bg-white p-4 text-sm leading-7 text-[#5e625c]">動画ジョブはまだありません。</p> : null}
              </div>
            </div>
          </div>
        </section>
        <section className="mt-8 grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
            <label className="grid gap-2 text-sm font-semibold">投稿テーマ<textarea className="admin-field min-h-24" value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">目的<select className="admin-field" value={goal} onChange={(event) => setGoal(event.target.value)}><option>テキスト鑑定への案内</option><option>時間制チャットへの案内</option><option>運用メモへの案内</option></select></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">トーン<select className="admin-field" value={tone} onChange={(event) => setTone(event.target.value)}><option>静かで知的</option><option>やさしく寄り添う</option><option>短く実用的</option></select></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold">予約日時<input className="admin-field" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
            <div className="mt-4 rounded border border-[#d7cabc] bg-white p-3">
              <p className="text-sm font-semibold text-[#6c5f3d]">Card Library 任意連携</p>
              <label className="mt-3 grid gap-2 text-sm font-semibold">使用デッキ<select className="admin-field" value={cardDeckId} onChange={(event) => setCardDeckId(event.target.value)}><option value="">使用しない</option>{decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name} / {deck.status} / SNS {deck.sns_use_allowed ? "可" : "不可"}</option>)}</select></label>
              <label className="mt-3 grid gap-2 text-sm font-semibold">使用枚数<select className="admin-field" value={cardCount} onChange={(event) => setCardCount(Number(event.target.value))}><option value={0}>0枚</option><option value={1}>今日の1枚</option><option value={3}>3枚引き / 3択</option></select></label>
              <label className="mt-3 grid gap-2 text-sm font-semibold">選出方式<select className="admin-field" value={cardSelectionMode} onChange={(event) => setCardSelectionMode(event.target.value)}><option value="random">完全ランダム</option><option value="least_used">未使用・低頻度優先</option></select></label>
              <label className="mt-3 grid gap-2 text-sm font-semibold">投稿テーマタグ<input className="admin-field" value={cardTag} onChange={(event) => setCardTag(event.target.value)} placeholder="daily, love など" /></label>
              <label className="mt-3 grid gap-2 text-sm font-semibold">直近使用除外日数<input className="admin-field" type="number" value={cardExcludeRecentDays} onChange={(event) => setCardExcludeRecentDays(Number(event.target.value))} /></label>
              <p className="mt-3 text-xs leading-5 text-[#5e625c]">有効化済み、SNS利用可のデッキ・カードだけをサーバー側で選出します。AIがカードを捏造しないよう、D1上のカードIDから本文へ追加します。</p>
            </div>
            <div className="mt-4 rounded border border-[#d7cabc] bg-white p-3">
              <label className="grid gap-2 text-sm font-semibold">完成済みMP4<input className="admin-field" type="file" accept="video/mp4" onChange={(event) => setVideoFile(event.target.files?.[0] || null)} /></label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={uploadCompletedVideo} disabled={activeAction !== "idle"}>{activeAction === "uploading" ? "アップロード中" : "MP4アップロード"}</button>
                {uploadedMedia ? <button className="rounded border border-[#d7cabc] px-4 py-2 text-sm font-semibold disabled:opacity-60" type="button" onClick={clearUploadedVideo} disabled={activeAction !== "idle"}>{activeAction === "deleting" ? "削除中" : "削除"}</button> : null}
              </div>
              {uploadedMedia ? <div className="mt-3 text-xs leading-5 text-[#5e625c]">
                <p className="font-semibold text-[#20241f]">{uploadedMedia.fileName}</p>
                <p>{uploadedMedia.mimeType} / {formatBytes(uploadedMedia.sizeBytes)}</p>
                <p className="break-all">{uploadedMedia.url}</p>
                <video className="mt-3 aspect-[9/16] max-h-72 rounded border border-[#d7cabc] bg-black" src={uploadedMedia.url} controls playsInline />
              </div> : <p className="mt-3 text-xs leading-5 text-[#5e625c]">アップロード済み動画がある場合、投稿種別はReel、動画URLはR2プレビューURLとして保存します。動画への加工は行いません。</p>}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="rounded border border-[#d7cabc] px-4 py-2 font-semibold disabled:opacity-60" type="button" onClick={suggestTheme} disabled={activeAction !== "idle"}>テーマ提案</button>
              <button className="rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={generateSlides} disabled={activeAction !== "idle"}>{activeAction === "generating" ? "生成中" : "生成"}</button>
              <button className="rounded bg-[#596d51] px-4 py-2 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={() => saveDraft("draft")} disabled={activeAction !== "idle"}>{activeAction === "saving" ? "保存中" : "下書き保存"}</button>
              <button className="rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={() => saveDraft("scheduled")} disabled={activeAction !== "idle"}>{activeAction === "saving" ? "保存中" : "予約保存"}</button>
            </div>
            <p className="mt-4 text-sm leading-7 text-[#5e625c]">Instagram API未設定時は公開処理を止め、失敗ログを保存します。</p>
            {duplicateCandidate ? <div className="mt-4 rounded border border-[#b98043] bg-[#fff6e8] p-3 text-sm leading-6">
              <p className="font-semibold text-[#7a451b]">重複候補があります</p>
              <p className="mt-1 text-[#5e625c]">{duplicateCandidate.title || duplicateCandidate.id}</p>
              <p className="text-[#5e625c]">類似度 {duplicateCandidate.score || 0}% / {duplicateCandidate.created_at || "作成日不明"}</p>
              <button className="mt-3 rounded border border-[#b98043] px-3 py-2 text-xs font-semibold text-[#7a451b] disabled:opacity-60" type="button" onClick={() => saveDraft("draft", true)} disabled={activeAction !== "idle"}>確認済みとして下書き保存</button>
            </div> : null}
          </aside>
          <div className="grid gap-6">
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">スライド</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {!slides.length ? <div className="rounded border border-dashed border-[#cbd4c4] bg-white p-5 text-sm leading-7 text-[#5e625c]">まだスライド案はありません。左側の「生成」を押すと、5枚構成のSNSスライド案とキャプションを作成します。</div> : null}
                {slides.map((slide, index) => (
                  <article key={`${slide.heading}-${index}`} className="rounded border border-[#d7cabc] bg-white p-4">
                    <div className="aspect-[9/16] rounded border border-[#cbd4c4] bg-[#edf3e8] p-5">
                      <p className="text-xs font-semibold uppercase text-[#596d51]">レイヴン・ブラックウッド</p>
                      <h3 className="mt-8 text-2xl font-semibold">{slide.heading}</h3>
                      <p className="mt-5 leading-7 text-[#3f4b3d]">{slide.body}</p>
                      <p className="mt-8 text-sm text-[#596d51]">{index + 1}/{slides.length}</p>
                    </div>
                    <button className="mt-3 rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={() => downloadSlide(index)} disabled={activeAction !== "idle"}>{activeAction === "downloading" ? "書き出し中" : "PNG"}</button>
                  </article>
                ))}
              </div>
            </section>
            <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
              <h2 className="text-2xl font-semibold">キャプション</h2>
              <textarea className="admin-field mt-4 min-h-44 leading-7" value={caption} onChange={(event) => setCaption(event.target.value)} />
              <button className="mt-3 rounded bg-[#222820] px-4 py-2 font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={copyCaption} disabled={activeAction !== "idle"}>{activeAction === "copying" ? "コピー中" : "コピー"}</button>
              <p className="mt-3 text-sm text-[#5e625c]">{status}</p>
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <PostList title="下書き" posts={posts.filter((post) => post.status === "draft")} onPublish={publishPost} disabled={activeAction !== "idle"} />
              <PostList title="予約済み" posts={posts.filter((post) => post.status === "scheduled")} onPublish={publishPost} disabled={activeAction !== "idle"} />
              <PostList title="投稿済み" posts={posts.filter((post) => post.status === "published")} onPublish={publishPost} disabled={activeAction !== "idle"} />
              <PostList title="失敗・要確認" posts={posts.filter((post) => post.status === "failed")} onPublish={publishPost} disabled={activeAction !== "idle"} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  let line = "";
  for (const char of text) {
    const next = line + char;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function buildSlides(topic: string) {
  return [
    { heading: topic, body: "今の気持ちを責めずに、まず一文で整理します。" },
    { heading: "意図を見る", body: "何を伝えたいのか、相手に何を返してほしいのかを分けます。" },
    { heading: "圧を下げる", body: "正しさが強すぎる時は、要望と気持ちを別の文にします。" },
    { heading: "次の一手", body: "送る、待つ、保留する。行動を一つだけ選びます。" },
    { heading: "レイヴン・ブラックウッド", body: "テキスト鑑定と時間制チャットで、文面を落ち着いて整えます。" },
  ];
}

function buildCaption(topic: string, tone: string, goal: string) {
  return `${topic}\n\n${tone}なトーンで、送信前の迷いを短く整えるための投稿です。\n\n${goal}として、レイヴン・ブラックウッドのテキスト鑑定へ案内します。\n\n#レイヴンブラックウッド #文章鑑定 #相談整理 #返信前チェック`;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded border border-[#d7cabc] bg-[#fffaf2] p-4"><p className="text-sm font-semibold text-[#6c5f3d]">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>;
}

function LibraryList({ title, items, onPick }: { title: string; items: Array<{ id: string; title: string; meta?: string }>; onPick?: (item: { id: string; title: string; meta?: string }) => void }) {
  return (
    <article className="rounded border border-[#d7cabc] bg-white p-3">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 grid gap-2">
        {items.map((item) => (
          <button key={item.id} className="rounded border border-[#d7cabc] p-2 text-left text-xs leading-5 disabled:cursor-default disabled:opacity-80" type="button" onClick={() => onPick?.(item)} disabled={!onPick}>
            <span className="block font-semibold text-[#20241f]">{item.title}</span>
            {item.meta ? <span className="mt-1 block break-all text-[#5e625c]">{item.meta}</span> : null}
          </button>
        ))}
        {!items.length ? <p className="text-xs leading-5 text-[#5e625c]">まだデータがありません。</p> : null}
      </div>
    </article>
  );
}

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index ? 1 : 0)} ${units[index]}`;
}

function PostList({ title, posts, onPublish, disabled }: { title: string; posts: SnsPost[]; onPublish: (id: string) => Promise<void>; disabled: boolean }) {
  return (
    <section className="rounded border border-[#d7cabc] bg-[#fffaf2] p-5">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4 grid gap-3">
        {posts.map((post) => (
          <article key={post.id} className="rounded border border-[#d7cabc] bg-white p-4">
            <p className="text-sm font-semibold text-[#596d51]">{post.platform} / {post.post_type} / {post.status}</p>
            <h3 className="mt-1 font-semibold leading-6">{post.title}</h3>
            <p className="mt-1 text-xs text-[#5e625c]">{post.scheduled_at || post.created_at || "日時未設定"}</p>
            {post.status !== "published" ? <button className="mt-3 rounded bg-[#222820] px-4 py-2 text-sm font-semibold text-[#fff8ed] disabled:opacity-60" type="button" onClick={() => onPublish(post.id)} disabled={disabled}>今すぐ投稿</button> : null}
          </article>
        ))}
        {!posts.length ? <p className="text-sm text-[#5e625c]">該当投稿はありません。</p> : null}
      </div>
    </section>
  );
}

