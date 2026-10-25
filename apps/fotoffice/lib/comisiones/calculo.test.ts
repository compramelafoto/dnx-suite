import { describe, expect, it } from "vitest";
import { calcularComisiones, cobradoEnteroEl, inicioDelMesEnArgentina, resumir, type PedidoComision } from "./calculo";

const d = (s: string) => new Date(s);
const reglas = [{ userId: 997, porcentaje: 10, desde: d("2026-10-24T00:00:00Z") }];
const pedido = (extra: Partial<PedidoComision>): PedidoComision => ({
  id: "p1",
  numero: "P-1",
  vendedorId: 997,
  creado: d("2026-10-24T15:00:00Z"),
  estado: "CONFIRMADO",
  totalMinor: 65_500_000,
  renglones: [{ nombre: "Fotolibro Gold 30x45", baseMinor: 52_900_000 }, { nombre: "Caja", baseMinor: 12_600_000 }],
  cobros: [{ montoMinor: 32_750_000, fecha: d("2026-10-24T15:00:00Z") }],
  ...extra,
});

describe("comisión de fotolibros", () => {
  it("10 % del precio de venta, a cobrar mientras el pedido tiene saldo", () => {
    const [c] = calcularComisiones(reglas, [pedido({})], []);
    expect(c!.comisionMinor).toBe(6_550_000);
    expect(c!.ganadaEl).toBeNull();
  });
  it("se gana el día del cobro que completa el total", () => {
    const fin = d("2026-11-02T18:00:00Z");
    const [c] = calcularComisiones(reglas, [pedido({ cobros: [{ montoMinor: 32_750_000, fecha: d("2026-10-24T15:00:00Z") }, { montoMinor: 32_750_000, fecha: fin }] })], []);
    expect(c!.ganadaEl).toEqual(fin);
  });
  it("no suman: otro vendedor, pedido cancelado, venta anterior a la regla", () => {
    expect(calcularComisiones(reglas, [pedido({ vendedorId: 4 })], [])).toEqual([]);
    expect(calcularComisiones(reglas, [pedido({ estado: "CANCELADO" })], [])).toEqual([]);
    expect(calcularComisiones(reglas, [pedido({ creado: d("2026-10-20T12:00:00Z") })], [])).toEqual([]);
  });
  it("una venta del mostrador se gana al instante", () => {
    const [c] = calcularComisiones(reglas, [], [{ id: "v1", numero: "12", vendedorId: 997, fecha: d("2026-10-25T12:00:00Z"), renglones: [{ nombre: "Caja", baseMinor: 12_600_000 }] }]);
    expect(c!.comisionMinor).toBe(1_260_000);
    expect(c!.ganadaEl).toEqual(d("2026-10-25T12:00:00Z"));
  });
  it("resumen: el mes, el total y lo que espera saldo", () => {
    const cs = calcularComisiones(reglas, [pedido({ id: "a" }), pedido({ id: "b", cobros: [{ montoMinor: 65_500_000, fecha: d("2026-10-30T12:00:00Z") }] })], []);
    expect(resumir(cs, inicioDelMesEnArgentina(d("2026-10-31T12:00:00Z")))).toEqual({ mesMinor: 6_550_000, totalMinor: 6_550_000, aCobrarMinor: 6_550_000 });
    expect(resumir(cs, inicioDelMesEnArgentina(d("2026-11-05T12:00:00Z"))).mesMinor).toBe(0);
  });
  it("cobrado entero con un peso de tolerancia; el mes empieza a las 0 de Argentina", () => {
    expect(cobradoEnteroEl(1000_00, [{ montoMinor: 999_50, fecha: d("2026-10-01T00:00:00Z") }])).not.toBeNull();
    expect(inicioDelMesEnArgentina(d("2026-11-01T02:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});
