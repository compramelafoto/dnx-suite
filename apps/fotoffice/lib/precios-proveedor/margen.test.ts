import { describe, expect, it } from "vitest";
import { calibrarMargenPct, margenValido, precioSugeridoMinor } from "./margen";
import { TRAMOS_POR_OMISION } from "./redondeo";

describe("precioSugeridoMinor", () => {
  it("costo × (1 + margen) redondeado hacia arriba", () => {
    // 2.650 × 2,7 = 7.155 → 7.500
    expect(precioSugeridoMinor(265_000, 170, TRAMOS_POR_OMISION)).toBe(750_000);
  });
  it("margen 0 deja el costo redondeado", () => {
    expect(precioSugeridoMinor(60_000, 0, TRAMOS_POR_OMISION)).toBe(60_000);
  });
});

describe("calibrarMargenPct", () => {
  it("deduce el margen del precio actual, a dos decimales", () => {
    expect(calibrarMargenPct(720_000, 265_000)).toBe(171.7);
    expect(calibrarMargenPct(1_980_000, 760_000)).toBe(160.53);
  });
  it("sin costo o con costo 0 no se puede calibrar", () => {
    expect(calibrarMargenPct(100, 0)).toBeNull();
    expect(calibrarMargenPct(100, null)).toBeNull();
  });
});

describe("margenValido", () => {
  it("entra en la columna Decimal(7,2) y en el tope de 9999 %", () => {
    expect(margenValido(170)).toBe(true);
    expect(margenValido(-20)).toBe(true);
    expect(margenValido(271_598)).toBe(false);
    expect(margenValido(-100)).toBe(false);
  });
});
