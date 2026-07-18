import { loadConfig, loadEnvFiles } from "../../config/env.js";
import { InMemoryConversationStore } from "../../conversation/in-memory-conversation-store.js";
import { logError, logInfo } from "../../logger/logger.js";
import { createDefaultPricingRuntimeDeps } from "../../pricing/runtime/pricing-runtime.js";
import { startServer } from "../../server/start-server.js";
import type { AppDeps } from "../../types/app-deps.js";
import { isReviewLabEnabled } from "../enabled.js";

process.env.DNX_SALES_ASSISTANT_REVIEW_LAB ??= "true";
process.env.PORT ??= "8799";
if (!process.env.NODE_ENV || process.env.NODE_ENV === "production") {
  // Lab entry never runs as production
  process.env.NODE_ENV = "development";
}

loadEnvFiles();

function main(): void {
  if (!isReviewLabEnabled()) {
    throw new Error(
      "Review Lab deshabilitado. Requiere DNX_SALES_ASSISTANT_REVIEW_LAB=true y NODE_ENV≠production.",
    );
  }

  const config = loadConfig();
  const store = new InMemoryConversationStore();
  const deps: AppDeps = {
    config,
    store,
    memoryClock: store,
    pricingRuntime: { ...createDefaultPricingRuntimeDeps(), silentLogs: true },
  };
  const server = startServer(deps);

  const url = `http://localhost:${config.port}/review-lab`;
  console.log("");
  console.log("DNX Sales Assistant Review Lab");
  console.log(url);
  console.log(
    "Telegram es el canal principal de conversación. El laboratorio es una herramienta técnica secundaria.",
  );
  console.log("Ctrl+C para detener. Puerto liberado al cerrar.");
  console.log("");

  const shutdown = (signal: string) => {
    logInfo("shutting_down", { signal, reviewLab: true });
    server.close(() => {
      process.exit(0);
    });
    // Force exit if close hangs
    setTimeout(() => process.exit(0), 2000).unref();
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
