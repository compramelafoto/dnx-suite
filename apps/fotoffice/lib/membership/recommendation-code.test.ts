import { describe, expect, it } from "vitest";
import {
  RECOMMENDATION_CODE_ALPHABET,
  RECOMMENDATION_CODE_LENGTH,
  generateRecommendationCode,
  normalizeRecommendationCode,
} from "./recommendation-code";

/** Bytes previsibles: el test no puede depender del azar. */
function bytesFijos(valores: number[]): (n: number) => Uint8Array {
  return (n) => Uint8Array.from(Array.from({ length: n }, (_, i) => valores[i % valores.length] ?? 0));
}

describe("generateRecommendationCode", () => {
  it("devuelve un código del largo esperado", () => {
    const code = generateRecommendationCode(bytesFijos([0, 1, 2, 3, 4]));
    expect(code).toHaveLength(RECOMMENDATION_CODE_LENGTH);
  });

  it("usa solo el alfabeto sin caracteres ambiguos", () => {
    const code = generateRecommendationCode(bytesFijos([7, 250, 13, 99, 128]));
    for (const ch of code) expect(RECOMMENDATION_CODE_ALPHABET).toContain(ch);
  });

  it("no contiene los caracteres que se confunden al dictarlos", () => {
    for (const ambiguo of ["0", "O", "1", "I", "L"]) {
      expect(RECOMMENDATION_CODE_ALPHABET).not.toContain(ambiguo);
    }
  });
});

describe("normalizeRecommendationCode", () => {
  it("acepta el código tal cual", () => {
    expect(normalizeRecommendationCode("ABCDEFGHJK")).toBe("ABCDEFGHJK");
  });

  it("tolera minúsculas y espacios: se copia y se pega a mano", () => {
    expect(normalizeRecommendationCode("  abcdefghjk  ")).toBe("ABCDEFGHJK");
  });

  it("rechaza un largo distinto", () => {
    expect(normalizeRecommendationCode("ABC")).toBeNull();
  });

  it("rechaza caracteres fuera del alfabeto", () => {
    expect(normalizeRecommendationCode("ABCDEFGHJ0")).toBeNull();
  });

  it("vacío o ausente es null, no un error", () => {
    expect(normalizeRecommendationCode(null)).toBeNull();
    expect(normalizeRecommendationCode("")).toBeNull();
    expect(normalizeRecommendationCode(undefined)).toBeNull();
  });
});
