import { describe, expect, it } from "vitest";
import { armarMonotributo, mesesMonotributo } from "./monotributo";

const base = { hoy: "2026-03-15", avisoPct: 80 };

describe("monotributo", () => {
  it("son 12 meses móviles: el actual y los 11 anteriores", () => {
    const m = mesesMonotributo("2026-03-15");
    expect(m).toHaveLength(12);
    expect(m[0]).toBe("2025-04");
    expect(m[11]).toBe("2026-03");
  });
  it("suma sólo los 12 meses y ignora los de afuera", () => {
    const r = armarMonotributo({ ...base, tope: 1_000_000, ingresosPorMes: { "2025-03": 999, "2025-04": 100, "2026-03": 50, "2026-04": 7 } });
    expect(r.total).toBe(150);
    expect(r.meses.find((x) => x.mes === "2025-05")?.centavos).toBe(0);
  });
  it("sin tope no hay semáforo", () => {
    expect(armarMonotributo({ ...base, tope: null, ingresosPorMes: { "2026-03": 100 } })).toMatchObject({ estado: "SIN_CONFIGURAR", porcentaje: null, falta: null });
    expect(armarMonotributo({ ...base, tope: 0, ingresosPorMes: {} }).estado).toBe("SIN_CONFIGURAR");
  });
  it("bordes: 79,99 % verde, 80 % amarillo, 99,99 % amarillo, 100 % rojo", () => {
    const tope = 10_000;
    const e = (total: number) => armarMonotributo({ ...base, tope, ingresosPorMes: { "2026-03": total } });
    expect(e(7999)).toMatchObject({ estado: "VERDE", porcentaje: 79.99, falta: 2001 });
    expect(e(8000)).toMatchObject({ estado: "AMARILLO", porcentaje: 80 });
    expect(e(9999)).toMatchObject({ estado: "AMARILLO", porcentaje: 99.99, falta: 1 });
    expect(e(10_000)).toMatchObject({ estado: "ROJO", porcentaje: 100, falta: 0 });
    expect(e(12_000)).toMatchObject({ estado: "ROJO", falta: 0 });
  });
  it("respeta el porcentaje de aviso configurado", () => {
    const r = armarMonotributo({ ...base, avisoPct: 50, tope: 10_000, ingresosPorMes: { "2026-03": 5000 } });
    expect(r.estado).toBe("AMARILLO");
  });
  it("centavos exactos con topes grandes", () => {
    const tope = 1_500_000_000_00; // $1.500 millones
    const r = armarMonotributo({ ...base, tope, ingresosPorMes: { "2026-03": 1_199_999_999_99 } });
    expect(r.estado).toBe("VERDE");
    expect(armarMonotributo({ ...base, tope, ingresosPorMes: { "2026-03": 1_200_000_000_00 } }).estado).toBe("AMARILLO");
  });
});
