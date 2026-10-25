// lib/course-marketplace/cobros.test.ts
import { describe, expect, it } from "vitest";
import { HORAS_PENDIENTE_VIGENTE, centavosDeDecimal, desdePendientesVigentes, resumirGrupos, type GrupoCobro } from "./cobros";

const grupo = (p: Partial<GrupoCobro>): GrupoCobro => ({
  cursoId: "c1",
  curso: "Retrato",
  estado: "APPROVED",
  ventas: 1,
  montoCentavos: 10_000_000,
  ...p,
});

describe("resumen de Cobros (desde los grupos de la base)", () => {
  it("suma lo cobrado y lo pendiente por separado", () => {
    const r = resumirGrupos([grupo({}), grupo({ estado: "PENDING", montoCentavos: 500 })], 0);
    expect(r.cobradoCentavos).toBe(10_000_000);
    expect(r.pendienteCentavos).toBe(500);
    expect(r.ventasAprobadas).toBe(1);
  });

  it("lo vendido es lo que pagaron los alumnos, llega aparte y no se recalcula", () => {
    expect(resumirGrupos([grupo({})], 10_500_000).vendidoCentavos).toBe(10_500_000);
  });

  it("los totales no dependen de cuántas filas se muestren: 1000 ventas en un grupo", () => {
    const r = resumirGrupos([grupo({ ventas: 1000, montoCentavos: 1000 * 2_500 })], 0);
    expect(r).toMatchObject({ cobradoCentavos: 2_500_000, ventasAprobadas: 1000 });
  });

  it("rechazados y cancelados no suman", () => {
    const r = resumirGrupos([grupo({ estado: "REJECTED" }), grupo({ cursoId: "c9", estado: "CANCELLED" })], 0);
    expect(r).toMatchObject({ cobradoCentavos: 0, pendienteCentavos: 0, ventasAprobadas: 0, vendidoCentavos: 0, porCurso: [] });
  });

  it("agrupa por curso (por id, aunque dos se llamen igual), de mayor a menor", () => {
    const r = resumirGrupos(
      [
        grupo({ cursoId: "c1", curso: "Retrato", ventas: 2, montoCentavos: 200 }),
        grupo({ cursoId: "c2", curso: "Paisaje", ventas: 1, montoCentavos: 300 }),
        grupo({ cursoId: "c1", curso: "Retrato", estado: "PENDING", ventas: 4, montoCentavos: 900 }),
      ],
      0,
    );
    expect(r.porCurso).toEqual([
      { cursoId: "c2", curso: "Paisaje", ventas: 1, cobradoCentavos: 300 },
      { cursoId: "c1", curso: "Retrato", ventas: 2, cobradoCentavos: 200 },
    ]);
  });
});

describe("centavosDeDecimal", () => {
  it("convierte el texto de la base sin float", () => {
    expect(centavosDeDecimal("1234.56")).toBe(123_456);
    expect(centavosDeDecimal("0.1")).toBe(10);
    expect(centavosDeDecimal("100")).toBe(10_000);
    expect(centavosDeDecimal("-5.05")).toBe(-505);
    expect(centavosDeDecimal(null)).toBe(0);
  });
});

describe("pendientes vigentes", () => {
  it("sólo cuentan las inscripciones pendientes de las últimas 48 horas", () => {
    expect(HORAS_PENDIENTE_VIGENTE).toBe(48);
    const ahora = new Date("2026-10-05T12:00:00.000Z");
    expect(desdePendientesVigentes(ahora).toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });
});
