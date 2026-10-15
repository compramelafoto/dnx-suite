import { describe, expect, it } from "vitest";
import { DIAS_DE_LA_SEMANA, entregasDeLaSemana, type ProyectoParaEntrega } from "./entregas-puro";

const HOY = "2026-10-15";
const p = (id: string, finalDueDate: string | null, extra: Partial<ProyectoParaEntrega> = {}): ProyectoParaEntrega => ({
  id, numero: `2026-${id}`, nombre: `Proyecto ${id}`, finalDueDate, suspendido: false, cerrado: false, ...extra,
});

describe("entregasDeLaSemana", () => {
  it("entran los vencidos, el de hoy y hasta 7 días adelante; el día 8 queda afuera", () => {
    const r = entregasDeLaSemana(
      [p("a", "2026-10-10"), p("b", "2026-10-15"), p("c", "2026-10-22"), p("d", "2026-10-23")],
      HOY,
    );
    expect(DIAS_DE_LA_SEMANA).toBe(7);
    expect(r.map((x) => [x.id, x.dias])).toEqual([["a", -5], ["b", 0], ["c", 7]]);
  });

  it("no entran los suspendidos, los cerrados ni los que no tienen fecha final", () => {
    const r = entregasDeLaSemana(
      [p("s", "2026-10-16", { suspendido: true }), p("c", "2026-10-16", { cerrado: true }), p("n", null), p("x", "2026-10-16")],
      HOY,
    );
    expect(r.map((x) => x.id)).toEqual(["x"]);
  });

  it("los vencidos van primero y después por fecha; una fecha inválida se ignora", () => {
    const r = entregasDeLaSemana([p("c", "2026-10-20"), p("b", "2026-10-16"), p("a", "2026-09-30"), p("z", "2026-02-31")], HOY);
    expect(r.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(r[0]).toMatchObject({ finalDueDate: "2026-09-30", dias: -15, numero: "2026-a" });
  });

  it("cruza el fin de mes y de año con aritmética de calendario", () => {
    expect(entregasDeLaSemana([p("a", "2027-01-03")], "2026-12-28").map((x) => x.dias)).toEqual([6]);
    expect(entregasDeLaSemana([p("a", "2026-11-02")], "2026-10-26").map((x) => x.dias)).toEqual([7]);
  });
});
