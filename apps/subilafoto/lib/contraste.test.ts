import { describe, expect, test } from "vitest";
import { contraste } from "./contraste";

describe("cálculo de contraste", () => {
  test("blanco sobre negro es el máximo posible", () => {
    expect(contraste("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
  });

  test("un color contra sí mismo no contrasta nada", () => {
    expect(contraste("#7C2BFF", "#7C2BFF")).toBeCloseTo(1, 2);
  });

  test("reconoce el hex corto", () => {
    expect(contraste("#fff", "#000")).toBeCloseTo(21, 1);
  });

  test("el amarillo de la marca sobre el púrpura profundo pasa de sobra", () => {
    expect(contraste("#FFD51F", "#200638")).toBeGreaterThan(10);
  });

  test("y sobre el blanco cálido es ilegible, como ya sabíamos", () => {
    expect(contraste("#FFD51F", "#F8F6FC")).toBeLessThan(1.5);
  });
});
