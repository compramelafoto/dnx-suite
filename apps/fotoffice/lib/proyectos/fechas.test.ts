import { describe, expect, it } from "vitest";
import { atraso, diaArgentina, diasEntre, fechaBase, planDeEtapas, sumarDias, vencimientoDeTarea } from "./fechas";

describe("fechaBase", () => {
  it("usa el día del evento (texto o columna DATE)", () => {
    const confirmado = new Date("2026-10-08T15:00:00Z");
    expect(fechaBase("2026-12-05", confirmado)).toBe("2026-12-05");
    expect(fechaBase(new Date("2026-12-05T00:00:00Z"), confirmado)).toBe("2026-12-05");
  });
  it("sin evento usa el día de la confirmación en Argentina, no en UTC", () => {
    expect(fechaBase(null, new Date("2026-10-09T01:30:00Z"))).toBe("2026-10-08"); // 22:30 del 8 en Argentina
    expect(fechaBase(null, new Date("2026-10-09T03:00:00Z"))).toBe("2026-10-09");
    expect(diaArgentina(new Date("2026-12-31T23:59:00Z"))).toBe("2026-12-31");
  });
  it("un evento inválido cae a la confirmación", () => {
    expect(fechaBase("2026-02-30", new Date("2026-10-09T12:00:00Z"))).toBe("2026-10-09");
  });
});

describe("sumarDias y diasEntre", () => {
  it("cruza meses, años y bisiestos; admite negativos", () => {
    expect(sumarDias("2026-12-30", 3)).toBe("2027-01-02");
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("diasEntre es con signo", () => {
    expect(diasEntre("2026-10-01", "2026-10-08")).toBe(7);
    expect(diasEntre("2026-10-08", "2026-10-01")).toBe(-7);
  });
  it("rechaza fechas inválidas", () => {
    expect(() => sumarDias("hola", 1)).toThrow();
  });
});

describe("planDeEtapas", () => {
  it("acumula los días: la etapa i vence en base + suma de 1..i", () => {
    const plan = planDeEtapas([{ id: "a", days: 2 }, { id: "b", days: 5 }, { id: "c", days: 0 }, { id: "d", days: 10 }], "2026-12-01");
    expect(plan).toEqual([
      { stageId: "a", plannedDueDate: "2026-12-03" },
      { stageId: "b", plannedDueDate: "2026-12-08" },
      { stageId: "c", plannedDueDate: "2026-12-08" },
      { stageId: "d", plannedDueDate: "2026-12-18" },
    ]);
  });
  it("sin etapas, vacío; días inválidos cuentan cero", () => {
    expect(planDeEtapas([], "2026-12-01")).toEqual([]);
    expect(planDeEtapas([{ id: "a", days: -3 }, { id: "b", days: 1.5 }], "2026-12-01").map((p) => p.plannedDueDate)).toEqual(["2026-12-01", "2026-12-01"]);
  });
});

describe("vencimientoDeTarea", () => {
  it("es el plan de la etapa más los días de la tarea", () => {
    expect(vencimientoDeTarea("2026-12-08", 3)).toBe("2026-12-11");
    expect(vencimientoDeTarea("2026-12-08", -2)).toBe("2026-12-06");
    expect(vencimientoDeTarea("2026-12-08", 0)).toBe("2026-12-08");
  });
});

describe("atraso", () => {
  it("son los días pasados del plan; nunca negativo", () => {
    expect(atraso("2026-12-08", "2026-12-12")).toBe(4);
    expect(atraso("2026-12-08", "2026-12-08")).toBe(0);
    expect(atraso("2026-12-08", "2026-12-01")).toBe(0);
  });
  it("sin plan o con fechas inválidas, cero; acepta Date de columnas DATE", () => {
    expect(atraso(null, "2026-12-12")).toBe(0);
    expect(atraso("x", "2026-12-12")).toBe(0);
    expect(atraso(new Date("2026-12-08T00:00:00Z"), "2026-12-10")).toBe(2);
  });
});
