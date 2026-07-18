/**
 * Ejecución silenciosa del motor — prepare → adapter → engine.
 * Sin HTTP, sin mutar respuestas, sin lanzar al caller.
 */
import type { QuoteRequestDraft } from "../../quote-request/models.js";
import { createCuantoCobroCompatibleInput } from "../cuanto-cobro-adapter/create-calculation-input.js";
import {
  createCuantoCobroPricingEngine,
  type CuantoCobroPricingEngineOptions,
} from "../cuanto-cobro-engine/cuanto-cobro-pricing-engine.js";
import { preparePricingJob } from "../prepare-pricing-job.js";
import { buildPricingCacheKey } from "./pricing-cache-key.js";
import type {
  ConversationPricingResult,
  PricingRuntimeExecution,
} from "./pricing-runtime-result.js";
import type { PricingRuntimeConfigResolver } from "./resolve-pricing-runtime-config.js";

export type ExecuteRuntimePricingInput = {
  draft: QuoteRequestDraft;
  previousCacheKey?: string;
  previousResult?: ConversationPricingResult;
  resolveConfig: PricingRuntimeConfigResolver;
  engineOptions?: CuantoCobroPricingEngineOptions;
};

function failedResult(message: string): ConversationPricingResult {
  return {
    status: "FAILED",
    approvalStatus: "NOT_REVIEWED",
    warnings: [{ code: "RUNTIME_FAILED", message }],
  };
}

function incompleteResult(message: string): ConversationPricingResult {
  return {
    status: "INCOMPLETE",
    approvalStatus: "NOT_REVIEWED",
    warnings: [{ code: "RUNTIME_INCOMPLETE", message }],
  };
}

function mapCalculationToConversationResult(
  calculation: Awaited<
    ReturnType<ReturnType<typeof createCuantoCobroPricingEngine>["calculate"]>
  >,
): ConversationPricingResult {
  if (calculation.status === "READY") {
    return {
      status: "READY",
      minimumSustainablePrice: calculation.minimumSustainablePrice,
      recommendedBusinessPrice: calculation.recommendedBusinessPrice,
      currency: calculation.currency,
      approvalStatus: calculation.approvalStatus,
      profileVersion: calculation.profileVersion,
      templateVersion: calculation.templateVersion,
      formulaVersion: calculation.formulaVersion,
      warnings: calculation.warnings.map((w) => ({
        code: w.code,
        message: w.message.slice(0, 160),
      })),
    };
  }
  if (calculation.status === "INCOMPLETE") {
    return {
      status: "INCOMPLETE",
      approvalStatus: calculation.approvalStatus,
      profileVersion: calculation.profileVersion,
      templateVersion: calculation.templateVersion,
      formulaVersion: calculation.formulaVersion,
      warnings: calculation.issues.map((i) => ({
        code: i.code,
        message: i.message.slice(0, 160),
      })),
    };
  }
  return {
    status: "FAILED",
    approvalStatus: calculation.approvalStatus,
    profileVersion: calculation.profileVersion,
    templateVersion: calculation.templateVersion,
    formulaVersion: calculation.formulaVersion,
    warnings: calculation.issues.map((i) => ({
      code: i.code,
      message: i.message.slice(0, 160),
    })),
  };
}

/**
 * Ejecuta el motor o devuelve cache si la huella no cambió.
 * Nunca lanza.
 */
export async function executeRuntimePricing(
  input: ExecuteRuntimePricingInput,
): Promise<PricingRuntimeExecution> {
  try {
    const draft = input.draft;
    if (
      !draft.serviceType ||
      draft.serviceType === "UNKNOWN" ||
      draft.durationHours === undefined
    ) {
      const cacheKey = buildPricingCacheKey({
        draft,
        profileVersion: "n/a",
        templateVersion: "n/a",
        formulaVersion: "n/a",
      });
      return {
        cacheKey,
        fromCache: false,
        result: incompleteResult("Draft incompleto para cálculo runtime."),
      };
    }

    const config = await input.resolveConfig();
    if (config.status !== "READY") {
      const cacheKey = buildPricingCacheKey({
        draft,
        profileVersion: "unavailable",
        templateVersion: "unavailable",
        formulaVersion: "unavailable",
      });
      if (input.previousCacheKey === cacheKey && input.previousResult) {
        return {
          cacheKey,
          fromCache: true,
          result: input.previousResult,
        };
      }
      return {
        cacheKey,
        fromCache: false,
        result: failedResult(`Configuración no disponible (${config.reason}).`),
      };
    }

    const template = config.catalog.templates.find(
      (t) => t.serviceType === draft.serviceType,
    );
    if (!template) {
      const cacheKey = buildPricingCacheKey({
        draft,
        profileVersion: config.profile.profileVersion,
        templateVersion: "missing",
        formulaVersion: config.profile.formulaVersion,
      });
      return {
        cacheKey,
        fromCache: false,
        result: incompleteResult(`Sin plantilla para ${draft.serviceType}.`),
      };
    }

    const cacheKey = buildPricingCacheKey({
      draft,
      profileVersion: config.profile.profileVersion,
      templateVersion: template.templateVersion,
      formulaVersion: config.profile.formulaVersion,
    });

    if (
      input.previousCacheKey === cacheKey &&
      input.previousResult &&
      input.previousResult.status === "READY"
    ) {
      return {
        cacheKey,
        fromCache: true,
        result: input.previousResult,
      };
    }

    const prepared = preparePricingJob(draft, template);
    if (prepared.status !== "READY") {
      return {
        cacheKey,
        fromCache: false,
        result: incompleteResult(
          prepared.status === "UNSUPPORTED"
            ? prepared.reason
            : "preparePricingJob incompleto.",
        ),
      };
    }

    const adapted = createCuantoCobroCompatibleInput({
      profile: config.profile,
      template,
      preparedJob: prepared,
    });
    if (adapted.status !== "READY") {
      return {
        cacheKey,
        fromCache: false,
        result:
          adapted.status === "INCOMPLETE"
            ? incompleteResult("Adaptador incompleto.")
            : failedResult(
                adapted.status === "UNSUPPORTED"
                  ? adapted.reason
                  : "Adaptador inválido.",
              ),
      };
    }

    const engine = createCuantoCobroPricingEngine(input.engineOptions);
    const calculation = await engine.calculate({
      input: adapted.input,
      profileVersion: adapted.profileVersion,
      templateVersion: adapted.templateVersion,
      formulaVersion: adapted.formulaVersion,
      warnings: adapted.warnings,
    });

    return {
      cacheKey,
      fromCache: false,
      result: mapCalculationToConversationResult(calculation),
    };
  } catch {
    return {
      cacheKey: "runtime:exception",
      fromCache: false,
      result: failedResult("Excepción en pricing runtime."),
    };
  }
}
