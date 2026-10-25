import { describe, expect, it } from "vitest";
import { armarLotes, mesesDe } from "./lote";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

const FILAS = [
  fila("2024-01-02", "CARNET", 2500, { medio: "EFECTIVO" }),
  fila("2024-01-03", "IMPRESIONES", 10_000, { medio: "DIGITAL" }),
  fila("2024-01-04", "CADETE", -1500),
  fila("2024-01-05", "KINESIO", -7000),
  fila("2026-05-02", "CARNET", 10_000, { medio: "DIGITAL" }),
  fila("2026-05-03", "CARNET", -10_000, { medio: "DIGITAL" }),
  fila("2026-05-04", "OTROS", 150_000),
  fila("2026-05-04", "RETIROS", -50_000),
  fila("2026-05-05", "NUEVO", -100),
];

describe("armarLotes", () => {
  const lotes = armarLotes(FILAS, MAPEO_PRUEBA);

  it("un lote por mes, en orden", () => {
    expect(lotes.map((l) => l.mes)).toEqual(["2024-01", "2026-05"]);
    expect(mesesDe(FILAS)).toEqual(["2024-01", "2026-05"]);
  });

  it("totales del mes por clase y por rubro, con los ingresos netos de correcciones", () => {
    const r = lotes[0].resumen;
    expect(r.filas).toBe(4);
    expect(r.ingresosCentavos).toBe(1_250_000);
    expect(r.ingresosEfectivoCentavos).toBe(250_000);
    expect(r.ingresosDigitalCentavos).toBe(1_000_000);
    expect(r.porClase).toMatchObject({ INGRESO: 1_250_000, COSTO_VARIABLE: -150_000, GASTO_FIJO: 0, RETIRO_DUENO: -700_000 });
    expect(r.egresosLibroCentavos).toBe(-850_000);
    expect(r.estimadosCentavos).toBe(0);
    expect(r.resultadoCentavos).toBe(1_100_000);
    expect(r.porRubro.map((x) => x.codigo)).toEqual(["3.1", "3.2", "4.1", "6.1"]);
    expect(r.avisos).toEqual(["Gastos fijos incompletos"]);
  });

  it("el mes con estimados, movimientos internos y filas sin regla", () => {
    const l = lotes[1];
    const r = l.resumen;
    expect(r.ingresosCentavos).toBe(15_000_000);
    expect(r.estimados.map((e) => e.concepto)).toEqual(["ALQUILER (ESTIMADO)", "EXPENSAS (ESTIMADO)"]);
    expect(r.estimadosCentavos).toBe(-45_500_000);
    expect(r.porClase.GASTO_FIJO).toBe(-45_500_000);
    expect(r.porClase.MOVIMIENTO_INTERNO).toBe(-5_000_000);
    expect(r.porClase.SIN_CLASIFICAR).toBe(-10_000);
    // Resultado: ingresos + costos + fijos + sin clasificar. Ni el retiro ni los internos.
    expect(r.resultadoCentavos).toBe(15_000_000 - 45_500_000 - 10_000);
    expect(r.filasRevisar).toBe(3); // corrección de carnet, OTROS (baja + grande), NUEVO
    expect(l.movimientos.filter((m) => m.estimado)).toHaveLength(2);
    expect(r.avisos).toEqual([]);
    expect(l.movimientos.map((m) => m.orden)).toEqual(l.movimientos.map((_, i) => i));
  });

  it("es idempotente: misma entrada, misma huella; otra entrada, otra huella", () => {
    const otra = armarLotes(FILAS, MAPEO_PRUEBA);
    expect(otra.map((l) => l.huella)).toEqual(lotes.map((l) => l.huella));
    const cambiada = armarLotes([...FILAS.slice(0, 3), fila("2024-01-05", "KINESIO", -7001)], MAPEO_PRUEBA);
    expect(cambiada[0].huella).not.toBe(lotes[0].huella);
    expect(lotes[0].huella).toMatch(/^[0-9a-f]{64}$/);
  });

  it("se puede pedir un solo mes, pero los faltantes miran los meses anteriores", () => {
    const filas = [
      ...["2025-01", "2025-02", "2025-03"].map((m) => fila(`${m}-05`, "CADETE", -1000)),
      fila("2025-04-05", "CARNET", 1000),
    ];
    const [abril] = armarLotes(filas, MAPEO_PRUEBA, { meses: ["2025-04"] });
    expect(abril.mes).toBe("2025-04");
    expect(abril.resumen.faltantes.map((f) => f.concepto)).toEqual(["CADETE"]);
  });

  it("los estimados de meses anteriores cuentan como presentes para los faltantes", () => {
    const filas = ["2026-01", "2026-02", "2026-03", "2026-04"].map((m) => fila(`${m}-05`, "CARNET", 1000));
    const lotesE = armarLotes(filas, MAPEO_PRUEBA);
    // El alquiler estimado está todos los meses: nunca falta.
    expect(lotesE.at(-1)!.resumen.faltantes).toEqual([]);
  });
});
