import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSyntheticReadyCatalog,
  createSyntheticReadyProfile,
} from "../pricing/__fixtures__/synthetic-ready.js";
import { runPricingReview } from "./adapters/run-pricing-review.js";
import { mapCalculationToPricingReview } from "./adapters/map-calculation-to-review.js";
import { comparePricingExplanations } from "./comparison/compare-explanations.js";
import { buildDaniPricingExplanation } from "./explanation/dani-pricing-explanation-v1.js";
import {
  payloadLooksLikePublicPriceLeak,
  sanitizePricingReviewExport,
  sanitizePricingReviewForLab,
} from "./sanitization/sanitize-pricing-review.js";
import {
  getPricingReviewScenario,
  PRICING_REVIEW_SCENARIOS,
} from "./scenarios/catalog.js";
import { runPricingReviewValidate } from "./cli/run-pricing-review-validate.js";
import { isReviewLabEnabled } from "../review-lab/enabled.js";

describe("pricing-review", () => {
  it("adapta resultado real READY sin duplicar fórmulas", async () => {
    const { review, usedSynthetic } = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      draft: {
        serviceType: "WEDDING",
        eventDate: "2026-11-20",
        city: "Rosario",
        durationHours: 8,
      },
    });
    assert.equal(usedSynthetic, true);
    assert.equal(review.status, "READY");
    assert.ok(review.result);
    assert.ok(review.result.minimumSustainable > 0);
    assert.ok(review.result.recommendedPrice >= review.result.minimumSustainable);
    assert.equal(review.result.commercialFactor, 1.25);
    assert.equal(review.result.currency, "ARS");
    assert.ok(review.components.length >= 3);
    assert.match(review.explanationDani, /mínimo/i);
    assert.match(review.explanationDani, /recomendado/i);
    assert.ok(review.inputSummary.fields.some((f) => f.code === "DURATION_HOURS"));
  });

  it("recomendado no menor al mínimo (starting = factor 1)", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      syntheticProfileOverrides: { commercialPositioningId: "starting" },
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(review.status, "READY");
    assert.equal(review.result?.commercialFactor, 1);
    assert.equal(
      review.result?.recommendedPrice,
      review.result?.minimumSustainable,
    );
  });

  it("factor comercial personalizado high-demand", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      syntheticProfileOverrides: { commercialPositioningId: "high-demand" },
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(review.result?.commercialFactor, 2);
    assert.ok(
      (review.result?.recommendedPrice ?? 0) >
        (review.result?.minimumSustainable ?? 0),
    );
  });

  it("faltantes y supuestos cuando falta duración", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      draft: {
        serviceType: "WEDDING",
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(review.status, "INCOMPLETE");
    assert.ok(
      review.missingInformation.some((m) => m.code === "DURATION_HOURS"),
    );
    assert.ok(review.assumptions.length >= 1);
    assert.equal(review.result, undefined);
  });

  it("segundo fotógrafo y traslado personalizan explicación", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 10,
        city: "Funes",
        eventDate: "2026-12-01",
      },
      hints: { photographersCount: 2, travelIncluded: true },
    });
    assert.equal(review.status, "READY");
    assert.match(review.explanationDani, /dos fotógrafos/i);
    assert.match(review.explanationDani, /traslado/i);
  });

  it("duración aproximada advierte", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
      hints: { durationApproximate: true },
    });
    assert.ok(review.warnings.some((w) => w.code === "DURATION_APPROXIMATE"));
    assert.match(review.explanationDani, /aproximada/i);
  });

  it("perfil ausente → NOT_CONFIGURED", async () => {
    const { review } = await runPricingReview({
      skipConfig: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(review.status, "NOT_CONFIGURED");
    assert.match(review.warnings[0]?.message ?? "", /perfil económico local/i);
  });

  it("fallo controlado del motor", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      forceEngineFailure: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(review.status, "FAILED");
  });

  it("importes ocultos por defecto en sanitización lab", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    const hidden = sanitizePricingReviewForLab(review, { revealAmounts: false });
    assert.equal(hidden.amountsVisible, false);
    assert.equal(hidden.result?.amountsHidden, true);
    assert.equal(hidden.result?.minimumSustainable, undefined);
    const shown = sanitizePricingReviewForLab(review, { revealAmounts: true });
    assert.ok(typeof shown.result?.minimumSustainable === "number");
  });

  it("export financiero sanitizado sin rutas absolutas ni perfil completo", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    const payload = sanitizePricingReviewExport({
      review,
      sessionId: "sess-test",
    });
    const blob = JSON.stringify(payload);
    assert.equal(blob.includes("/Users/"), false);
    assert.equal(blob.includes("personalExpenses"), false);
    assert.equal(payload.kind, "pricing-review-export");
    assert.ok(payload.result);
  });

  it("comparación de explicaciones no toca montos", () => {
    const cmp = comparePricingExplanations({
      structured: "Componentes:\n- Traslado\nSupuestos:\n- Un solo fotógrafo",
      dani: "Sumé el traslado. Un solo fotógrafo por ahora.",
      componentNames: ["Traslado"],
      assumptionLabels: ["Un solo fotógrafo"],
      missingLabels: [],
    });
    assert.ok(cmp.clarityScore >= 5);
    assert.match(cmp.note, /no altera montos/i);
  });

  it("mapCalculationToPricingReview no inventa montos si FAILED", () => {
    const review = mapCalculationToPricingReview({
      calculation: {
        status: "FAILED",
        issues: [
          {
            code: "X",
            path: "engine",
            severity: "ERROR",
            message: "fail",
          },
        ],
        approvalStatus: "NOT_REVIEWED",
      },
      configStatus: "READY",
      profile: createSyntheticReadyProfile({
        id: "TEST_ONLY_SYNTHETIC_PROFILE",
        name: "TEST_ONLY_SYNTHETIC_PROFILE",
      }),
    });
    assert.equal(review.status, "FAILED");
    assert.equal(review.result, undefined);
  });

  it("perfil sintético marcado TEST_ONLY_SYNTHETIC_PROFILE", async () => {
    const profile = createSyntheticReadyProfile({
      id: "TEST_ONLY_SYNTHETIC_PROFILE",
      name: "TEST_ONLY_SYNTHETIC_PROFILE",
    });
    assert.equal(profile.id, "TEST_ONLY_SYNTHETIC_PROFILE");
    assert.ok(createSyntheticReadyCatalog().templates.length >= 5);
  });

  it("15 escenarios de pricing-review y validate", async () => {
    assert.equal(PRICING_REVIEW_SCENARIOS.length, 15);
    assert.ok(getPricingReviewScenario("pr-wedding-complete"));
    const result = await runPricingReviewValidate();
    assert.equal(result.exitCode, 0, result.lines.join("\n"));
  });

  it("explicación Dani contextual con ciudad", () => {
    const text = buildDaniPricingExplanation({
      status: "READY",
      draft: {
        serviceType: "WEDDING",
        city: "Rosario",
        durationHours: 8,
      },
      result: {
        minimumSustainable: 100,
        recommendedPrice: 125,
        commercialFactor: 1.25,
        currency: "ARS",
      },
      components: [
        {
          code: "HUMAN_COST",
          name: "Tiempo",
          origin: "PROFILE",
          status: "INCLUDED",
          impact: "HIGH",
          explanation: "x",
          warnings: [],
        },
        {
          code: "BUSINESS_STRUCTURE",
          name: "Estructura",
          origin: "PROFILE",
          status: "INCLUDED",
          impact: "HIGH",
          explanation: "x",
          warnings: [],
        },
      ],
      assumptions: [],
      amountsVisible: false,
    });
    assert.match(text, /Rosario/);
    assert.match(text, /8 horas/);
    assert.equal(text.includes("100"), false);
  });

  it("lab deshabilitado en production", () => {
    assert.equal(
      isReviewLabEnabled({
        NODE_ENV: "production",
        DNX_SALES_ASSISTANT_REVIEW_LAB: "true",
      }),
      false,
    );
  });

  it("payload público no debe parecer breakdown", () => {
    assert.equal(
      payloadLooksLikePublicPriceLeak({
        ok: true,
        text: "hola",
        pricingRuntimeStatus: "READY",
      }),
      false,
    );
    assert.equal(
      payloadLooksLikePublicPriceLeak({
        recommendedBusinessPrice: 1,
      }),
      true,
    );
  });

  it("corrección de duración cambia resultado", async () => {
    const a = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    const b = await runPricingReview({
      useSynthetic: true,
      amountsVisible: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 10,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
    });
    assert.equal(a.review.status, "READY");
    assert.equal(b.review.status, "READY");
    assert.notEqual(
      a.review.result?.minimumSustainable,
      b.review.result?.minimumSustainable,
    );
  });

  it("dato inferido genera warning", async () => {
    const { review } = await runPricingReview({
      useSynthetic: true,
      draft: {
        serviceType: "WEDDING",
        durationHours: 8,
        city: "Rosario",
        eventDate: "2026-11-20",
      },
      hints: { inferredFieldCodes: ["DURATION_HOURS"] },
    });
    assert.ok(review.warnings.some((w) => w.code === "INFERRED_DURATION_HOURS"));
  });
});
