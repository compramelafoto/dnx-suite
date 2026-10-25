import { describe, expect, it } from "vitest";
import { consumoPorRenglon, normalizarReceta, piezasPorHojaSugeridas, sugerirLineas } from "./receta";

describe("normalizarReceta", () => {
  const ok = { insumoId: "a", quantity: 2, porCada: 1 };
  it("acepta una receta válida", () => {
    expect(normalizarReceta("p", [ok])).toEqual({ ok: true, valor: [ok] });
  });
  it("rechaza el mismo insumo dos veces", () => {
    expect(normalizarReceta("p", [ok, ok])).toEqual({ ok: false, error: "Ese insumo ya está en la receta." });
  });
  it("rechaza cantidad 0 o con decimales", () => {
    const msg = "La cantidad tiene que ser un número entero mayor que cero.";
    expect(normalizarReceta("p", [{ ...ok, quantity: 0 }])).toEqual({ ok: false, error: msg });
    expect(normalizarReceta("p", [{ ...ok, quantity: 1.5 }])).toEqual({ ok: false, error: msg });
  });
  it("rechaza «cada cuántas» 0 o con decimales", () => {
    const msg = "«Cada cuántas» tiene que ser un número entero desde 1.";
    expect(normalizarReceta("p", [{ ...ok, porCada: 0 }])).toEqual({ ok: false, error: msg });
    expect(normalizarReceta("p", [{ ...ok, porCada: 1.5 }])).toEqual({ ok: false, error: msg });
  });
  it("rechaza que el insumo sea el mismo producto", () => {
    expect(normalizarReceta("a", [ok]).ok).toBe(false);
  });
});

describe("sugerirLineas", () => {
  it("HOJA: un kit por hoja", () => {
    expect(sugerirLineas({ unidad: "HOJA", piezasPorHoja: 1, consumos: [{ insumoId: "kit", quantity: 2 }] })).toEqual([
      { insumoId: "kit", quantity: 2, porCada: 1 },
    ]);
  });
  it("PIEZA: cada tantas piezas por hoja", () => {
    expect(sugerirLineas({ unidad: "PIEZA", piezasPorHoja: 2, consumos: [{ insumoId: "kit", quantity: 1 }] })).toEqual([
      { insumoId: "kit", quantity: 1, porCada: 2 },
    ]);
  });
  it("sin consumos no sugiere nada", () => {
    expect(sugerirLineas({ unidad: "HOJA", piezasPorHoja: 1, consumos: [] })).toEqual([]);
  });
});

describe("piezasPorHojaSugeridas", () => {
  it("Polaroid por pieza en hojas 10x15, 13x18 y 15x20 entra de a 2", () => {
    for (const t of ["10x15", "13x18", "15x20"])
      expect(piezasPorHojaSugeridas({ tipoPieza: "POLAROID", unidad: "PIEZA", tamanoHoja: t })).toBe(2);
  });
  it("todo lo demás es 1", () => {
    expect(piezasPorHojaSugeridas({ tipoPieza: "CARNET", unidad: "HOJA", tamanoHoja: "10x15" })).toBe(1);
    expect(piezasPorHojaSugeridas({ tipoPieza: "COPIA", unidad: "COPIA", tamanoHoja: "10x15" })).toBe(1);
    expect(piezasPorHojaSugeridas({ tipoPieza: "POLAROID", unidad: "PIEZA", tamanoHoja: "20x30" })).toBe(1);
  });
});

describe("consumoPorRenglon", () => {
  it("redondea para arriba por renglón", () => {
    expect(consumoPorRenglon(3, { quantity: 1, porCada: 2 })).toBe(2);
    expect(consumoPorRenglon(4, { quantity: 2, porCada: 2 })).toBe(4);
  });
});
