import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createBaseCompleteProfile,
  createBaseCompleteQuote,
} from "@repo/cuanto-cobro-core/__fixtures__/characterization-fixtures";
import type { CuantoCobroCalculationResult } from "@repo/cuanto-cobro-core";
import type {
  CuantoCobroCompatibleProfile,
  CuantoCobroCompatibleQuote,
} from "../cuanto-cobro-adapter/compatible-models.js";
import { ADAPTER_FORMULA_VERSION_EXPECTED } from "../cuanto-cobro-adapter/compatible-models.js";
import { PricingIssueCode } from "../issue-codes.js";
import { createCuantoCobroPricingEngine } from "./cuanto-cobro-pricing-engine.js";
import { mapCuantoCobroResult } from "./map-core-result.js";

/** Traducción tipada del fixture de caracterización del core (misma forma). */
function characterizationCompatibleInput() {
  return {
    profile: createBaseCompleteProfile() as unknown as CuantoCobroCompatibleProfile,
    quote: createBaseCompleteQuote() as unknown as CuantoCobroCompatibleQuote,
  };
}

const VERSIONS = {
  profileVersion: "char-1",
  templateVersion: "char-1",
  formulaVersion: ADAPTER_FORMULA_VERSION_EXPECTED,
};

describe("CuantoCobroPricingEngine", () => {
  it("core completo → READY con goldens de caracterización", async () => {
    const engine = createCuantoCobroPricingEngine();
    const input = characterizationCompatibleInput();
    const freeze = JSON.stringify(input);
    const result = await engine.calculate({
      input,
      ...VERSIONS,
    });
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.minimumSustainablePrice, 82_491);
    assert.equal(result.recommendedBusinessPrice, 103_114);
    assert.equal(result.currency, "ARS");
    assert.equal(result.approvalStatus, "NOT_REVIEWED");
    assert.equal(result.profileVersion, VERSIONS.profileVersion);
    assert.equal(result.formulaVersion, VERSIONS.formulaVersion);
    assert.equal(result.breakdown.recommendedBusinessPrice, 103_114);
    // Precio comercial DNX ≠ campo legado recommendedPrice del core.
    assert.equal(result.recommendedBusinessPrice, result.breakdown.recommendedBusinessPrice);
    assert.ok(
      Object.prototype.hasOwnProperty.call(result.breakdown, "recommendedPriceLegacy"),
    );
    assert.equal(JSON.stringify(input), freeze);
  });

  it("usa recommendedBusinessPrice (no recommendedPrice) como comercial", async () => {
    const engine = createCuantoCobroPricingEngine({
      calculate: () =>
        ({
          status: "complete",
          currency: "ARS",
          personalExpenses: 0,
          businessExpenses: 0,
          teamExpenses: 0,
          externalIncome: 0,
          monthlyNeed: 1,
          monthlyAvailableHours: 1,
          monthlyBillableHours: 1,
          coveragePercentage: 1,
          hourlyRate: 1,
          totalJobHours: 1,
          humanCost: 1,
          variableCosts: 0,
          minimumPrice: 100,
          recommendedPrice: 999_999,
          minimumSustainablePrice: 100,
          recommendedBusinessPrice: 125,
          commercialPositioningId: "stable",
          commercialPositioningLabel: "stable",
          growthMargin: 25,
          estimatedMargin: 0,
          monthlyRecoveryFromJob: 0,
          servicesNeededPerMonth: null,
          marginRatio: null,
          profitabilityStatus: "profitable",
          chosenManualPrice: null,
          chosenPriceEffective: 125,
          chosenMargin: 0,
          chosenMarginRatio: null,
          chosenMarginStatus: "profitable",
          chosenPriceDeltaFromRecommended: 0,
          chosenPriceCommercialStatus: "at_or_above_recommended",
          servicesNeededPerMonthByChosenPrice: null,
          grossServicesNeededPerMonth: null,
          warnings: ["w1"],
          cameraWear: null,
          cameraWearSummary: {
            mode: "structural",
            costPerShot: null,
            isCameraConfigured: false,
            totalJobShots: 0,
            totalCameraWearInformative: 0,
            totalCameraWearCharged: 0,
          },
          equipmentSavings: {
            renewalMonthly: 0,
            expansionMonthly: 0,
            totalMonthly: 0,
          },
          clientSummary: {} as never,
          quoteSummary: {} as never,
        }) as unknown as CuantoCobroCalculationResult,
    });

    const result = await engine.calculate({
      input: characterizationCompatibleInput(),
      ...VERSIONS,
    });
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.recommendedBusinessPrice, 125);
    assert.equal(result.breakdown.recommendedPriceLegacy, 999_999);
    assert.ok(result.warnings.some((w) => w.message === "w1"));
  });

  it("core incompleto → INCOMPLETE", async () => {
    const engine = createCuantoCobroPricingEngine({
      calculate: () => ({
        status: "incomplete",
        missingFields: ["weeklyHours"],
      }),
    });
    const result = await engine.calculate({
      input: characterizationCompatibleInput(),
      ...VERSIONS,
    });
    assert.equal(result.status, "INCOMPLETE");
    if (result.status !== "INCOMPLETE") return;
    assert.deepEqual(result.missingFields, ["weeklyHours"]);
    assert.equal(result.approvalStatus, "NOT_REVIEWED");
    assert.ok(
      result.issues.some((i) => i.code === PricingIssueCode.ENGINE_CORE_INCOMPLETE),
    );
  });

  it("excepción → FAILED sin stack", async () => {
    const engine = createCuantoCobroPricingEngine({
      calculate: () => {
        throw new Error("boom-test-secret");
      },
    });
    const result = await engine.calculate({
      input: characterizationCompatibleInput(),
      ...VERSIONS,
    });
    assert.equal(result.status, "FAILED");
    if (result.status !== "FAILED") return;
    assert.ok(
      result.issues.some((i) => i.code === PricingIssueCode.ENGINE_EXECUTION_FAILED),
    );
    const blob = JSON.stringify(result);
    assert.equal(blob.includes("stack"), false);
    assert.ok(blob.includes("boom-test-secret"));
  });

  it("invariancias: mínimo negativo / recomendado negativo / debajo mínimo / NaN / Infinity / moneda / versiones", () => {
    const baseComplete = {
      status: "complete" as const,
      currency: "ARS",
      personalExpenses: 0,
      businessExpenses: 0,
      teamExpenses: 0,
      externalIncome: 0,
      monthlyNeed: 1,
      monthlyAvailableHours: 1,
      monthlyBillableHours: 1,
      coveragePercentage: 1,
      hourlyRate: 1,
      totalJobHours: 1,
      humanCost: 1,
      variableCosts: 0,
      minimumPrice: 100,
      recommendedPrice: 100,
      minimumSustainablePrice: 100,
      recommendedBusinessPrice: 125,
      commercialPositioningId: "stable" as const,
      commercialPositioningLabel: "x",
      growthMargin: 0,
      estimatedMargin: 0,
      monthlyRecoveryFromJob: 0,
      servicesNeededPerMonth: null,
      marginRatio: null,
      profitabilityStatus: "profitable" as const,
      chosenManualPrice: null,
      chosenPriceEffective: 125,
      chosenMargin: 0,
      chosenMarginRatio: null,
      chosenMarginStatus: "profitable" as const,
      chosenPriceDeltaFromRecommended: 0,
      chosenPriceCommercialStatus: "at_or_above_recommended" as const,
      servicesNeededPerMonthByChosenPrice: null,
      grossServicesNeededPerMonth: null,
      warnings: [],
      cameraWear: null,
      cameraWearSummary: {
        mode: "structural" as const,
        costPerShot: null,
        isCameraConfigured: false,
        totalJobShots: 0,
        totalCameraWearInformative: 0,
        totalCameraWearCharged: 0,
      },
      equipmentSavings: { renewalMonthly: 0, expansionMonthly: 0, totalMonthly: 0 },
      clientSummary: {} as never,
      quoteSummary: {} as never,
    };

    const cases: Array<{
      patch: Partial<typeof baseComplete> & { currency?: string };
      versions?: Partial<typeof VERSIONS>;
      code: string;
    }> = [
      {
        patch: { minimumSustainablePrice: -1 },
        code: PricingIssueCode.ENGINE_INVALID_MINIMUM_PRICE,
      },
      {
        patch: { recommendedBusinessPrice: -1 },
        code: PricingIssueCode.ENGINE_INVALID_RECOMMENDED_PRICE,
      },
      {
        patch: { minimumSustainablePrice: 200, recommendedBusinessPrice: 100 },
        code: PricingIssueCode.ENGINE_RECOMMENDED_BELOW_MINIMUM,
      },
      {
        patch: { minimumSustainablePrice: Number.NaN },
        code: PricingIssueCode.ENGINE_INVALID_MINIMUM_PRICE,
      },
      {
        patch: { recommendedBusinessPrice: Number.POSITIVE_INFINITY },
        code: PricingIssueCode.ENGINE_INVALID_RECOMMENDED_PRICE,
      },
      {
        patch: { currency: "" },
        code: PricingIssueCode.ENGINE_CURRENCY_MISSING,
      },
      {
        patch: {},
        versions: { profileVersion: "" },
        code: PricingIssueCode.ENGINE_VERSION_MISSING,
      },
    ];

    for (const c of cases) {
      const mapped = mapCuantoCobroResult(
        { ...baseComplete, ...c.patch } as unknown as CuantoCobroCalculationResult,
        { ...VERSIONS, ...c.versions },
      );
      assert.equal(mapped.status, "FAILED", c.code);
      if (mapped.status !== "FAILED") continue;
      assert.ok(
        mapped.issues.some((i) => i.code === c.code),
        `expected ${c.code}`,
      );
    }
  });
});
