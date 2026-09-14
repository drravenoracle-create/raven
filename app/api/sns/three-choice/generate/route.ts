import { getAdminSession, isAdminEmail } from "@/app/lib/google-admin-auth";
const TENANT_ID = "raven-oracle";
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session || !isAdminEmail(session.email)) return Response.json({ error: "Admin authentication required." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const payload = body.job_payload as Record<string, unknown> | undefined;
  if (!payload || payload.character !== "raven" || payload.deckId !== "raven-lenormand-drive") return Response.json({ error: "正規のRaven三択動画Payloadが必要です。" }, { status: 422 });
  const response = await fetch(new URL("/api/sns/videos/three-choice/render", request.url), { method: "POST", headers: { "Content-Type": "application/json", Cookie: request.headers.get("Cookie") || "" }, body: JSON.stringify({ tenant_id: TENANT_ID, job_payload: payload, allow_duplicate: body.allow_duplicate === true, queue_to_sns: true }) });
  const result = await response.json().catch(() => ({}));
  return Response.json(result, { status: response.status });
}
