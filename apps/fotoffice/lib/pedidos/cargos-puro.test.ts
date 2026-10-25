import { describe, expect, it } from "vitest";
import {
  ajustarTotales, cuotasDeCargo, itemsConPrecio, itemsSinCargo, precioDelRenglonDeCargo, saldoSinCargosMinor, sumaDeRenglonesDeCargo, totalesConCargo,
} from "./cargos-puro";

const items = [
  { id: "it-1", cantidad: 2, precioUnitario: 15000 },
  { id: "cargo-q1", cantidad: 1, precioUnitario: 3750 },
  { id: "cargo-q2", cantidad: 1, precioUnitario: 9000 },
];

describe("renglones de cargos", () => {
  it("reconoce las cuotas de cargo por su renglón", () => {
    expect([...cuotasDeCargo(items)]).toEqual(["q1", "q2"]);
    expect(cuotasDeCargo(null).size).toBe(0);
  });
  it("suma los renglones de cargo y lee el precio de uno", () => {
    expect(sumaDeRenglonesDeCargo(items)).toBe(12750);
    expect(precioDelRenglonDeCargo(items, "q2")).toBe(9000);
    expect(precioDelRenglonDeCargo(items, "zz")).toBeNull();
  });
  it("cambia el precio de un renglón o devuelve null si no está", () => {
    expect((itemsConPrecio(items, "cargo-q2", 4000) as { precioUnitario: number }[])[2]!.precioUnitario).toBe(4000);
    expect(itemsConPrecio(items, "cargo-zz", 4000)).toBeNull();
    expect(itemsSinCargo(items, "cargo-zz")).toBeNull();
  });
});

describe("totales", () => {
  const t = { subtotal: 33750, total: 33750, renglones: { "cargo-q1": { bruto: 3750, descuento: 0, neto: 3750 } }, secciones: [{ seccion: null, subtotal: 33750, opcionales: 0 }] };
  it("quitar y cambiar mueven total, subtotal, sección y renglón juntos", () => {
    expect(totalesConCargo(t, "cargo-q1", 3750, -1)).toEqual({ subtotal: 30000, total: 30000, renglones: {}, secciones: [{ seccion: null, subtotal: 30000, opcionales: 0 }] });
    expect(ajustarTotales(t, "cargo-q1", 1000, -2750)).toMatchObject({ total: 31000, renglones: { "cargo-q1": { neto: 1000 } } });
  });
});

describe("saldo sin cargos opcionales", () => {
  it("resta lo que le falta a cada cuota de cargo, con tope en el monto del cargo", () => {
    expect(saldoSinCargosMinor(375000, [{ montoMinor: 375000, cuotaMinor: 375000, imputadoMinor: 0 }])).toBe(0);
    // Pagada: no resta (el saldo es de otras cuotas).
    expect(saldoSinCargosMinor(100000, [{ montoMinor: 375000, cuotaMinor: 375000, imputadoMinor: 375000 }])).toBe(100000);
    // La cuota se agrandó a mano y absorbió 1000 pesos de otra: eso sigue contando.
    expect(saldoSinCargosMinor(475000, [{ montoMinor: 375000, cuotaMinor: 475000, imputadoMinor: 0 }])).toBe(100000);
    // Cuota que ya no está: no resta.
    expect(saldoSinCargosMinor(375000, [{ montoMinor: 375000, cuotaMinor: null, imputadoMinor: 0 }])).toBe(375000);
    expect(saldoSinCargosMinor(500, [])).toBe(500);
  });
});
