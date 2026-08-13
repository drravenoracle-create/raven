import vinext from "vinext";
import { defineConfig } from "vite";

const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  name: "raven-oracle",
  main: "./worker/index.ts",
  compatibility_date: "2026-05-22",
  workers_dev: false,
  preview_urls: false,
  routes: [
    {
      pattern: "raven.fortunestudios.jp/*",
      zone_name: "fortunestudios.jp",
    },
  ],
  d1_databases: [
    {
      binding: "DB",
      database_name: "raven-oracle",
      database_id: "b5d2b96a-c574-47fa-b582-1063b05595bd",
    },
  ],
  r2_buckets: [],
};

export default defineConfig(async () => {
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});



