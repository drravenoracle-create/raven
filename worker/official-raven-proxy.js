const RAVEN_ORIGIN = "raven-oracle.dr-ravenoracle.workers.dev";
const PUBLIC_ORIGIN = "https://raven.fortunestudios.jp";
const ORIGIN_URL = `https://${RAVEN_ORIGIN}`;

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = RAVEN_ORIGIN;
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.set("x-forwarded-host", "raven.fortunestudios.jp");
    headers.set("x-forwarded-proto", "https");
    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });
    const nextHeaders = new Headers(response.headers);
    const location = nextHeaders.get("location");
    if (location) {
      nextHeaders.set("location", location.replaceAll(ORIGIN_URL, PUBLIC_ORIGIN));
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: nextHeaders,
    });
  },
};
