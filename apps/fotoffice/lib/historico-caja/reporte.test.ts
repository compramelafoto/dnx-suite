import { describe, expect, it } from "vitest";
import { armarLotes } from "./lote";
import { reporteEnSeco, totalesPorAnio } from "./reporte";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

const LOTES = armarLotes(
  [
    fila("2025-12-02", "CARNET", 2500),
    fila("2025-12-03", "CADETE", -1000),
    fila("2026-05-02", "CARNET", 10_000),
    fila("2026-05-04", "OTROS", 150_000),
  ],
  MAPEO_PRUEBA,
);

describe("totalesPorAnio", () => {
  it("suma ingresos, egresos del libro, estimados e internos por año", () => {
    expect(totalesPorAnio(LOTES)).toEqual([
      { anio: "2025", meses: 1, ingresosCentavos: 250_000, egresosLibroCentavos: -100_000, estimadosCentavos: 0, internosCentavos: 0, resultadoCentavos: 150_000, filasRevisar: 0 },
      {
        anio: "2026",
        meses: 1,
        ingresosCentavos: 16_000_000,
        egresosLibroCentavos: 0,
        estimadosCentavos: -45_500_000,
        internosCentavos: 0,
        resultadoCentavos: 16_000_000 - 45_500_000,
        filasRevisar: 1,
      },
    ]);
  });
});

describe("reporteEnSeco", () => {
  it("compara contra el resumen de referencia y marca las diferencias", () => {
    const md = reporteEnSeco(LOTES, {
      referencia: new Map([
        ["2025-12", { ingresosCentavos: 250_000, egresosCentavos: -100_000 }],
        ["2026-05", { ingresosCentavos: 15_000_000, egresosCentavos: 0 }],
      ]),
      generado: "2026-10-15",
    });
    expect(md).toContain("# Importación histórica de Caja — corrida en seco");
    expect(md).toMatch(/\| 2025-12 \|.*\| OK \|/);
    expect(md).toMatch(/\| 2026-05 \|.*\| DIFERENCIA/);
    expect(md).toContain("ALQUILER (ESTIMADO)");
    expect(md).toContain("Gastos fijos incompletos");
    expect(md).toContain("1 de 2 meses no coinciden");
  });

  it("sin referencia no compara", () => {
    const md = reporteEnSeco(LOTES, { generado: "2026-10-15" });
    expect(md).toContain("sin referencia");
  });
});
