import { env } from "cloudflare:workers";
import { CARD_LIBRARY_TENANT_ID, selectCards } from "@/app/lib/card-library";

function clean(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return Response.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  const tenantId = clean(body.tenant_id ?? body.tenantId, 80) || CARD_LIBRARY_TENANT_ID;
  if (tenantId !== CARD_LIBRARY_TENANT_ID) return Response.json({ ok: false, error: "Invalid tenant_id." }, { status: 400 });
  try {
    const selection = await selectCards(env.DB, body, tenantId);
    return Response.json({ ok: true, selection }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : "Card selection failed." }, { status: 400 });
  }
}
