import { describe, expect, it } from "vitest";
import { faltantesRecurrentes, type PresenciaGasto } from "./faltantes";

function p(mes: string, concepto: string, rubroCodigo = "5.11", clase: PresenciaGasto["clase"] = "GASTO_FIJO"): PresenciaGasto {
  return { mes, concepto, rubroCodigo, rubroNombre: "Expensas", clase };
}

describe("faltantesRecurrentes", () => {
  it("avisa el gasto que estuvo en 3 de los 6 meses anteriores y falta este mes", () => {
    const historia = [p("2025-12", "EXPENSAS"), p("2026-02", "EXPENSAS"), p("2026-04", "EXPENSAS")];
    expect(faltantesRecurrentes("2026-05", historia, [])).toEqual([
      { concepto: "EXPENSAS", rubroCodigo: "5.11", rubroNombre: "Expensas", mesesVistos: 3 },
    ]);
  });

  it("no avisa si está en el mes, ni si se vio en menos de 3 meses", () => {
    const historia = [p("2026-02", "EXPENSAS"), p("2026-03", "EXPENSAS"), p("2026-04", "EXPENSAS")];
    expect(faltantesRecurrentes("2026-05", historia, [p("2026-05", "EXPENSAS")])).toEqual([]);
    expect(faltantesRecurrentes("2026-05", historia.slice(1), [])).toEqual([]);
  });

  it("sólo mira los 6 meses anteriores e ignora ingresos y movimientos internos", () => {
    const viejos = [p("2025-01", "X"), p("2025-02", "X"), p("2025-03", "X")];
    expect(faltantesRecurrentes("2026-05", viejos, [])).toEqual([]);
    const ingresos = ["2026-02", "2026-03", "2026-04"].map((m) => p(m, "CARNET", "3.1", "INGRESO"));
    expect(faltantesRecurrentes("2026-05", ingresos, [])).toEqual([]);
    const internos = ["2026-02", "2026-03", "2026-04"].map((m) => p(m, "RETIROS", "0.1", "MOVIMIENTO_INTERNO"));
    expect(faltantesRecurrentes("2026-05", internos, [])).toEqual([]);
  });

  it("otro concepto del mismo rubro cuenta como presente (el estimado de expensas cubre las expensas)", () => {
    const historia = [p("2026-02", "EXPENSAS"), p("2026-03", "EXPENSAS"), p("2026-04", "EXPENSAS")];
    expect(faltantesRecurrentes("2026-05", historia, [p("2026-05", "EXPENSAS (ESTIMADO)")])).toEqual([]);
  });

  it("varias veces en el mismo mes cuenta como un mes", () => {
    const historia = [p("2026-04", "CADETE"), p("2026-04", "CADETE"), p("2026-04", "CADETE")];
    expect(faltantesRecurrentes("2026-05", historia, [])).toEqual([]);
  });
});
