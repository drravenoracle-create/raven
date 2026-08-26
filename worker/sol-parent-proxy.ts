const SOL_ORIGIN = "https://sol-oracle.fortune-kanri.workers.dev";

interface Env {
  SOL_ORIGIN: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incomingUrl = new URL(request.url);

    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", incomingUrl.host);
    headers.set("x-forwarded-proto", incomingUrl.protocol.replace(":", ""));

    return env.SOL_ORIGIN.fetch(new Request(new URL(incomingUrl.pathname + incomingUrl.search, SOL_ORIGIN), {
      method: request.method,
      headers,
      body: request.body,
      redirect: "manual",
    }));
  },
};
