import { env } from "cloudflare:workers";

export async function GET(request: Request) {
  const assetRequest = new Request(new URL("/sns-test/three-choice-sample.mp4", request.url), request);
  const response = await env.ASSETS.fetch(assetRequest);
  if (!response.ok) return Response.json({ ok: false, error: "Sample video asset not found." }, { status: 404 });
  return new Response(response.body, {
    headers: {
      "Content-Type": "video/mp4",
      "Cache-Control": "public, max-age=3600",
      "Content-Disposition": "inline; filename=\"raven-three-choice-sample.mp4\"",
    },
  });
}
