import { logInfo } from "../../logger/logger.js";
import type { QuoteRequestDraft } from "../../quote-request/models.js";
import type { CuantoCobroPricingEngineOptions } from "../cuanto-cobro-engine/cuanto-cobro-pricing-engine.js";
import { draftFingerprint } from "./pricing-cache-key.js";
import { executeRuntimePricing } from "./execute-runtime-pricing.js";
import type { ConversationPricingResult } from "./pricing-runtime-result.js";
import {
  resolvePricingRuntimeConfigFromDisk,
  type PricingRuntimeConfigResolver,
} from "./resolve-pricing-runtime-config.js";

export type PricingRuntimeDeps = {
  resolveConfig?: PricingRuntimeConfigResolver;
  engineOptions?: CuantoCobroPricingEngineOptions;
  /** Tests: desactivar log. */
  silentLogs?: boolean;
};

export type ApplyPricingRuntimeInput = {
  quoteStatus: string | undefined;
  draft: QuoteRequestDraft | undefined;
  previousDraft: QuoteRequestDraft | undefined;
  previousResult?: ConversationPricingResult;
  previousCacheKey?: string;
};

export type ApplyPricingRuntimeOutput = {
  pricingResult?: ConversationPricingResult;
  pricingCacheKey?: string;
};

function logRuntimeStatus(status: ConversationPricingResult["status"], silent?: boolean): void {
  if (silent) return;
  if (status === "READY") logInfo("Pricing runtime READY");
  else if (status === "INCOMPLETE") logInfo("Pricing runtime INCOMPLETE");
  else logInfo("Pricing runtime FAILED");
}

/**
 * Aplica política de runtime sobre el estado post-processor.
 * - READY_FOR_CALCULATION → calcular / cache
 * - draft cambió → invalidar
 * - resto → conservar si el draft no cambió
 */
export async function applyPricingRuntime(
  input: ApplyPricingRuntimeInput,
  deps: PricingRuntimeDeps = {},
): Promise<ApplyPricingRuntimeOutput> {
  const resolveConfig =
    deps.resolveConfig ?? (() => resolvePricingRuntimeConfigFromDisk());

  const draftChanged =
    draftFingerprint(input.previousDraft) !== draftFingerprint(input.draft);

  if (input.quoteStatus !== "READY_FOR_CALCULATION" || !input.draft) {
    if (draftChanged) {
      return { pricingResult: undefined, pricingCacheKey: undefined };
    }
    return {
      pricingResult: input.previousResult,
      pricingCacheKey: input.previousCacheKey,
    };
  }

  const execution = await executeRuntimePricing({
    draft: input.draft,
    previousCacheKey: input.previousCacheKey,
    previousResult: input.previousResult,
    resolveConfig,
    engineOptions: deps.engineOptions,
  });

  logRuntimeStatus(execution.result.status, deps.silentLogs);

  return {
    pricingResult: execution.result,
    pricingCacheKey: execution.cacheKey,
  };
}

export function createDefaultPricingRuntimeDeps(): PricingRuntimeDeps {
  return {
    resolveConfig: () => resolvePricingRuntimeConfigFromDisk(),
  };
}
