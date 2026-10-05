import { describe, expect, it } from "vitest";
import { MAX_ZONE_NAME, parsePostalCodeList, parseZoneForm } from "./zone-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    for (const valor of Array.isArray(v) ? v : [v]) fd.append(k, valor);
  }
  return fd;
}

const base = {
  name: "  Rosario y alrededores ",
  postalCodes: "2000, 2001  S2002ABC\n2000",
  provinceCodes: ["S", "X"],
  isRestOfCountry: "off",
  rateMaxGrams: ["5000", "1000", ""],
  ratePrice: ["2.500", "1500,50", ""],
};

describe("parseZoneForm", () => {
  it("todo completo → valores normalizados, escalones ordenados por peso", () => {
    expect(parseZoneForm(form(base))).toEqual({
      ok: true,
      values: {
        name: "Rosario y alrededores",
        postalCodes: ["2000", "2001", "2002"],
        provinceCodes: ["S", "X"],
        isRestOfCountry: false,
        rates: [
          { maxGrams: 1000, priceMinor: 150050 },
          { maxGrams: 5000, priceMinor: 250000 },
        ],
      },
    });
  });

  it("sin nombre o con nombre largo → error", () => {
    expect(parseZoneForm(form({ ...base, name: " " })).ok).toBe(false);
    expect(parseZoneForm(form({ ...base, name: "x".repeat(MAX_ZONE_NAME + 1) })).ok).toBe(false);
  });

  it("códigos postales inválidos → error con la lista", () => {
    const r = parseZoneForm(form({ ...base, postalCodes: "2000 abc 12 0999" }));
    expect(r).toEqual({ ok: false, error: "Estos códigos postales no son válidos: abc, 12, 0999." });
  });

  it("provincia desconocida → error", () => {
    expect(parseZoneForm(form({ ...base, provinceCodes: ["S", "Ñ"] })).ok).toBe(false);
  });

  it("sin destinos (ni CP, ni provincia, ni resto del país) → error", () => {
    const r = parseZoneForm(form({ ...base, postalCodes: "", provinceCodes: [] }));
    expect(r).toEqual({
      ok: false,
      error: "Indicá a qué destinos llega la zona: códigos postales, provincias o el resto del país.",
    });
  });

  it("sólo 'resto del país' alcanza", () => {
    const r = parseZoneForm(form({ ...base, postalCodes: "", provinceCodes: [], isRestOfCountry: ["on", "off"] }));
    expect(r.ok && r.values.isRestOfCountry).toBe(true);
  });

  it("sin escalones → error", () => {
    const r = parseZoneForm(form({ ...base, rateMaxGrams: ["", ""], ratePrice: ["", ""] }));
    expect(r).toEqual({ ok: false, error: "Cargá al menos un escalón de precio." });
  });

  it("peso repetido → error", () => {
    const r = parseZoneForm(form({ ...base, rateMaxGrams: ["1000", "1000"], ratePrice: ["10", "20"] }));
    expect(r).toEqual({ ok: false, error: "Hay dos escalones con el mismo peso (1000 g)." });
  });

  it("peso 0, negativo o con decimales → error", () => {
    for (const p of ["0", "-5", "1,5"]) {
      expect(parseZoneForm(form({ ...base, rateMaxGrams: [p], ratePrice: ["10"] })).ok, p).toBe(false);
    }
  });

  it("precio 0 vale; precio vacío o inválido en una fila con peso → error", () => {
    expect(parseZoneForm(form({ ...base, rateMaxGrams: ["1000"], ratePrice: ["0"] })).ok).toBe(true);
    expect(parseZoneForm(form({ ...base, rateMaxGrams: ["1000"], ratePrice: [""] })).ok).toBe(false);
    expect(parseZoneForm(form({ ...base, rateMaxGrams: ["1000"], ratePrice: ["-3"] })).ok).toBe(false);
    expect(parseZoneForm(form({ ...base, rateMaxGrams: [""], ratePrice: ["100"] })).ok).toBe(false);
  });
});

describe("parsePostalCodeList", () => {
  it("separa por coma, espacio, punto y coma o renglón; normaliza y saca repetidos", () => {
    expect(parsePostalCodeList(" 2000;2001,\n2000  S2002ABC ")).toEqual({ ok: true, codes: ["2000", "2001", "2002"] });
  });

  it("vacío → lista vacía", () => {
    expect(parsePostalCodeList("   ")).toEqual({ ok: true, codes: [] });
  });

  it("devuelve los inválidos", () => {
    expect(parsePostalCodeList("2000 xx")).toEqual({ ok: false, invalid: ["xx"] });
  });
});
