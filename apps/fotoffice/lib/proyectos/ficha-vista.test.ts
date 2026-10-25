import { describe, expect, it } from "vitest";
import { atrasoDelProyecto, estadoDe, planDelRecorrido } from "./ficha-vista";

describe("estadoDe", () => {
  it("suspendido manda sobre en curso y sobre cerrado", () => {
    expect(estadoDe(true, false)).toBe("SUSPENDIDO");
    expect(estadoDe(true, true)).toBe("SUSPENDIDO");
    expect(estadoDe(false, true)).toBe("CERRADO");
    expect(estadoDe(false, false)).toBe("EN_CURSO");
  });
});

describe("planDelRecorrido", () => {
  const etapas = [{ id: "e1", nombre: "Edición" }, { id: "e2", nombre: "Revisión" }, { id: "e3", nombre: "Entrega" }];
  const planes = new Map([["e1", "2026-10-20"], ["e2", "2026-10-25"]]);

  it("marca hechas, actual y pendientes, con el plan de cada etapa (null si falta)", () => {
    expect(planDelRecorrido(etapas, "e2", planes)).toEqual([
      { stageId: "e1", nombre: "Edición", plan: "2026-10-20", estado: "hecha" },
      { stageId: "e2", nombre: "Revisión", plan: "2026-10-25", estado: "actual" },
      { stageId: "e3", nombre: "Entrega", plan: null, estado: "pendiente" },
    ]);
  });

  it("con el recorrido cerrado ninguna etapa lleva estado", () => {
    expect(planDelRecorrido(etapas, null, planes).map((e) => e.estado)).toEqual([null, null, null]);
  });
});

describe("atrasoDelProyecto", () => {
  it("cuenta los días pasados del plan de la etapa actual, sólo en curso", () => {
    expect(atrasoDelProyecto("EN_CURSO", "2026-10-10", "2026-10-15")).toBe(5);
    expect(atrasoDelProyecto("EN_CURSO", "2026-10-15", "2026-10-15")).toBe(0);
    expect(atrasoDelProyecto("EN_CURSO", "2026-10-20", "2026-10-15")).toBe(0);
    expect(atrasoDelProyecto("EN_CURSO", null, "2026-10-15")).toBe(0);
    expect(atrasoDelProyecto("SUSPENDIDO", "2026-10-10", "2026-10-15")).toBe(0);
    expect(atrasoDelProyecto("CERRADO", "2026-10-10", "2026-10-15")).toBe(0);
  });
});
