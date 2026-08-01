import type { OpenAiUsage } from "./types.js";

export function emptyUsage(): OpenAiUsage {
  return {
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    requests: null,
  };
}

/**
 * Extract usage from Agents SDK run result when available.
 * Never invent token counts.
 */
export function extractUsageFromRunResult(result: unknown): OpenAiUsage {
  const usage = emptyUsage();
  if (!result || typeof result !== "object") return usage;

  const record = result as {
    state?: { usage?: Record<string, unknown> };
    runContext?: { usage?: Record<string, unknown> };
  };

  const raw = record.state?.usage ?? record.runContext?.usage;
  if (!raw || typeof raw !== "object") return usage;

  const asNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    return null;
  };

  usage.inputTokens = asNumber(raw.inputTokens);
  usage.outputTokens = asNumber(raw.outputTokens);
  usage.totalTokens = asNumber(raw.totalTokens);
  usage.requests = asNumber(raw.requests);
  return usage;
}

/**
 * Pricing intentionally not hardcoded (stale risk).
 * Future: inject a PricingProvider. Until then costUsd stays null.
 */
export function estimateCostUsd(_usage: OpenAiUsage): number | null {
  return null;
}
