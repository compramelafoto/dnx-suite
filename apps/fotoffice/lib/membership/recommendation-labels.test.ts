import { describe, expect, it } from "vitest";
import { recommendationBenefitPhrase } from "./recommendation-labels";

describe("recommendationBenefitPhrase", () => {
  it("con el beneficio entero habla de una cuota, no de un 100%", () => {
    // "Un 100% de descuento" es la forma más larga de decir "gratis", y ninguna persona la usa.
    expect(recommendationBenefitPhrase(100)).toBe("una cuota completa sin cargo");
  });

  it("por encima de 100 sigue siendo una cuota completa: no existe regalar de más", () => {
    expect(recommendationBenefitPhrase(150)).toBe("una cuota completa sin cargo");
  });

  it("por debajo de 100 nombra el porcentaje que configuró la Secretaría", () => {
    expect(recommendationBenefitPhrase(50)).toBe("un 50% de descuento en una cuota");
  });
});
