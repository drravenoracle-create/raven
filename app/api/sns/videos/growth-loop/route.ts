import { env } from "cloudflare:workers";
import {
  THREE_CHOICE_TENANT_ID,
  characterTone,
  cleanVideoText,
  generateCtaCandidates,
  generateHookCandidates,
} from "@/app/lib/three-choice-video";

type MetricBody = {
  video_job_id?: string;
  videoJobId?: string;
  variant_id?: string;
  variantId?: string;
  platform?: string;
  impressions?: number;
  views?: number;
  three_second_views?: number;
  threeSecondViews?: number;
  watch_time?: number;
  watchTime?: number;
  average_watch_time?: number;
  averageWatchTime?: number;
  completion_rate?: number;
  completionRate?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  profile_visits?: number;
  profileVisits?: number;
  link_clicks?: number;
  linkClicks?: number;
  follows?: number;
  conversion?: number;
  revenue?: number;
};

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || THREE_CHOICE_TENANT_ID;
  if (tenantId !== THREE_CHOICE_TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

function numberOrNull(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function scoreMetrics(body: MetricBody) {
  const views = Math.max(Number(body.views ?? 0), 0);
  const impressions = Math.max(Number(body.impressions ?? 0), 0);
  const saves = Math.max(Number(body.saves ?? 0), 0);
  const shares = Math.max(Number(body.shares ?? 0), 0);
  const comments = Math.max(Number(body.comments ?? 0), 0);
  const profileVisits = Math.max(Number(body.profile_visits ?? body.profileVisits ?? 0), 0);
  const linkClicks = Math.max(Number(body.link_clicks ?? body.linkClicks ?? 0), 0);
  const conversion = Math.max(Number(body.conversion ?? 0), 0);
  const revenue = Math.max(Number(body.revenue ?? 0), 0);
  const completionRate = Math.max(Math.min(Number(body.completion_rate ?? body.completionRate ?? 0), 1), 0);
  const reachBase = Math.max(views || impressions || 1, 1);
  const viralScore = completionRate * 45 + (saves / reachBase) * 20 + (shares / reachBase) * 20 + (comments / reachBase) * 15;
  const conversionScore = (profileVisits / reachBase) * 25 + (linkClicks / reachBase) * 35 + (conversion / reachBase) * 60 + Math.min(revenue / 10000, 1) * 20;
  return {
    viralScore: Math.round(viralScore * 100) / 100,
    conversionScore: Math.round(conversionScore * 100) / 100,
    performanceScore: Math.round((viralScore * 0.45 + conversionScore * 0.55) * 100) / 100,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    assertTenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id"));
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id" }, { status: 400 });
  }

  const [settings, topics, backgrounds, bgm, templates, variants, metrics, patterns] = await Promise.all([
    env.DB.prepare("SELECT * FROM sns_video_settings WHERE tenant_id = ? LIMIT 1").bind(THREE_CHOICE_TENANT_ID).first(),
    env.DB.prepare("SELECT * FROM sns_video_topics WHERE tenant_id = ? AND enabled = 1 ORDER BY performance_score DESC, title LIMIT 50").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_video_backgrounds WHERE tenant_id IN ('GLOBAL', ?) AND enabled = 1 ORDER BY performance_score DESC, category, background_id LIMIT 50").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_video_bgm WHERE tenant_id IN ('GLOBAL', ?) AND enabled = 1 ORDER BY performance_score DESC, mood, bgm_id LIMIT 50").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_video_templates WHERE tenant_id IN ('GLOBAL', ?) AND enabled = 1 ORDER BY template_id LIMIT 20").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_video_variants WHERE tenant_id = ? ORDER BY datetime(created_at) DESC LIMIT 30").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_video_performance_metrics WHERE tenant_id = ? ORDER BY datetime(fetched_at) DESC LIMIT 30").bind(THREE_CHOICE_TENANT_ID).all(),
    env.DB.prepare("SELECT * FROM sns_winning_patterns WHERE tenant_id = ? AND status = 'active' ORDER BY confidence DESC, datetime(updated_at) DESC LIMIT 20").bind(THREE_CHOICE_TENANT_ID).all(),
  ]);

  return Response.json({
    ok: true,
    settings,
    topics: topics.results || [],
    backgrounds: backgrounds.results || [],
    bgm: bgm.results || [],
    templates: templates.results || [],
    variants: variants.results || [],
    metrics: metrics.results || [],
    winningPatterns: patterns.results || [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  try {
    assertTenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id" }, { status: 400 });
  }

  const action = clean(body.action, 80);
  if (action === "generate_hooks") {
    const topicId = clean(body.topic_id ?? body.topicId, 120) || crypto.randomUUID();
    const theme = cleanVideoText(body.theme, 180) || "今日あなたに必要な言葉";
    const category = cleanVideoText(body.category, 80) || "daily_message";
    const experimentId = clean(body.experiment_id ?? body.experimentId, 120) || `exp-${crypto.randomUUID()}`;
    const hooks = generateHookCandidates(theme, category);
    await env.DB.prepare(
      `INSERT OR IGNORE INTO sns_video_topics (topic_id, tenant_id, category, title, prompt_hint)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(topicId, THREE_CHOICE_TENANT_ID, category, theme, `tone:${characterTone(clean(body.character, 80) || "raven")}`).run();
    const rows = [];
    for (const [index, text] of hooks.entries()) {
      const hookId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT INTO sns_video_hooks (hook_id, tenant_id, topic_id, text, hook_style, generation_model, experiment_id) VALUES (?, ?, ?, ?, ?, 'local-template', ?)",
      ).bind(hookId, THREE_CHOICE_TENANT_ID, topicId, text, index === 0 ? "direct" : index === 1 ? "secret" : "choice", experimentId).run();
      rows.push({ hook_id: hookId, topic_id: topicId, text, experiment_id: experimentId });
    }
    return Response.json({ ok: true, topicId, experimentId, hooks: rows, ctas: generateCtaCandidates(category) }, { headers: { "Cache-Control": "no-store" } });
  }

  if (action === "create_ab_variants") {
    const experimentId = clean(body.experiment_id ?? body.experimentId, 120) || `exp-${crypto.randomUUID()}`;
    const topicId = clean(body.topic_id ?? body.topicId, 120);
    const hooks = Array.isArray(body.hooks) ? body.hooks.slice(0, 3) : generateHookCandidates(clean(body.theme, 180), clean(body.category, 80));
    const cta = cleanVideoText(body.cta, 160) || generateCtaCandidates(clean(body.category, 80))[0];
    const rows = [];
    for (const [index, hook] of hooks.entries()) {
      const variantId = crypto.randomUUID();
      const label = ["A", "B", "C"][index] || String(index + 1);
      await env.DB.prepare(
        `INSERT INTO sns_video_variants
          (variant_id, tenant_id, experiment_id, topic_id, hook_text, cta, background_id, bgm_id, character_id, variant_label, condition_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        variantId,
        THREE_CHOICE_TENANT_ID,
        experimentId,
        topicId,
        cleanVideoText(typeof hook === "string" ? hook : (hook as { text?: string })?.text, 80),
        cta,
        clean(body.background_id ?? body.backgroundId, 120),
        clean(body.bgm_id ?? body.bgmId, 120),
        clean(body.character, 80) || "raven",
        label,
        JSON.stringify({ fixed_conditions: ["topic", "deck", "template"], test_target: "hook" }),
      ).run();
      rows.push({ variant_id: variantId, experiment_id: experimentId, variant_label: label });
    }
    return Response.json({ ok: true, experimentId, variants: rows }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  if (action === "record_metrics") {
    const metric = body as MetricBody;
    const scores = scoreMetrics(metric);
    const metricId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO sns_video_performance_metrics
        (metric_id, tenant_id, video_job_id, variant_id, platform, impressions, views, three_second_views, watch_time, average_watch_time, completion_rate, likes, comments, shares, saves, profile_visits, link_clicks, follows, conversion, revenue, viral_score, conversion_score, performance_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      metricId,
      THREE_CHOICE_TENANT_ID,
      clean(metric.video_job_id ?? metric.videoJobId, 120),
      clean(metric.variant_id ?? metric.variantId, 120),
      clean(metric.platform, 40) || "instagram",
      numberOrNull(metric.impressions),
      numberOrNull(metric.views),
      numberOrNull(metric.three_second_views ?? metric.threeSecondViews),
      numberOrNull(metric.watch_time ?? metric.watchTime),
      numberOrNull(metric.average_watch_time ?? metric.averageWatchTime),
      numberOrNull(metric.completion_rate ?? metric.completionRate),
      numberOrNull(metric.likes),
      numberOrNull(metric.comments),
      numberOrNull(metric.shares),
      numberOrNull(metric.saves),
      numberOrNull(metric.profile_visits ?? metric.profileVisits),
      numberOrNull(metric.link_clicks ?? metric.linkClicks),
      numberOrNull(metric.follows),
      numberOrNull(metric.conversion),
      numberOrNull(metric.revenue),
      scores.viralScore,
      scores.conversionScore,
      scores.performanceScore,
    ).run();
    await env.DB.prepare("INSERT OR IGNORE INTO growth_events (event_id, tenant_id, event_type, source_engine, entity_refs_json, payload_json, idempotency_key) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), THREE_CHOICE_TENANT_ID, "sns_video.metrics_recorded", "sns_growth_loop", JSON.stringify({ video_job_id: metric.video_job_id ?? metric.videoJobId, variant_id: metric.variant_id ?? metric.variantId }), JSON.stringify(scores), `sns-video-metric:${metricId}`)
      .run();
    return Response.json({ ok: true, metricId, ...scores }, { status: 201, headers: { "Cache-Control": "no-store" } });
  }

  return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
}
