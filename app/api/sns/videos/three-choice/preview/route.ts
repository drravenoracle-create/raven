import { env } from "cloudflare:workers";
import { buildThreeChoicePreview, THREE_CHOICE_TENANT_ID } from "@/app/lib/three-choice-video";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function assertTenant(value: unknown) {
  const tenantId = clean(value, 80) || THREE_CHOICE_TENANT_ID;
  if (tenantId !== THREE_CHOICE_TENANT_ID) throw new Error("Invalid tenant_id");
  return tenantId;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  try {
    assertTenant(body.tenant_id ?? body.tenantId);
    const preview = await buildThreeChoicePreview(env.DB, body);
    return Response.json({ ok: true, ...preview }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Preview generation failed." }, { status: 400 });
  }
}
