import { env } from "cloudflare:workers";
import { getAdminSession, adminEmail } from "@/app/lib/google-admin-auth";
import { GROWTH_ENGINE_TENANT_ID } from "@/app/lib/growth-engine";
import { getContentDraft } from "@/app/lib/sns-content-draft";
import { buildDraftPreview } from "@/app/lib/sns-draft-preview";

async function admin() { const session = await getAdminSession(); return session && session.email.toLowerCase() === adminEmail().toLowerCase(); }
function tenant(value: unknown) { const id = String(value || GROWTH_ENGINE_TENANT_ID); if (id !== GROWTH_ENGINE_TENANT_ID) throw new Error("Invalid tenant_id."); return id; }
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) { if (!(await admin())) return Response.json({ ok: false, error: "Admin authentication required." }, { status: 401 }); try { const url = new URL(request.url); const draft = await getContentDraft(env.DB, (await context.params).id, tenant(url.searchParams.get("tenantId"))); if (!draft) return Response.json({ ok: false, error: "Draft not found." }, { status: 404 }); return Response.json({ ok: true, preview: buildDraftPreview(draft as never, url.searchParams.get("platform") || undefined) }, { headers: { "Cache-Control": "no-store" } }); } catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Preview generation failed." }, { status: 400 }); } }
