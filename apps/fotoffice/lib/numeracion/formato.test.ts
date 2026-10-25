import { describe, expect, it } from "vitest";
import { formatearNumero, validarConfigSecuencia } from "./formato";

describe("formatearNumero", () => {
  it("con año, prefijo y ceros", () => {
    expect(formatearNumero({ prefix: "P-", withYear: true, digits: 4 }, 2026, 42)).toBe("P-2026-0042");
    expect(formatearNumero({ prefix: "", withYear: true, digits: 4 }, 2026, 1)).toBe("2026-0001");
  });
  it("sin año", () => {
    expect(formatearNumero({ prefix: "", withYear: false, digits: 1 }, null, 2262)).toBe("2262");
    expect(formatearNumero({ prefix: "PED", withYear: false, digits: 3 }, null, 7)).toBe("PED007");
  });
  it("no recorta si el número tiene más dígitos", () => {
    expect(formatearNumero({ prefix: "", withYear: false, digits: 2 }, null, 12345)).toBe("12345");
  });
  it("withYear sin año usa el año vacío sin romper", () => {
    expect(formatearNumero({ prefix: "", withYear: false, digits: 4 }, 2026, 5)).toBe("0005");
  });
});

describe("validarConfigSecuencia", () => {
  const base = { prefix: "P-", withYear: true, digits: 4, nextValue: 10 };
  it("acepta y normaliza", () => {
    expect(validarConfigSecuencia({ ...base, prefix: "  P-  " }, 1)).toEqual({ ok: true, config: { prefix: "P-", withYear: true, digits: 4, nextValue: 10 } });
    expect(validarConfigSecuencia({ ...base, nextValue: "10" }, 10)).toMatchObject({ ok: true });
  });
  it("prefijo: hasta 8, letras, números y guion", () => {
    expect(validarConfigSecuencia({ ...base, prefix: "ABCDEFGH" }, 1).ok).toBe(true);
    expect(validarConfigSecuencia({ ...base, prefix: "ABCDEFGHI" }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, prefix: "P_1" }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, prefix: "Ñ" }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, prefix: "" }, 1).ok).toBe(true);
  });
  it("dígitos entre 1 y 8 y enteros", () => {
    for (const d of [0, 9, 2.5, "x", null]) expect(validarConfigSecuencia({ ...base, digits: d }, 1)).toMatchObject({ ok: false });
    for (const d of [1, 8, "3"]) expect(validarConfigSecuencia({ ...base, digits: d }, 1).ok).toBe(true);
  });
  it("el próximo no baja del mínimo", () => {
    const r = validarConfigSecuencia({ ...base, nextValue: 5 }, 8);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.error).toMatch(/ya usado/i);
    expect(validarConfigSecuencia({ ...base, nextValue: 8 }, 8).ok).toBe(true);
    expect(validarConfigSecuencia({ ...base, nextValue: 0 }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, nextValue: 1.5 }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, nextValue: "abc" }, 1)).toMatchObject({ ok: false });
    expect(validarConfigSecuencia({ ...base, nextValue: 2_000_000_000 }, 1)).toMatchObject({ ok: false });
  });
  it("withYear debe ser booleano", () => {
    expect(validarConfigSecuencia({ ...base, withYear: "si" }, 1)).toMatchObject({ ok: false });
  });
});
