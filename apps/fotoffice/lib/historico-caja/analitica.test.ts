import { describe, expect, it } from "vitest";
import {
  egresosPorClase,
  filasAnaliticasDeLotes,
  ingresosPorLinea,
  mesesCerradosAnteriores,
  promedioFijos,
  puntoDeEquilibrio,
  type FilaAnalitica,
} from "./analitica";
import { armarLotes } from "./lote";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

function f(mes: string, clase: FilaAnalitica["clase"], rubroCodigo: string | null, centavos: number, estimado = false): FilaAnalitica {
  return { mes, clase, rubroCodigo, rubroNombre: rubroCodigo ? `Rubro ${rubroCodigo}` : null, centavos, estimado };
}

const FILAS: FilaAnalitica[] = [
  f("2026-06", "INGRESO", "3.1", 1_000_00),
  f("2026-06", "INGRESO", "3.2", 500_00),
  f("2026-07", "INGRESO", "3.1", 2_000_00),
  f("2026-07", "INGRESO", "3.1", -100_00),
  f("2026-06", "COSTO_VARIABLE", "4.1", -300_00),
  f("2026-07", "COSTO_VARIABLE", "4.1", -200_00),
  f("2026-06", "GASTO_FIJO", "5.1", -400_00, true),
  f("2026-07", "GASTO_FIJO", "5.1", -400_00, true),
  f("2026-08", "GASTO_FIJO", "5.1", -400_00, true),
  f("2026-08", "GASTO_FIJO", "5.11", -80_00),
  f("2026-07", "RETIRO_DUENO", "6.1", -50_00),
  f("2026-07", "MOVIMIENTO_INTERNO", "0.1", -999_00),
];

describe("ingresosPorLinea", () => {
  it("suma por línea (rubro 3…) y mes, neto de correcciones", () => {
    const r = ingresosPorLinea(FILAS);
    expect(r.meses).toEqual(["2026-06", "2026-07"]);
    expect(r.lineas).toEqual([
      { codigo: "3.1", nombre: "Rubro 3.1", porMes: [1_000_00, 1_900_00], total: 2_900_00 },
      { codigo: "3.2", nombre: "Rubro 3.2", porMes: [500_00, 0], total: 500_00 },
    ]);
    expect(r.totalPorMes).toEqual([1_500_00, 1_900_00]);
  });
});

describe("egresosPorClase", () => {
  it("egresos en positivo por clase y mes; sin internos", () => {
    const r = egresosPorClase(FILAS);
    expect(r.meses).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(r.clases).toEqual([
      { clase: "COSTO_VARIABLE", porMes: [300_00, 200_00, 0], total: 500_00, estimadoPorMes: [0, 0, 0] },
      { clase: "GASTO_FIJO", porMes: [400_00, 400_00, 480_00], total: 1_280_00, estimadoPorMes: [400_00, 400_00, 400_00] },
      { clase: "RETIRO_DUENO", porMes: [0, 50_00, 0], total: 50_00, estimadoPorMes: [0, 0, 0] },
    ]);
  });
});

describe("mesesCerradosAnteriores", () => {
  it("los N meses antes del actual", () => {
    expect(mesesCerradosAnteriores("2026-02", 3)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("promedioFijos", () => {
  it("promedio real de los últimos 3 meses cerrados, marcando estimados", () => {
    const r = promedioFijos(FILAS, { mesActual: "2026-09" });
    expect(r.meses).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(r.promedioCentavos).toBe(Math.round((400_00 + 400_00 + 480_00) / 3));
    expect(r.incluyeEstimados).toBe(true);
    expect(r.mesesSinDatos).toEqual([]);
    expect(r.mesesIncompletos).toEqual([]);
  });

  it("marca los meses sin datos y los que tienen fijos incompletos", () => {
    const r = promedioFijos(FILAS, { mesActual: "2026-07", incompletos: new Set(["2026-06"]) });
    expect(r.meses).toEqual(["2026-04", "2026-05", "2026-06"]);
    expect(r.mesesSinDatos).toEqual(["2026-04", "2026-05"]);
    expect(r.mesesIncompletos).toEqual(["2026-06"]);
    // Divide por 3 igual: un mes sin datos no es un mes sin gastos, y el aviso lo dice.
    expect(r.promedioCentavos).toBe(Math.round(400_00 / 3));
  });
});

describe("puntoDeEquilibrio", () => {
  it("contribución necesaria = fijos + retiro; ventas = contribución ÷ margen", () => {
    const r = puntoDeEquilibrio({
      fijosMensualesCentavos: 800_000_00,
      retiroMensualCentavos: 200_000_00,
      ingresosCentavos: 4_000_000_00,
      costosVariablesCentavos: 1_000_000_00,
    });
    expect(r.contribucionNecesariaCentavos).toBe(1_000_000_00);
    expect(r.margenContribucion).toBeCloseTo(0.75);
    expect(r.ventasNecesariasCentavos).toBe(1_333_333_33);
  });

  it("sin ingresos o con margen ≤ 0 no hay ventas que alcancen", () => {
    const base = { fijosMensualesCentavos: 100, retiroMensualCentavos: 0 };
    expect(puntoDeEquilibrio({ ...base, ingresosCentavos: 0, costosVariablesCentavos: 0 }).ventasNecesariasCentavos).toBeNull();
    expect(puntoDeEquilibrio({ ...base, ingresosCentavos: 100, costosVariablesCentavos: 100 }).ventasNecesariasCentavos).toBeNull();
  });

  it("los costos variables pueden venir con signo", () => {
    const r = puntoDeEquilibrio({ fijosMensualesCentavos: 50, retiroMensualCentavos: 0, ingresosCentavos: 200, costosVariablesCentavos: -100 });
    expect(r.ventasNecesariasCentavos).toBe(100);
  });
});

describe("filasAnaliticasDeLotes", () => {
  it("resume los lotes armados por mes, clase y rubro", () => {
    const lotes = armarLotes([fila("2026-05-02", "CARNET", 1000), fila("2026-05-03", "CARNET", 500)], MAPEO_PRUEBA);
    const filas = filasAnaliticasDeLotes(lotes);
    expect(filas).toContainEqual({ mes: "2026-05", clase: "INGRESO", rubroCodigo: "3.1", rubroNombre: "Fotos carnet", centavos: 1500_00, estimado: false });
    expect(filas).toContainEqual({ mes: "2026-05", clase: "GASTO_FIJO", rubroCodigo: "5.1", rubroNombre: "Alquiler", centavos: -380_000_00, estimado: true });
  });
});
