import { describe, expect, it } from "vitest";
import { buildPackage, exceedsCorreoLimits, normalizePostalCode } from "./package";

const cfg = { packagingGrams: 100, defaultUnitGrams: 300, boxLengthCm: 30, boxWidthCm: 20, boxHeightCm: 10 };
const item = (o: Partial<Parameters<typeof buildPackage>[0][number]> = {}) => ({
  qty: 1, weightGrams: null, lengthCm: null, widthCm: null, heightCm: null, ...o,
});

describe("normalizePostalCode", () => {
  it("acepta 4 dígitos con espacios", () => {
    expect(normalizePostalCode("2000")).toBe("2000");
    expect(normalizePostalCode(" 2000 ")).toBe("2000");
  });
  it("convierte CPA a 4 dígitos", () => {
    expect(normalizePostalCode("S2000ABC")).toBe("2000");
    expect(normalizePostalCode("s2000abc")).toBe("2000");
  });
  it("rechaza lo demás", () => {
    for (const x of ["", "200", "20000", "0999", "ABCD", "S2000AB", "2000ABC", "1234-5", "S20000ABC"]) {
      expect(normalizePostalCode(x)).toBeNull();
    }
  });
});

describe("buildPackage", () => {
  it("suma peso por cantidad más embalaje", () => {
    const p = buildPackage([item({ qty: 2, weightGrams: 500 })], cfg);
    expect(p.weightGrams).toBe(1100);
  });
  it("usa el peso por defecto si el producto no tiene peso", () => {
    expect(buildPackage([item({ qty: 2 })], cfg).weightGrams).toBe(700);
  });
  it("un peso 0 cargado cuenta como cargado (no usa el defecto)", () => {
    expect(buildPackage([item({ weightGrams: 0 })], cfg).weightGrams).toBe(100);
  });
  it("sin items devuelve el embalaje, mínimo 1", () => {
    expect(buildPackage([], { ...cfg, packagingGrams: 0 }).weightGrams).toBe(1);
  });
  it("sin medidas de producto usa la caja por defecto", () => {
    const p = buildPackage([item()], cfg);
    expect([p.lengthCm, p.widthCm, p.heightCm]).toEqual([30, 20, 10]);
  });
  it("medidas menores que la caja no la achican; el alto suma por cantidad", () => {
    const p = buildPackage([item({ qty: 2, lengthCm: 10, widthCm: 10, heightCm: 3 })], cfg);
    expect([p.lengthCm, p.widthCm, p.heightCm]).toEqual([30, 20, 10]);
  });
  it("medidas mayores que la caja la agrandan: máximo de largo/ancho y suma de altos", () => {
    const p = buildPackage(
      [
        item({ qty: 2, lengthCm: 40, widthCm: 15, heightCm: 4 }),
        item({ qty: 1, lengthCm: 20, widthCm: 25, heightCm: 5 }),
      ],
      cfg,
    );
    expect([p.lengthCm, p.widthCm, p.heightCm]).toEqual([40, 25, 13]);
  });
  it("ignora productos con medidas incompletas", () => {
    const p = buildPackage([item({ lengthCm: 99, widthCm: 99, heightCm: null })], cfg);
    expect([p.lengthCm, p.widthCm, p.heightCm]).toEqual([30, 20, 10]);
  });
  it("redondea hacia arriba los fraccionarios y deja enteros ≥ 1", () => {
    const p = buildPackage(
      [item({ weightGrams: 10.2, lengthCm: 0.2, widthCm: 0.2, heightCm: 0.2 })],
      { packagingGrams: 0.5, defaultUnitGrams: 1, boxLengthCm: 0, boxWidthCm: 0.1, boxHeightCm: 0 },
    );
    expect(p).toEqual({ weightGrams: 11, lengthCm: 1, widthCm: 1, heightCm: 1 });
  });
});

describe("exceedsCorreoLimits", () => {
  const ok = { weightGrams: 25000, lengthCm: 150, widthCm: 10, heightCm: 10 };
  it("en el límite exacto no excede", () => expect(exceedsCorreoLimits(ok)).toBe(false));
  it("peso mayor excede", () => expect(exceedsCorreoLimits({ ...ok, weightGrams: 25001 })).toBe(true));
  it("cualquier lado mayor excede", () => {
    expect(exceedsCorreoLimits({ ...ok, lengthCm: 151 })).toBe(true);
    expect(exceedsCorreoLimits({ ...ok, widthCm: 151 })).toBe(true);
    expect(exceedsCorreoLimits({ ...ok, heightCm: 151 })).toBe(true);
  });
});
