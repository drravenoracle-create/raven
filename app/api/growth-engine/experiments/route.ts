import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import {
  approveExperiment,
  createExperiment,
  createExperimentFromRecommendation,
  experimentSummary,
  listExperimentDetail,
  listExperiments,
  recordExperimentResult,
  rejectExperiment,
  transitionExperiment,
  updateExperiment,
} from "@/app/lib/growth-experiment-manager";

function clean(value: unknown, maxLength = 240) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function tenant(value: unknown) {
  const tenantId = clean(value, 80) || GROWTH_ENGINE_TENANT_ID;
  if (tenantId !== GROWTH_ENGINE_TENANT_ID) throw new Error("Invalid tenant_id.");
  return tenantId;
}

async function requireApiAdmin() {
  const session = await getAdminSession();
  if (!session || session.email.toLowerCase() !== adminEmail().toLowerCase()) {
    return { denied: Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }), actor: "" };
  }
  return { denied: null, actor: session.email };
}

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.denied) return auth.denied;

  const url = new URL(request.url);
  let tenantId = GROWTH_ENGINE_TENANT_ID;
  try {
    tenantId = tenant(url.searchParams.get("tenantId") ?? url.searchParams.get("tenant_id"));
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }
  const id = clean(url.searchParams.get("id") ?? url.searchParams.get("experiment_id") ?? url.searchParams.get("experiment_code"), 120);
  try {
    if (id) return Response.json({ ok: true, detail: await listExperimentDetail(env.DB, id, tenantId) }, { headers: { "Cache-Control": "no-store" } });
    const [experiments, summary, recommendations] = await Promise.all([
      listExperiments(env.DB, {
        status: url.searchParams.get("status"),
        character_id: url.searchParams.get("character_id") ?? url.searchParams.get("characterId"),
        result_status: url.searchParams.get("result_status") ?? url.searchParams.get("resultStatus"),
        q: url.searchParams.get("q"),
        limit: url.searchParams.get("limit") || 50,
        offset: url.searchParams.get("offset") || 0,
      }, tenantId),
      experimentSummary(env.DB, tenantId),
      env.DB.prepare(
        `SELECT i.id, i.insight_type, i.topic, i.summary, i.recommended_action, i.confidence, i.risk_level, i.status,
          e.experiment_id, e.experiment_code
         FROM growth_content_insights i
         LEFT JOIN growth_experiments e ON e.tenant_id = i.tenant_id AND e.growth_recommendation_id = i.id
         WHERE i.tenant_id = ? AND i.status IN ('proposed','allowed','queued')
         ORDER BY datetime(i.created_at) DESC LIMIT 30`,
      ).bind(tenantId).all(),
    ]);
    return Response.json({ ok: true, experiments, summary, recommendations: recommendations.results || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Experiment API failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.denied) return auth.denied;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

  let tenantId = GROWTH_ENGINE_TENANT_ID;
  try {
    tenantId = tenant(body.tenant_id ?? body.tenantId);
  } catch {
    return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  }

  const action = clean(body.action, 80);
  const id = clean(body.id ?? body.experiment_id ?? body.experimentId ?? body.experiment_code ?? body.experimentCode, 120);
  const actorBody = { ...body, actor: clean(body.actor, 120) || auth.actor };

  try {
    if (action === "create") return Response.json({ ok: true, experiment: await createExperiment(env.DB, actorBody, tenantId) }, { status: 201 });
    if (action === "createFromRecommendation") {
      const recommendationId = clean(body.recommendation_id ?? body.recommendationId ?? body.growth_recommendation_id ?? body.growthRecommendationId, 120);
      if (!recommendationId) throw new Error("recommendation_id is required.");
      return Response.json({ ok: true, experiment: await createExperimentFromRecommendation(env.DB, recommendationId, actorBody, tenantId) }, { status: 201 });
    }
    if (!id) throw new Error("experiment id/code is required.");
    if (action === "update") return Response.json({ ok: true, experiment: await updateExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "approve") return Response.json({ ok: true, experiment: await approveExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "reject") return Response.json({ ok: true, experiment: await rejectExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "start") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "RUNNING", actorBody, tenantId) });
    if (action === "pause") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "PAUSED", actorBody, tenantId) });
    if (action === "resume") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "RUNNING", actorBody, tenantId) });
    if (action === "measure") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "MEASURING", actorBody, tenantId) });
    if (action === "complete") {
      const recorded = await recordExperimentResult(env.DB, id, actorBody, tenantId);
      return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, String(recorded?.experiment_id || id), "COMPLETED", actorBody, tenantId) });
    }
    if (action === "recordResult") return Response.json({ ok: true, experiment: await recordExperimentResult(env.DB, id, actorBody, tenantId) });
    if (action === "archive") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "ARCHIVED", actorBody, tenantId) });
    if (action === "cancel") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "CANCELLED", actorBody, tenantId) });
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Experiment action failed." }, { status: 400 });
  }
}
