import { describe, expect, it } from "vitest";
import { adjustmentQty, needsRestock, stockQtyFrom, validateAdjustment, validateStockEntry } from "./stock";

describe("stockQtyFrom", () => {
  it("sin movimientos, la existencia es cero", () => {
    expect(stockQtyFrom([])).toBe(0);
  });

  it("suma las entradas y resta las ventas", () => {
    expect(stockQtyFrom([{ qty: 10 }, { qty: -3 }, { qty: -2 }])).toBe(5);
  });

  it("puede dar negativo y NO se recorta a cero: eso es información", () => {
    // Un negativo significa que falta cargar una entrada. Mostrarlo como cero
    // escondería justo el dato que hay que corregir.
    expect(stockQtyFrom([{ qty: -3 }])).toBe(-3);
  });
});

describe("needsRestock", () => {
  it("por debajo del mínimo, hay que reponer", () => {
    expect(needsRestock({ tracksStock: true, stockQty: 1, minStockQty: 3 })).toBe(true);
  });

  it("justo en el mínimo todavía no", () => {
    expect(needsRestock({ tracksStock: true, stockQty: 3, minStockQty: 3 })).toBe(false);
  });

  it("en negativo, siempre", () => {
    expect(needsRestock({ tracksStock: true, stockQty: -2, minStockQty: null })).toBe(true);
  });

  it("sin mínimo declarado, sólo el negativo avisa", () => {
    expect(needsRestock({ tracksStock: true, stockQty: 0, minStockQty: null })).toBe(false);
  });

  it("un producto que no controla stock nunca avisa", () => {
    expect(needsRestock({ tracksStock: false, stockQty: -99, minStockQty: 1 })).toBe(false);
  });
});

describe("adjustmentQty", () => {
  it("contar de más suma la diferencia", () => {
    expect(adjustmentQty({ currentQty: 5, countedQty: 8 })).toBe(3);
  });

  it("contar de menos resta la diferencia", () => {
    expect(adjustmentQty({ currentQty: 5, countedQty: 2 })).toBe(-3);
  });

  it("contar lo mismo no mueve nada", () => {
    expect(adjustmentQty({ currentQty: 5, countedQty: 5 })).toBe(0);
  });

  it("desde un negativo, el ajuste lo lleva a lo contado", () => {
    expect(adjustmentQty({ currentQty: -2, countedQty: 4 })).toBe(6);
  });
});

describe("validateStockEntry", () => {
  it("una entrada normal se acepta", () => {
    expect(validateStockEntry({ qty: 10, unitCostMinor: 800_00 })).toEqual({ ok: true });
  });

  it("una entrada sin costo se acepta: no siempre se sabe", () => {
    expect(validateStockEntry({ qty: 10, unitCostMinor: null })).toEqual({ ok: true });
  });

  it("una cantidad de cero o negativa se rechaza: para restar está el ajuste", () => {
    expect(validateStockEntry({ qty: 0, unitCostMinor: null })).toEqual({
      ok: false,
      error: "La cantidad que entró tiene que ser mayor que cero.",
    });
    expect(validateStockEntry({ qty: -5, unitCostMinor: null }).ok).toBe(false);
  });

  it("un costo negativo se rechaza", () => {
    expect(validateStockEntry({ qty: 1, unitCostMinor: -100 })).toEqual({
      ok: false,
      error: "El costo no puede ser negativo.",
    });
  });
});

describe("validateAdjustment", () => {
  it("un ajuste con nota se acepta", () => {
    expect(validateAdjustment({ countedQty: 7, note: "Conteo de fin de mes" })).toEqual({ ok: true });
  });

  it("sin nota NO se acepta: un ajuste sin explicar no se entiende después", () => {
    expect(validateAdjustment({ countedQty: 7, note: null })).toEqual({
      ok: false,
      error: "Explicá por qué ajustás la existencia.",
    });
  });

  it("una nota en blanco no cuenta como explicación", () => {
    expect(validateAdjustment({ countedQty: 7, note: "   " }).ok).toBe(false);
  });

  it("contar cero es válido: se acabó", () => {
    expect(validateAdjustment({ countedQty: 0, note: "No queda ninguno" })).toEqual({ ok: true });
  });

  it("una cantidad contada negativa se rechaza: no se pueden contar menos de cero cosas", () => {
    expect(validateAdjustment({ countedQty: -1, note: "raro" })).toEqual({
      ok: false,
      error: "No podés contar una cantidad negativa.",
    });
  });
});
