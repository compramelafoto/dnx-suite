import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_POSITIONING_OPTIONS,
  computeMinimumSustainablePrice,
  computeRecommendedBusinessPrice,
  DEFAULT_COMMERCIAL_POSITIONING_ID,
  getCommercialPositioningFactor,
  getEffectiveCommercialPositioningId,
} from "./commercial-positioning";

describe("commercial positioning", () => {
  const minimumSustainable = 100_000;

  it("usa negocio estable por defecto si no hay selección", () => {
    expect(getEffectiveCommercialPositioningId("")).toBe(DEFAULT_COMMERCIAL_POSITIONING_ID);
    expect(getCommercialPositioningFactor("")).toBe(1.25);
    expect(computeRecommendedBusinessPrice(minimumSustainable, "")).toBe(125_000);
  });

  it("Estoy comenzando devuelve recomendado igual al mínimo sostenible", () => {
    const recommended = computeRecommendedBusinessPrice(minimumSustainable, "starting");
    expect(recommended).toBe(minimumSustainable);
    expect(recommended).toBeGreaterThanOrEqual(minimumSustainable);
  });

  it("Estoy creciendo aplica recomendación superior al mínimo", () => {
    const recommended = computeRecommendedBusinessPrice(minimumSustainable, "growing");
    expect(recommended).toBeGreaterThan(minimumSustainable);
    expect(recommended).toBe(110_000);
  });

  it("el precio recomendado nunca es menor al mínimo sostenible", () => {
    for (const option of COMMERCIAL_POSITIONING_OPTIONS) {
      const minimum = computeMinimumSustainablePrice(250_000);
      const recommended = computeRecommendedBusinessPrice(minimum, option.id);
      expect(recommended).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("mantiene el cálculo actual como precio mínimo sostenible", () => {
    const legacyRecommendedPrice = 380_000;
    expect(computeMinimumSustainablePrice(legacyRecommendedPrice)).toBe(380_000);
  });

  it("no usa factores menores a 1", () => {
    for (const option of COMMERCIAL_POSITIONING_OPTIONS) {
      expect(option.factor).toBeGreaterThanOrEqual(1);
    }
  });
});
