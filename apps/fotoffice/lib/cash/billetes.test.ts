import { describe, expect, it } from "vitest";
import { totalDelConteoMinor } from "./billetes";

describe("totalDelConteoMinor", () => {
  it("suma billete por billete", () => {
    // 3 de 20.000 + 2 de 1.000 + 5 de 100 = 62.500
    expect(totalDelConteoMinor({ 20_000: 3, 1_000: 2, 100: 5 })).toBe(6_250_000);
  });

  it("suma lo suelto e ignora cantidades negativas o raras", () => {
    expect(totalDelConteoMinor({ 500: -2, 200: Number.NaN, 2_000: 1.7 }, 5_000)).toBe(205_000);
  });

  it("sin nada, cero", () => {
    expect(totalDelConteoMinor({})).toBe(0);
  });
});
