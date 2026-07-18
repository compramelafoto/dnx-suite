import type { ConversationStore } from "../conversation/conversation-store.js";
import type { InMemoryConversationStore } from "../conversation/in-memory-conversation-store.js";
import type { PricingRuntimeDeps } from "../pricing/runtime/pricing-runtime.js";
import type { AppConfig } from "./config.js";

export type AppDeps = {
  config: AppConfig;
  store: ConversationStore;
  memoryClock: Pick<InMemoryConversationStore, "now" | "nextExpiresAt">;
  /** Runtime silencioso — no afecta respuestas HTTP. */
  pricingRuntime?: PricingRuntimeDeps;
};
