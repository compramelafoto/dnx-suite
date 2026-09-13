import { describe, expect, it } from "vitest";
import {
  canCloseShift,
  canOpenShift,
  expectedAmountMinor,
  parseOpeningAmountMinor,
  shiftDifferenceMinor,
} from "./shift";

describe("expectedAmountMinor", () => {
  it("sin movimientos, lo esperado es lo que se declaró al abrir", () => {
    expect(expectedAmountMinor({ openingMinor: 500_00, movements: [] })).toBe(500_00);
  });

  it("los ingresos suman y los egresos restan", () => {
    const r = expectedAmountMinor({
      openingMinor: 1_000_00,
      movements: [
        { kind: "INGRESO", amountMinor: 250_00 },
        { kind: "EGRESO", amountMinor: 100_00 },
        { kind: "INGRESO", amountMinor: 50_50 },
      ],
    });
    expect(r).toBe(1_200_50);
  });

  it("puede dar negativo y no se recorta a cero: un faltante hay que verlo", () => {
    const r = expectedAmountMinor({
      openingMinor: 0,
      movements: [{ kind: "EGRESO", amountMinor: 300_00 }],
    });
    expect(r).toBe(-300_00);
  });

  it("los centavos no se pierden sumando muchos movimientos chicos", () => {
    const movimientos = Array.from({ length: 300 }, () => ({
      kind: "INGRESO" as const,
      amountMinor: 10_33,
    }));
    expect(expectedAmountMinor({ openingMinor: 0, movements: movimientos })).toBe(309_900);
  });
});

describe("shiftDifferenceMinor", () => {
  it("contar de más da diferencia positiva", () => {
    expect(shiftDifferenceMinor(1_000_00, 1_050_00)).toBe(50_00);
  });

  it("contar de menos da diferencia negativa", () => {
    expect(shiftDifferenceMinor(1_000_00, 990_00)).toBe(-10_00);
  });

  it("contar exacto da cero", () => {
    expect(shiftDifferenceMinor(1_000_00, 1_000_00)).toBe(0);
  });
});

describe("canCloseShift", () => {
  it("un turno cuadrado se cierra sin explicación", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: 0, note: null })).toEqual({ ok: true });
  });

  it("una diferencia sin explicar no se puede cerrar", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: -50_00, note: null })).toEqual({
      ok: false,
      error: "La caja no cuadra. Explicá la diferencia antes de cerrar.",
    });
  });

  it("una diferencia con explicación se cierra", () => {
    expect(
      canCloseShift({ status: "ABIERTO", differenceMinor: -50_00, note: "Vuelto mal dado" }),
    ).toEqual({ ok: true });
  });

  it("una explicación en blanco no cuenta como explicación", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: 20_00, note: "   " })).toEqual({
      ok: false,
      error: "La caja no cuadra. Explicá la diferencia antes de cerrar.",
    });
  });

  it("un turno ya cerrado no se vuelve a cerrar", () => {
    expect(canCloseShift({ status: "CERRADO", differenceMinor: 0, note: null })).toEqual({
      ok: false,
      error: "Ese turno ya está cerrado.",
    });
  });
});

describe("canOpenShift", () => {
  it("una cuenta de efectivo sin turno abierto se puede abrir", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: false, openShiftExists: false })).toEqual({
      ok: true,
    });
  });

  it("no se abre un segundo turno en la misma cuenta", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: false, openShiftExists: true })).toEqual({
      ok: false,
      error: "Esa caja ya tiene un turno abierto.",
    });
  });

  it("una cuenta digital no se arquea", () => {
    expect(canOpenShift({ accountKind: "DIGITAL", isVault: false, openShiftExists: false })).toEqual({
      ok: false,
      error: "Mercado Pago y el banco se concilian, no se cuentan: no llevan turno.",
    });
  });

  it("la caja fuerte no lleva turno diario", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: true, openShiftExists: false })).toEqual({
      ok: false,
      error: "La caja fuerte no se abre por jornada. Se cuenta con un arqueo cuando quieras.",
    });
  });
});

describe("parseOpeningAmountMinor", () => {
  it("un importe bien escrito se interpreta normalmente", () => {
    expect(parseOpeningAmountMinor("20.000,50")).toEqual({ ok: true, value: 2_000_050 });
  });

  it("vacío es un cero declarado a propósito, no un error", () => {
    expect(parseOpeningAmountMinor("")).toEqual({ ok: true, value: 0 });
  });

  it("sólo espacios también cuenta como vacío", () => {
    expect(parseOpeningAmountMinor("   ")).toEqual({ ok: true, value: 0 });
  });

  it("un texto que no es un importe se rechaza en vez de abrir en cero", () => {
    // Antes de este arreglo, esto abría el turno en $0 en silencio y el cierre marcaba un
    // faltante por todo el fondo inicial sin que nadie entendiera por qué.
    expect(parseOpeningAmountMinor("abc")).toEqual({
      ok: false,
      error: "El importe de apertura no se entiende.",
    });
  });

  it("un importe negativo también se rechaza", () => {
    expect(parseOpeningAmountMinor("-500")).toEqual({
      ok: false,
      error: "El importe de apertura no se entiende.",
    });
  });
});
