import { describe, expect, it } from "vitest";
import { estimadosDelMes } from "./estimados";
import { MAPEO_PRUEBA, fila } from "./prueba-datos";

describe("estimadosDelMes", () => {
  it("genera los fijos estimados del mes, como egreso", () => {
    const r = estimadosDelMes("2026-05", MAPEO_PRUEBA, []);
    expect(r.map((m) => [m.conceptoNormalizado, m.centavos, m.fecha, m.rubroCodigo, m.clase])).toEqual([
      ["ALQUILER (ESTIMADO)", -38_000_000, "2026-05-10", "5.1", "GASTO_FIJO"],
      ["EXPENSAS (ESTIMADO)", -7_500_000, "2026-05-10", "5.11", "GASTO_FIJO"],
    ]);
    expect(r.every((m) => m.estimado && m.origen === "ESTIMADO" && m.medio === null)).toBe(true);
  });

  it("'sólo si no hay': si el libro ya tiene expensas ese mes, no las estima", () => {
    const r = estimadosDelMes("2026-04", MAPEO_PRUEBA, [fila("2026-04-03", "EXPENSAS", -43_000)]);
    expect(r.map((m) => m.conceptoNormalizado)).toEqual(["ALQUILER (ESTIMADO)"]);
  });

  it("un ingreso con el mismo concepto no cuenta como pagado", () => {
    const r = estimadosDelMes("2026-04", MAPEO_PRUEBA, [fila("2026-04-03", "EXPENSAS", 43_000)]);
    expect(r).toHaveLength(2);
  });

  it("fuera del período no estima nada (octubre se carga a mano)", () => {
    expect(estimadosDelMes("2026-10", MAPEO_PRUEBA, [])).toEqual([]);
    expect(estimadosDelMes("2025-12", MAPEO_PRUEBA, [])).toEqual([]);
  });

  it("el día se recorta al último del mes", () => {
    const m = { ...MAPEO_PRUEBA, estimados: [{ ...MAPEO_PRUEBA.estimados![0], dia: 31 }] };
    expect(estimadosDelMes("2026-02", m, [])[0].fecha).toBe("2026-02-28");
  });
});
