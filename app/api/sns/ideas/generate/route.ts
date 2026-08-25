import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { generateIdeaCandidates } from "@/app/lib/growth-idea-bridge";

async function admin() { const session = await getAdminSession(); return session && session.email.toLowerCase() === adminEmail().toLowerCase(); }
export async function POST(request: Request) { if (!(await admin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }); const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 }); try { const tenantId = String(body.tenantId ?? body.tenant_id ?? GROWTH_ENGINE_TENANT_ID); if (tenantId !== GROWTH_ENGINE_TENANT_ID) throw new Error("Invalid tenant_id."); return Response.json({ ok: true, ...(await generateIdeaCandidates(env.DB, body, tenantId)) }); } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Idea generation failed." }, { status: 400 }); } }
