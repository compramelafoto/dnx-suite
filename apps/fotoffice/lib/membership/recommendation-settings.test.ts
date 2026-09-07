import { describe, expect, it } from "vitest";
import { DEFAULT_DUES_SETTINGS, parseRecommendationPercent } from "./settings";

describe("configuración de recomendaciones", () => {
  it("el módulo arranca apagado y con la cuota entera como beneficio", () => {
    expect(DEFAULT_DUES_SETTINGS.recommendationEnabled).toBe(false);
    expect(DEFAULT_DUES_SETTINGS.recommendationBenefitPercent).toBe(100);
  });
});

describe("parseRecommendationPercent", () => {
  it("acepta un entero entre 0 y 100", () => {
    expect(parseRecommendationPercent("50")).toEqual({ ok: true, value: 50 });
  });

  it("acepta dos decimales y la coma como separador", () => {
    expect(parseRecommendationPercent("33,33")).toEqual({ ok: true, value: 33.33 });
  });

  it("rechaza más de 100: no se bonifica más que la cuota", () => {
    expect(parseRecommendationPercent("120").ok).toBe(false);
  });

  it("rechaza negativos", () => {
    expect(parseRecommendationPercent("-5").ok).toBe(false);
  });

  it("rechaza lo que no es un número", () => {
    expect(parseRecommendationPercent("mitad").ok).toBe(false);
  });
});
