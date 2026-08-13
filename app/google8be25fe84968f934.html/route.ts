export async function GET() {
  return new Response("google-site-verification: google8be25fe84968f934.html", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
