// lib/course-marketplace/cobros.test.ts
import { describe, expect, it } from "vitest";
import { resumirCobros, type FilaCobro } from "./cobros";

const fila = (p: Partial<FilaCobro>): FilaCobro => ({
  id: "s1",
  enrollmentId: "e1",
  kind: "BENEFICIARIO",
  montoCentavos: 10_000_000,
  pagaElAlumnoCentavos: 10_500_000,
  curso: "Retrato",
  fecha: new Date("2026-10-05T15:00:00Z"),
  estadoPago: "APPROVED",
  vendioEsteNegocio: true,
  ...p,
});

describe("resumen de Cobros", () => {
  it("suma lo cobrado y lo pendiente por separado", () => {
    const r = resumirCobros([fila({}), fila({ id: "s2", enrollmentId: "e2", estadoPago: "PENDING", montoCentavos: 500 })]);
    expect(r.cobradoCentavos).toBe(10_000_000);
    expect(r.pendienteCentavos).toBe(500);
    expect(r.ventasAprobadas).toBe(1);
  });

  it("lo vendido cuenta cada venta una vez y sólo las de este negocio", () => {
    const r = resumirCobros([
      fila({ id: "a", enrollmentId: "e1" }),
      fila({ id: "b", enrollmentId: "e1", kind: "REVENDEDOR", montoCentavos: 1 }),
      fila({ id: "c", enrollmentId: "e3", vendioEsteNegocio: false }),
    ]);
    expect(r.vendidoCentavos).toBe(10_500_000);
    expect(r.ventasAprobadas).toBe(2);
  });

  it("rechazados y cancelados no suman", () => {
    const r = resumirCobros([fila({ estadoPago: "REJECTED" }), fila({ id: "x", enrollmentId: "e9", estadoPago: "CANCELLED" })]);
    expect(r).toMatchObject({ cobradoCentavos: 0, pendienteCentavos: 0, ventasAprobadas: 0, vendidoCentavos: 0, porCurso: [] });
  });

  it("agrupa por curso, de mayor a menor", () => {
    const r = resumirCobros([
      fila({ id: "1", enrollmentId: "e1", curso: "Retrato", montoCentavos: 100 }),
      fila({ id: "2", enrollmentId: "e2", curso: "Paisaje", montoCentavos: 300 }),
      fila({ id: "3", enrollmentId: "e3", curso: "Retrato", montoCentavos: 100 }),
    ]);
    expect(r.porCurso).toEqual([
      { curso: "Paisaje", ventas: 1, cobradoCentavos: 300 },
      { curso: "Retrato", ventas: 2, cobradoCentavos: 200 },
    ]);
  });
});
