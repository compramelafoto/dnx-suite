import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createSyntheticReadyFifteenthTemplate,
  createSyntheticReadyWeddingTemplate,
} from "./__fixtures__/synthetic-ready.js";
import { preparePricingJob } from "./prepare-pricing-job.js";

describe("preparePricingJob", () => {
  it("casamiento + template listo", () => {
    const result = preparePricingJob(
      {
        serviceType: "WEDDING",
        eventDate: "2026-09-20",
        city: "Córdoba",
        durationHours: 8,
      },
      createSyntheticReadyWeddingTemplate(),
    );
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.job.coverageHours, 8);
    assert.equal(result.job.editingResolution, "HOURS_PER_COVERAGE_HOUR");
    assert.equal(result.job.editingHours, 4);
    assert.equal(result.job.eventDate, "2026-09-20");
    assert.equal(result.job.city, "Córdoba");
    assert.equal("minimumSustainablePrice" in result.job, false);
  });

  it("cumpleaños de 15 con edición fija", () => {
    const result = preparePricingJob(
      {
        serviceType: "FIFTEENTH_BIRTHDAY",
        durationHours: 6,
        city: "Rosario",
      },
      createSyntheticReadyFifteenthTemplate(),
    );
    assert.equal(result.status, "READY");
    if (result.status !== "READY") return;
    assert.equal(result.job.editingResolution, "FIXED_HOURS");
    assert.equal(result.job.editingHours, 3);
    assert.equal(result.job.city, "Rosario");
  });

  it("duración ausente", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING" },
      createSyntheticReadyWeddingTemplate(),
    );
    assert.equal(result.status, "INCOMPLETE");
    if (result.status !== "INCOMPLETE") return;
    assert.ok(result.missingFields.includes("DURATION_HOURS"));
  });

  it("template no configurado", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      createSyntheticReadyWeddingTemplate({ configured: false }),
    );
    assert.equal(result.status, "INCOMPLETE");
  });

  it("servicio UNKNOWN", () => {
    const result = preparePricingJob(
      { serviceType: "UNKNOWN", durationHours: 8 },
      createSyntheticReadyWeddingTemplate(),
    );
    assert.equal(result.status, "UNSUPPORTED");
  });

  it("duración menor al mínimo", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 2 },
      createSyntheticReadyWeddingTemplate(),
    );
    assert.equal(result.status, "INCOMPLETE");
    if (result.status !== "INCOMPLETE") return;
    assert.ok(result.missingFields.includes("DURATION_BELOW_MINIMUM"));
  });

  it("duración mayor al máximo", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 20 },
      createSyntheticReadyWeddingTemplate(),
    );
    assert.equal(result.status, "INCOMPLETE");
    if (result.status !== "INCOMPLETE") return;
    assert.ok(result.missingFields.includes("DURATION_ABOVE_MAXIMUM"));
  });

  it("edición manual", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8 },
      createSyntheticReadyWeddingTemplate({ editing: { mode: "MANUAL" } }),
    );
    assert.equal(result.status, "INCOMPLETE");
    if (result.status !== "INCOMPLETE") return;
    assert.ok(result.missingFields.includes("EDITING_MANUAL_PENDING"));
  });

  it("no genera montos", () => {
    const result = preparePricingJob(
      { serviceType: "WEDDING", durationHours: 8, eventDate: "2026-01-01" },
      createSyntheticReadyWeddingTemplate(),
    );
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("minimumSustainable"), false);
    assert.equal(serialized.includes("recommendedBusiness"), false);
    assert.equal(serialized.includes("directCost"), false);
  });
});
