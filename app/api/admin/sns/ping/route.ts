export function GET() {
  return Response.json(
    { ok: true, worker: "raven-oracle", tenantId: "raven-oracle", version: "sns-engine-raven-2026-08-09" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
