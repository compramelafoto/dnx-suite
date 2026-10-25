import { describe, expect, it } from "vitest";
import {
  costoSubio,
  lineaParaEscaneo,
  movimientoDeLinea,
  totalRecepcionMinor,
  validarParaConfirmar,
  type LineaBorrador,
} from "./recepcion";

const l = (o: Partial<LineaBorrador> = {}): LineaBorrador => ({
  id: "l1",
  productId: "p1",
  descripcionOriginal: "Papel",
  codigoBarras: null,
  cantidad: 1,
  enUnidadDeCompra: false,
  unidadesPorCompra: null,
  costoUnitarioMinor: null,
  origen: "LECTOR",
  ...o,
});

describe("lineaParaEscaneo", () => {
  it("suma a la primera línea del producto en unidad suelta", () => {
    const r = lineaParaEscaneo(
      [
        l({ id: "a", productId: "p2" }),
        l({ id: "b", enUnidadDeCompra: true, unidadesPorCompra: 12 }),
        l({ id: "c" }),
        l({ id: "d" }),
      ],
      "p1",
    );
    expect(r).toEqual({ accion: "sumar", lineaId: "c" });
  });
  it("crea si no hay línea suelta de ese producto", () => {
    expect(lineaParaEscaneo([], "p1")).toEqual({ accion: "crear" });
    expect(
      lineaParaEscaneo([l({ enUnidadDeCompra: true, unidadesPorCompra: 6 })], "p1"),
    ).toEqual({ accion: "crear" });
  });
});

describe("validarParaConfirmar", () => {
  it("exige al menos una línea", () => {
    expect(validarParaConfirmar([])).toEqual({ ok: false, error: "Cargá al menos un producto." });
  });
  it("exige producto en toda línea", () => {
    expect(validarParaConfirmar([l({ productId: null })])).toEqual({
      ok: false,
      error: "Hay líneas sin producto: elegilo o quitalas.",
    });
  });
  it("exige cantidad entera mayor que cero", () => {
    const e = { ok: false, error: "La cantidad tiene que ser mayor que cero." };
    expect(validarParaConfirmar([l({ cantidad: 0 })])).toEqual(e);
    expect(validarParaConfirmar([l({ cantidad: -2 })])).toEqual(e);
    expect(validarParaConfirmar([l({ cantidad: 1.5 })])).toEqual(e);
  });
  it("exige unidades por bulto si se carga en bultos", () => {
    const e = { ok: false, error: "Decí cuántas unidades trae cada bulto." };
    expect(validarParaConfirmar([l({ enUnidadDeCompra: true, unidadesPorCompra: null })])).toEqual(e);
    expect(validarParaConfirmar([l({ enUnidadDeCompra: true, unidadesPorCompra: 0 })])).toEqual(e);
  });
  it("acepta una recepción válida", () => {
    expect(
      validarParaConfirmar([l(), l({ id: "x", enUnidadDeCompra: true, unidadesPorCompra: 12 })]),
    ).toEqual({ ok: true });
  });
});

describe("movimientoDeLinea", () => {
  it("2 cajas × 12 a 2.400.000 minor ⇒ qty 24, unitCostMinor 200.000", () => {
    expect(
      movimientoDeLinea(
        l({ cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 12, costoUnitarioMinor: 2_400_000 }),
      ),
    ).toEqual({ productId: "p1", qty: 24, unitCostMinor: 200_000 });
  });
  it("unidad suelta pasa igual y sin costo queda null", () => {
    expect(movimientoDeLinea(l({ cantidad: 5 }))).toEqual({
      productId: "p1",
      qty: 5,
      unitCostMinor: null,
    });
  });
});

describe("totalRecepcionMinor", () => {
  it("suma cantidad × costo por la unidad cargada; sin costo suma 0", () => {
    expect(
      totalRecepcionMinor([
        l({ cantidad: 2, costoUnitarioMinor: 1000 }),
        l({ cantidad: 3, costoUnitarioMinor: 500 }),
        l({ cantidad: 9, costoUnitarioMinor: null }),
      ]),
    ).toBe(3500);
    expect(totalRecepcionMinor([])).toBe(0);
  });
});

describe("costoSubio", () => {
  it("sólo si había costo anterior y el nuevo es mayor", () => {
    expect(costoSubio(100, 120)).toBe(true);
    expect(costoSubio(null, 120)).toBe(false);
    expect(costoSubio(120, 100)).toBe(false);
    expect(costoSubio(100, 100)).toBe(false);
    expect(costoSubio(100, null)).toBe(false);
  });
});
