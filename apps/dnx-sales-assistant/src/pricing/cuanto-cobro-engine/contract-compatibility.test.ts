/**
 * Compatibilidad tipada con @repo/cuanto-cobro-core.
 * Se detiene ANTES de calculateCuantoCobro.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSyntheticReadyFifteenthTemplate,
  createSyntheticReadyProfile,
  createSyntheticReadyWeddingTemplate,
} from "../__fixtures__/synthetic-ready.js";
import { createCuantoCobroCompatibleInput } from "../cuanto-cobro-adapter/create-calculation-input.js";
import { ADAPTER_FORMULA_VERSION_EXPECTED } from "../cuanto-cobro-adapter/compatible-models.js";
import { preparePricingJob } from "../prepare-pricing-job.js";
import {
  toCuantoCobroProfileInput,
  toCuantoCobroQuoteInput,
  toPublicEngineInput,
} from "./contract-compatibility.js";

describe("contract-compatibility — puente tipado (sin motor)", () => {
  it("draft + prepare + adaptador → tipos públicos sin precios ni side effects", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 8,
      },
      template,
    );
    assert.equal(prepared.status, "READY");
    if (prepared.status !== "READY") return;

    const adapted = createCuantoCobroCompatibleInput({
      profile,
      template,
      preparedJob: prepared,
    });
    assert.equal(adapted.status, "READY");
    if (adapted.status !== "READY") return;

    assert.equal(adapted.formulaVersion, ADAPTER_FORMULA_VERSION_EXPECTED);
    assert.equal(adapted.profileVersion, profile.profileVersion);
    assert.equal(adapted.templateVersion, template.templateVersion);

    const publicInput = toPublicEngineInput(adapted.input);

    const profileAgain = toCuantoCobroProfileInput(adapted.input.profile);
    const quoteAgain = toCuantoCobroQuoteInput(adapted.input.quote);

    assert.equal(publicInput.profile, profileAgain);
    assert.equal(publicInput.quote, quoteAgain);
    assert.equal(publicInput.profile.currency, "ARS");
    assert.equal(publicInput.quote.status, "draft");
    assert.ok(publicInput.quote.concepts.length >= 1);

    const serialized = JSON.stringify(publicInput);
    assert.equal(serialized.includes("recommendedPrice"), false);
    assert.equal(serialized.includes("minimumSustainablePrice"), false);
    assert.equal(serialized.includes("recommendedBusinessPrice"), false);
  });

  it("plantilla quince también produce quote tipado", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyFifteenthTemplate();
    const prepared = preparePricingJob(
      {
        serviceType: "FIFTEENTH_BIRTHDAY",
        eventDate: "2026-10-01",
        city: "Rosario",
        durationHours: 6,
      },
      template,
    );
    assert.equal(prepared.status, "READY");
    if (prepared.status !== "READY") return;

    const adapted = createCuantoCobroCompatibleInput({
      profile,
      template,
      preparedJob: prepared,
    });
    assert.equal(adapted.status, "READY");
    if (adapted.status !== "READY") return;

    const quote = toCuantoCobroQuoteInput(adapted.input.quote);
    assert.equal(quote.client.jobType, "evento");
  });
});
