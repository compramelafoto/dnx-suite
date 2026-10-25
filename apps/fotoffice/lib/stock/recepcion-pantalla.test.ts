import { describe, expect, it } from "vitest";
import type { LineaBorrador } from "./recepcion";
import { costoPorUnidadDeStock, diaParaInput, fechaDesdeInput, unidadesDeStock } from "./recepcion-pantalla";

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

describe("unidadesDeStock", () => {
  it("suma las cantidades sueltas tal cual", () => {
    expect(unidadesDeStock([l({ cantidad: 3 }), l({ cantidad: 2 })])).toBe(5);
  });

  it("pasa los bultos a unidades de stock", () => {
    expect(unidadesDeStock([l({ cantidad: 2, enUnidadDeCompra: true, unidadesPorCompra: 12 }), l({ cantidad: 1 })])).toBe(25);
  });

  it("sin líneas es cero", () => {
    expect(unidadesDeStock([])).toBe(0);
  });
});

describe("costoPorUnidadDeStock", () => {
  it("suelto: el mismo costo", () => {
    expect(costoPorUnidadDeStock(l({ costoUnitarioMinor: 1500 }))).toBe(1500);
  });

  it("en bultos: el costo del bulto repartido y redondeado", () => {
    expect(costoPorUnidadDeStock(l({ enUnidadDeCompra: true, unidadesPorCompra: 3, costoUnitarioMinor: 1000 }))).toBe(333);
  });

  it("sin costo: null", () => {
    expect(costoPorUnidadDeStock(l({ enUnidadDeCompra: true, unidadesPorCompra: 3 }))).toBeNull();
  });
});

describe("fechas del encabezado", () => {
  it("el día elegido queda al mediodía de Buenos Aires (15:00 UTC)", () => {
    expect(fechaDesdeInput("2026-10-21")?.toISOString()).toBe("2026-10-21T15:00:00.000Z");
  });

  it("un texto que no es fecha da null", () => {
    expect(fechaDesdeInput("")).toBeNull();
    expect(fechaDesdeInput("21/10/2026")).toBeNull();
    expect(fechaDesdeInput("2026-02-31")).toBeNull();
  });

  it("el día que se muestra es el de Buenos Aires, no el de UTC", () => {
    // 01:30 UTC del 22 son las 22:30 del 21 en Buenos Aires.
    expect(diaParaInput(new Date("2026-10-22T01:30:00.000Z"))).toBe("2026-10-21");
  });

  it("ida y vuelta da el mismo día", () => {
    expect(diaParaInput(fechaDesdeInput("2026-01-05") as Date)).toBe("2026-01-05");
  });
});
