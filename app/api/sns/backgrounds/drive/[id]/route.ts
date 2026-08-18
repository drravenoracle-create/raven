import { env } from "cloudflare:workers";
import { driveVideoResponse } from "@/app/lib/drive-import";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return await driveVideoResponse(env, (await context.params).id); }
  catch (error) { return Response.json({ ok: false, error: error instanceof Error ? error.message : "Drive video unavailable." }, { status: 404 }); }
}
