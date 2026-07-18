import type { QuoteRequestDraft } from "../../quote-request/models.js";
import { runPricingDryRun } from "../../pricing/offline/run-pricing-dry-run.js";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../../pricing/__fixtures__/synthetic-ready.js";
import type { PricingProfile, PricingServiceTemplateCatalog } from "../../pricing/models.js";
import { assertProductionSafePricingProfile } from "../../pricing/profile/user-facing-profile-guard.js";
import {
  resolvePricingRuntimeConfigFromDisk,
} from "../../pricing/runtime/resolve-pricing-runtime-config.js";
import type { PricingReviewResult } from "../domain/pricing-review-models.js";
import { mapCalculationToPricingReview } from "./map-calculation-to-review.js";
import type { PricingReviewHints } from "./review-hints.js";
import { applyReviewHints } from "./review-hints.js";

export type RunPricingReviewInput = {
  draft?: QuoteRequestDraft;
  amountsVisible?: boolean;
  /** Tests / CLI / lab opt-in: perfil sintético en memoria. Nunca en Telegram real. */
  useSynthetic?: boolean;
  syntheticProfileOverrides?: Partial<PricingProfile>;
  inline?: {
    profile: PricingProfile;
    catalog: PricingServiceTemplateCatalog;
  };
  hints?: PricingReviewHints;
  /** Fuerza fallo controlado del motor (tests). */
  forceEngineFailure?: boolean;
  /** Escenario: no cargar configuración (NOT_CONFIGURED). */
  skipConfig?: boolean;
  /**
   * Solo tests: permite inline/disk con perfil de prueba sin bloquear.
   * El runtime operativo no debe pasar este flag.
   */
  allowTestUnsafeProfile?: boolean;
};

export type RunPricingReviewOutput = {
  review: PricingReviewResult;
  usedSynthetic: boolean;
  configSource: "DISK" | "SYNTHETIC" | "INLINE" | "NONE";
};

/**
 * Ejecuta el motor real (vía dry-run / engine) y deriva la revisión.
 * No duplica fórmulas.
 */
export async function runPricingReview(
  input: RunPricingReviewInput,
): Promise<RunPricingReviewOutput> {
  let profile: PricingProfile | undefined;
  let catalog: PricingServiceTemplateCatalog | undefined;
  let configSource: RunPricingReviewOutput["configSource"] = "NONE";
  let usedSynthetic = false;

  if (input.skipConfig) {
    profile = undefined;
    catalog = undefined;
    configSource = "NONE";
  } else if (input.inline) {
    profile = input.inline.profile;
    catalog = input.inline.catalog;
    configSource = "INLINE";
  } else if (input.useSynthetic) {
    profile = createSyntheticReadyProfile({
      ...input.syntheticProfileOverrides,
      name: "TEST_ONLY_SYNTHETIC_PROFILE",
      id: "TEST_ONLY_SYNTHETIC_PROFILE",
    });
    catalog = createSyntheticReadyCatalog();
    configSource = "SYNTHETIC";
    usedSynthetic = true;
  } else {
    const disk = resolvePricingRuntimeConfigFromDisk();
    if (disk.status === "READY") {
      profile = disk.profile;
      catalog = disk.catalog;
      configSource = "DISK";
    }
  }

  if (
    profile &&
    !input.useSynthetic &&
    !input.allowTestUnsafeProfile &&
    !assertProductionSafePricingProfile(profile).ok
  ) {
    profile = undefined;
    catalog = undefined;
    configSource = "NONE";
  }

  if (!profile || !catalog) {
    const review = mapCalculationToPricingReview({
      calculation: null,
      draft: input.draft,
      profile: undefined,
      configStatus: "NOT_CONFIGURED",
      amountsVisible: input.amountsVisible === true,
    });
    return {
      review: applyReviewHints(review, input.hints, input.draft),
      usedSynthetic,
      configSource,
    };
  }

  if (input.forceEngineFailure) {
    const review = mapCalculationToPricingReview({
      calculation: {
        status: "FAILED",
        issues: [
          {
            code: "ENGINE_FORCED_FAILURE",
            path: "engine",
            severity: "ERROR",
            message: "Fallo controlado del motor (escenario de prueba).",
          },
        ],
        approvalStatus: "NOT_REVIEWED",
      },
      draft: input.draft,
      profile,
      configStatus: "READY",
      amountsVisible: input.amountsVisible === true,
    });
    return {
      review: applyReviewHints(review, input.hints, input.draft),
      usedSynthetic,
      configSource,
    };
  }

  const missingFields: string[] = [];
  if (!input.draft?.serviceType || input.draft.serviceType === "UNKNOWN") {
    missingFields.push("SERVICE_TYPE");
  }
  if (input.draft?.durationHours === undefined) {
    missingFields.push("DURATION_HOURS");
  }

  if (missingFields.length > 0) {
    const review = mapCalculationToPricingReview({
      calculation: {
        status: "INCOMPLETE",
        missingFields,
        issues: [],
        approvalStatus: "NOT_REVIEWED",
      },
      draft: input.draft,
      profile,
      configStatus: "READY",
      amountsVisible: input.amountsVisible === true,
    });
    return {
      review: applyReviewHints(review, input.hints, input.draft),
      usedSynthetic,
      configSource,
    };
  }

  const dry = await runPricingDryRun({
    inline: {
      profile,
      catalog,
      draft: input.draft!,
    },
  });

  let calculation = dry.calculation ?? null;
  if (!calculation && dry.exitCode !== 0) {
    calculation = {
      status: "INCOMPLETE",
      missingFields: dry.issues.map((i) => i.path),
      issues: dry.issues,
      approvalStatus: "NOT_REVIEWED",
    };
  }

  const review = mapCalculationToPricingReview({
    calculation,
    draft: input.draft,
    profile,
    configStatus: "READY",
    amountsVisible: input.amountsVisible === true,
  });

  return {
    review: applyReviewHints(review, input.hints, input.draft),
    usedSynthetic,
    configSource,
  };
}
