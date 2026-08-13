export async function GET() {
  return new Response("google-site-verification: google5415f515f0886881.html", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
