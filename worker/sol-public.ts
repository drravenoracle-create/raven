import baseWorker from "./sol-preview.ts";

interface Env {
  DB: D1Database;
  ANALYTICS_DB?: D1Database;
  STUDIOOS_TENANT_ID: string;
  STUDIOOS_CHARACTER_ID: string;
  STUDIOOS_GUILD_ID: string;
  STUDIOOS_ENVIRONMENT: string;
  ADMIN_BASIC_AUTH?: string;
}

function publicHome(html: string) {
  return html.replace(/<h3>現在の提供状態<\/h3><ul class="list">[\s\S]*?<\/ul>/, '<h3>ご利用案内</h3><ul class="list"><li>ブログ：準備中です</li><li>相談：今の気持ちに合う入口をご案内します</li><li>広報：公式のお知らせでご案内します</li><li>ご利用時間：いつでもご覧いただけます</li></ul>');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = await baseWorker.fetch(request, env);
    const url = new URL(request.url);
    if (url.pathname !== "/" || !response.headers.get("content-type")?.includes("text/html")) return response;
    const html = await response.text();
    return new Response(publicHome(html), { status: response.status, headers: response.headers });
  },
};
