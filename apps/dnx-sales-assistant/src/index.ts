import { loadConfig, loadEnvFiles } from "./config/env.js";
import { InMemoryConversationStore } from "./conversation/in-memory-conversation-store.js";
import { logError, logInfo } from "./logger/logger.js";
import { createDefaultPricingRuntimeDeps } from "./pricing/runtime/pricing-runtime.js";
import { startServer } from "./server/start-server.js";
import type { AppDeps } from "./types/app-deps.js";

loadEnvFiles();

function main(): void {
  const config = loadConfig();
  const store = new InMemoryConversationStore();
  const deps: AppDeps = {
    config,
    store,
    memoryClock: store,
    pricingRuntime: createDefaultPricingRuntimeDeps(),
  };
  const server = startServer(deps);

  const shutdown = (signal: string) => {
    logInfo("shutting_down", { signal });
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

try {
  main();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  logError("fatal", { error: message });
  process.exit(1);
}
