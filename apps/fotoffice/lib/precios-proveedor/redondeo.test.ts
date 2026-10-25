import { describe, expect, it } from "vitest";
import { TRAMOS_POR_OMISION, leerTramos, redondearArriba, validarTramos } from "./redondeo";

describe("redondearArriba con los tramos por omisión", () => {
  it("debajo de $5.000 va de a $100", () => {
    expect(redondearArriba(310_000, TRAMOS_POR_OMISION)).toBe(310_000);
    expect(redondearArriba(310_001, TRAMOS_POR_OMISION)).toBe(320_000);
    expect(redondearArriba(450_000, TRAMOS_POR_OMISION)).toBe(450_000);
  });
  it("de $5.000 a $20.000 va de a $500", () => {
    expect(redondearArriba(720_000, TRAMOS_POR_OMISION)).toBe(750_000);
    expect(redondearArriba(500_000, TRAMOS_POR_OMISION)).toBe(500_000);
  });
  it("desde $20.000 va de a $1.000", () => {
    expect(redondearArriba(2_700_000, TRAMOS_POR_OMISION)).toBe(2_700_000);
    expect(redondearArriba(2_760_000, TRAMOS_POR_OMISION)).toBe(2_800_000);
  });
  it("un precio que al redondear cruza de tramo no baja", () => {
    // $19.999,99 → tramo de $500 → $20.000
    expect(redondearArriba(1_999_999, TRAMOS_POR_OMISION)).toBe(2_000_000);
  });
});

describe("validarTramos / leerTramos", () => {
  it("acepta tramos crecientes que arrancan en 0", () => {
    expect(validarTramos([{ desdeMinor: 0, multiploMinor: 10_000 }])).toEqual({ ok: true, tramos: [{ desdeMinor: 0, multiploMinor: 10_000 }] });
  });
  it("rechaza múltiplo 0, desorden o primer tramo distinto de 0", () => {
    expect(validarTramos([{ desdeMinor: 0, multiploMinor: 0 }]).ok).toBe(false);
    expect(validarTramos([{ desdeMinor: 100, multiploMinor: 100 }]).ok).toBe(false);
    expect(validarTramos([{ desdeMinor: 0, multiploMinor: 100 }, { desdeMinor: 0, multiploMinor: 500 }]).ok).toBe(false);
    expect(validarTramos("x").ok).toBe(false);
  });
  it("lo inválido se lee como los tramos por omisión", () => {
    expect(leerTramos(null)).toEqual(TRAMOS_POR_OMISION);
  });
});
