import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { createContentDraft, listContentDrafts } from "@/app/lib/sns-content-draft";

async function admin() { const session = await getAdminSession(); return session && session.email.toLowerCase() === adminEmail().toLowerCase(); }
function tenant(value: unknown) { const id = String(value || GROWTH_ENGINE_TENANT_ID); if (id !== GROWTH_ENGINE_TENANT_ID) throw new Error("Invalid tenant_id."); return id; }
export async function GET(request: Request) { if (!(await admin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }); try { return Response.json({ ok: true, drafts: await listContentDrafts(env.DB, tenant(new URL(request.url).searchParams.get("tenantId"))) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Draft API failed." }, { status: 400 }); } }
export async function POST(request: Request) { if (!(await admin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }); const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); try { const draft = await createContentDraft(env.DB, String(body.ideaCandidateId || ""), tenant(body.tenantId ?? body.tenant_id)); return Response.json({ ok: true, draft }); } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Draft creation failed." }, { status: 400 }); } }
