import { env } from "cloudflare:workers";

const CARD_FILES: Record<string, string> = {
  knight: "/sns-test/cards/deck2-knight.png",
  clover: "/sns-test/cards/deck2-clover.png",
  ship: "/sns-test/cards/deck2-ship.png",
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const card = String(url.searchParams.get("card") ?? "").trim();
  const assetPath = CARD_FILES[card];

  if (!assetPath) {
    return Response.json({ error: "Unknown sample card." }, { status: 400 });
  }

  const assetRequest = new Request(new URL(assetPath, request.url), request);
  const assetResponse = await env.ASSETS.fetch(assetRequest);
  if (!assetResponse.ok) {
    return Response.json({ error: "Sample card image is not available." }, { status: 404 });
  }

  return new Response(assetResponse.body, {
    status: assetResponse.status,
    headers: {
      "Content-Type": assetResponse.headers.get("Content-Type") ?? "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
