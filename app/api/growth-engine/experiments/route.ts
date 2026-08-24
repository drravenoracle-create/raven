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
  rejectExperiment,
  transitionExperiment,
  updateExperiment,
} from "@/app/lib/growth-experiment-manager";
import { runExperimentPreflight } from "@/app/lib/growth-experiment-preflight";
import { listExperimentMeasurements, recordExperimentMeasurement } from "@/app/lib/growth-experiment-measurement";
import { confirmExperimentResult, evaluateExperimentResult, listResultEvaluations, rejectExperimentResult } from "@/app/lib/growth-experiment-result";
import { approveRollbackPlan, createRollbackPlan, getRollbackRecommendation, listExperimentFeedback, listRollbackPlans, registerExperimentFeedback, rejectRollbackPlan } from "@/app/lib/growth-experiment-feedback";
import {
  assignExperimentSubject,
  createExperimentVariant,
  listExperimentRuns,
  listExperimentVariants,
  startExperimentRun,
  stopExperimentRun,
  updateExperimentVariant,
} from "@/app/lib/growth-experiment-execution";

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
    if (id) {
      const detail = await listExperimentDetail(env.DB, id, tenantId);
      const experimentId = String(detail.experiment.experiment_id);
      const [variants, runs, measurements, evaluations, rollbackPlans, feedback] = await Promise.all([
        listExperimentVariants(env.DB, experimentId, tenantId),
        listExperimentRuns(env.DB, experimentId, tenantId),
        listExperimentMeasurements(env.DB, experimentId, tenantId),
        listResultEvaluations(env.DB, experimentId, tenantId),
        listRollbackPlans(env.DB, experimentId, tenantId),
        listExperimentFeedback(env.DB, experimentId, tenantId),
      ]);
      const confirmed = (evaluations as Array<Record<string, unknown>>).find((item) => item.status === "CONFIRMED");
      const rollbackRecommendation = confirmed ? await getRollbackRecommendation(env.DB, String(confirmed.evaluation_id), {}, tenantId) : null;
      return Response.json({ ok: true, detail: { ...detail, variants, runs, measurements: measurements.measurements, measurementGuardrails: measurements.guardrails, resultEvaluations: evaluations, rollbackPlans, feedback, rollbackRecommendation } }, { headers: { "Cache-Control": "no-store" } });
    }
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
    if (action === "createVariant") return Response.json({ ok: true, variant: await createExperimentVariant(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "updateVariant") {
      const variantId = clean(body.variant_id ?? body.variantId, 120);
      if (!variantId) throw new Error("variant_id is required.");
      return Response.json({ ok: true, variant: await updateExperimentVariant(env.DB, id, variantId, actorBody, tenantId) });
    }
    if (action === "run") return Response.json({ ok: true, run: await startExperimentRun(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "stop") {
      const runId = clean(body.run_id ?? body.runId, 120);
      if (!runId) throw new Error("run_id is required.");
      return Response.json({ ok: true, run: await stopExperimentRun(env.DB, id, runId, actorBody, tenantId) });
    }
    if (action === "assign") return Response.json({ ok: true, assignment: await assignExperimentSubject(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "measure") return Response.json({ ok: true, ...await recordExperimentMeasurement(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "evaluateResult") return Response.json({ ok: true, evaluation: await evaluateExperimentResult(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "confirmResult") {
      const evaluationId = clean(body.evaluation_id ?? body.evaluationId, 120); if (!evaluationId) throw new Error("evaluation_id is required.");
      return Response.json({ ok: true, evaluation: await confirmExperimentResult(env.DB, evaluationId, actorBody, tenantId) });
    }
    if (action === "rejectResult") {
      const evaluationId = clean(body.evaluation_id ?? body.evaluationId, 120); if (!evaluationId) throw new Error("evaluation_id is required.");
      return Response.json({ ok: true, evaluation: await rejectExperimentResult(env.DB, evaluationId, actorBody, tenantId) });
    }
    if (action === "rollbackRecommendation") return Response.json({ ok: true, recommendation: await getRollbackRecommendation(env.DB, clean(body.evaluation_id ?? body.evaluationId, 120), actorBody, tenantId) });
    if (action === "createRollbackPlan") return Response.json({ ok: true, plan: await createRollbackPlan(env.DB, id, actorBody, tenantId) }, { status: 201 });
    if (action === "approveRollbackPlan") return Response.json({ ok: true, plan: await approveRollbackPlan(env.DB, clean(body.rollback_plan_id ?? body.rollbackPlanId, 120), actorBody, tenantId) });
    if (action === "rejectRollbackPlan") return Response.json({ ok: true, plan: await rejectRollbackPlan(env.DB, clean(body.rollback_plan_id ?? body.rollbackPlanId, 120), actorBody, tenantId) });
    if (action === "feedback") return Response.json({ ok: true, feedback: await registerExperimentFeedback(env.DB, clean(body.evaluation_id ?? body.evaluationId, 120), actorBody, tenantId) }, { status: 201 });
    if (action === "preflight") {
      return Response.json({ ok: true, preflight: await runExperimentPreflight(env.DB, id, {
        tenantId,
        ...(body.guildId !== undefined || body.guild_id !== undefined ? { guildId: clean(body.guildId ?? body.guild_id, 120) || null } : {}),
        ...(body.market !== undefined ? { market: clean(body.market, 80) || null } : {}),
        ...(body.country !== undefined ? { country: clean(body.country, 80) || null } : {}),
        ...(body.locale !== undefined ? { locale: clean(body.locale, 40) || null } : {}),
        ...(body.characterId !== undefined || body.character_id !== undefined ? { characterId: clean(body.characterId ?? body.character_id, 120) || null } : {}),
      }, auth.actor, false) });
    }
    if (action === "update") return Response.json({ ok: true, experiment: await updateExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "approve") return Response.json({ ok: true, experiment: await approveExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "reject") return Response.json({ ok: true, experiment: await rejectExperiment(env.DB, id, actorBody, tenantId) });
    if (action === "start") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "RUNNING", actorBody, tenantId) });
    if (action === "pause") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "PAUSED", actorBody, tenantId) });
    if (action === "resume") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "RUNNING", actorBody, tenantId) });
    if (action === "complete") throw new Error("Human-confirmed Result is required. Use confirmResult.");
    if (action === "recordResult") throw new Error("Use evaluateResult and confirmResult for Result decisions.");
    if (action === "archive") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "ARCHIVED", actorBody, tenantId) });
    if (action === "cancel") return Response.json({ ok: true, experiment: await transitionExperiment(env.DB, id, "CANCELLED", actorBody, tenantId) });
    return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Experiment action failed." }, { status: 400 });
  }
}
