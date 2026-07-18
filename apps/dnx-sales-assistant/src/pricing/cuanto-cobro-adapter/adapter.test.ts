import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { defaultProfileExamplePath } from "../config/paths.js";
import {
  createSyntheticReadyFifteenthTemplate,
  createSyntheticReadyProductTemplate,
  createSyntheticReadyProfile,
  createSyntheticReadyWeddingTemplate,
} from "../__fixtures__/synthetic-ready.js";
import { PricingIssueCode } from "../issue-codes.js";
import { pricingProfileSchema } from "../profile/profile-schema.js";
import { preparePricingJob } from "../prepare-pricing-job.js";
import { createCuantoCobroCompatibleInput } from "./create-calculation-input.js";
import { SYNTHETIC_CLIENT_NAME } from "./compatible-models.js";
import { listServiceTypeJobTypeMatrix, mapServiceTypeToJobType } from "./map-service-type.js";
import { mapPricingProfileToCompatibleProfile } from "./map-profile.js";

describe("mapServiceTypeToJobType", () => {
  it("cubre todos los servicios pricables y UNKNOWN", () => {
    const matrix = listServiceTypeJobTypeMatrix();
    assert.equal(matrix.length, 11);
    assert.equal(mapServiceTypeToJobType("WEDDING").status, "OK");
    assert.equal(mapServiceTypeToJobType("UNKNOWN").status, "UNSUPPORTED");
    const wedding = mapServiceTypeToJobType("WEDDING");
    assert.ok(wedding.status === "OK" && wedding.jobType === "boda");
    const fifteenth = mapServiceTypeToJobType("FIFTEENTH_BIRTHDAY");
    assert.ok(fifteenth.status === "OK" && fifteenth.jobType === "evento");
    assert.ok(fifteenth.status === "OK" && fifteenth.genericCollapse);
  });
});

describe("mapPricingProfileToCompatibleProfile", () => {
  it("perfil listo → strings numéricos y sin mutar origen", () => {
    const profile = createSyntheticReadyProfile();
    const freeze = JSON.stringify(profile);
    const result = mapPricingProfileToCompatibleProfile(profile);
    assert.equal(result.status, "OK");
    if (result.status !== "OK") return;
    assert.equal(result.profile.currency, "ARS");
    assert.equal(result.profile.weeklyHours, "40");
    assert.equal(result.profile.commercialPositioningId, "stable");
    assert.equal(result.profile.timeDistribution.coverage, "35");
    assert.ok(result.profile.personalExpenseGroups.length >= 1);
    assert.equal(result.profile.personalExpenseGroups[0]?.items[0]?.amount, "100000");
    assert.equal(result.profile.primaryCameraCustomName, "Cámara sintética");
    assert.equal(JSON.stringify(profile), freeze);
  });

  it("horas inválidas → INVALID", () => {
    const base = createSyntheticReadyProfile();
    const result = mapPricingProfileToCompatibleProfile({
      ...base,
      availability: { ...base.availability, weeklyHours: 0 },
    });
    assert.equal(result.status, "INVALID");
  });

  it("inventario vacío permitido con warning", () => {
    const result = mapPricingProfileToCompatibleProfile(
      createSyntheticReadyProfile({ equipment: [] }),
    );
    assert.equal(result.status, "OK");
    if (result.status !== "OK") return;
    assert.ok(result.warnings.some((w) => w.code === PricingIssueCode.EQUIPMENT_EMPTY));
  });
});

describe("createCuantoCobroCompatibleInput", () => {
  it("end-to-end casamiento READY sin precios", () => {
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
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "READY", JSON.stringify(result));
    if (result.status !== "READY") return;
    assert.equal(result.input.quote.client.jobType, "boda");
    assert.equal(result.input.quote.client.jobDate, "2026-09-20");
    assert.equal(result.input.quote.client.jobLocation, "Córdoba");
    assert.equal(result.input.quote.client.name, SYNTHETIC_CLIENT_NAME);
    assert.equal(result.input.quote.chosenPrice, "");
    assert.equal(result.input.quote.concepts[0]?.coverageHours, "8");
    assert.equal(result.input.quote.concepts[0]?.editingHours, "4");
    assert.equal(result.profileVersion, "test-1");
    assert.equal(result.templateVersion, "test-1");
    assert.equal(result.formulaVersion, "clf-orchestrator-characterized");
    const blob = JSON.stringify(result);
    assert.equal(blob.includes("minimumSustainable"), false);
    assert.equal(blob.includes("recommendedBusiness"), false);
    assert.ok(
      result.warnings.some((w) => w.code === PricingIssueCode.ADAPTER_METADATA_NOT_PRICED),
    );
  });

  it("quince completo", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyFifteenthTemplate();
    const prepared = preparePricingJob(
      { serviceType: "FIFTEENTH_BIRTHDAY", durationHours: 6, city: "Rosario" },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.input.quote.client.jobType, "evento");
    assert.equal(result.input.quote.concepts[0]?.editingHours, "3");
  });

  it("producto con propio + physical-product", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyProductTemplate();
    const prepared = preparePricingJob(
      { serviceType: "PRODUCT_PHOTOGRAPHY", durationHours: 2 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.input.quote.client.jobType, "producto");
    assert.equal(result.input.quote.concepts.length, 2);
    assert.equal(result.input.quote.concepts[1]?.itemType, "physical-product");
    assert.equal(result.input.quote.concepts[1]?.supplierCost, "5000");
    assert.equal(result.input.quote.concepts[1]?.desiredMarginPercent, "25");
  });

  it("example profile no produce READY", () => {
    const raw = JSON.parse(readFileSync(defaultProfileExamplePath(), "utf8"));
    const parsed = pricingProfileSchema.safeParse(raw);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({
      profile: parsed.data,
      template,
      preparedJob: prepared,
    });
    assert.notEqual(result.status, "READY");
  });

  it("duración fuera de rango → INCOMPLETE", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 2 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "INCOMPLETE");
  });

  it("plantilla manual → INCOMPLETE", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyWeddingTemplate({
      editing: { mode: "MANUAL" },
    });
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "INCOMPLETE");
  });

  it("fórmula incompatible → INVALID", () => {
    const profile = createSyntheticReadyProfile({ formulaVersion: "a" });
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "INVALID");
    if (result.status !== "INVALID") return;
    assert.ok(
      result.issues.some((i) => i.code === PricingIssueCode.ADAPTER_FORMULA_VERSION_MISMATCH),
    );
  });

  it("UNKNOWN → UNSUPPORTED", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "UNKNOWN", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "UNSUPPORTED");
  });

  it("perfil no listo", () => {
    const profile = createSyntheticReadyProfile({ configured: false });
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "INCOMPLETE");
  });

  it("horas generales mapeadas", () => {
    const profile = createSyntheticReadyProfile();
    const template = createSyntheticReadyWeddingTemplate();
    const prepared = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      template,
    );
    const result = createCuantoCobroCompatibleInput({ profile, template, preparedJob: prepared });
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.input.quote.client.hours.salesHours, "1");
    assert.equal(result.input.quote.client.hours.meetingsHours, "0.5");
  });
});
