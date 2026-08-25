import { describe, expect, it } from "vitest";
import { initialDuePeriods, monthlyDuePeriod } from "./periods";

const base = { count: 3, dueDay: 10, countJoinMonthIfBeforeDueDay: true };

describe("initialDuePeriods", () => {
  /** El ejemplo acordado con el titular: alta el 18, el mes en curso se bonifica. */
  it("alta el 18 de agosto cubre septiembre, octubre y noviembre", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-09", "2026-10", "2026-11"]);
  });

  /** Quien entra antes del vencimiento alcanza a usar el mes: cuenta como la primera. */
  it("alta el 3 de agosto cubre agosto, septiembre y octubre", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-03T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("alta el 10 exacto todavía cuenta el mes en curso", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-10T12:00:00Z") });
    expect(r[0]!.period).toBe("2026-08");
  });

  it("alta el 11 ya no cuenta el mes en curso", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-11T12:00:00Z") });
    expect(r[0]!.period).toBe("2026-09");
  });

  it("con la opción apagada nunca cuenta el mes en curso", () => {
    const r = initialDuePeriods({
      ...base,
      countJoinMonthIfBeforeDueDay: false,
      joinedAt: new Date("2026-08-03T12:00:00Z"),
    });
    expect(r[0]!.period).toBe("2026-09");
  });

  it("cruza el fin de año correctamente", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-11-20T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2026-12", "2027-01", "2027-02"]);
  });

  it("cada cuota vence el día 10 de su mes", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r[0]!.dueDate.toISOString().slice(0, 10)).toBe("2026-09-10");
    expect(r[2]!.dueDate.toISOString().slice(0, 10)).toBe("2026-11-10");
  });

  it("respeta una cantidad distinta de cuotas", () => {
    const r = initialDuePeriods({ ...base, count: 1, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(r).toHaveLength(1);
  });

  it("con count 0 no genera cuotas", () => {
    expect(
      initialDuePeriods({ ...base, count: 0, joinedAt: new Date("2026-08-18T12:00:00Z") }),
    ).toEqual([]);
  });

  it("no hay períodos repetidos", () => {
    const r = initialDuePeriods({ ...base, count: 12, joinedAt: new Date("2026-08-18T12:00:00Z") });
    expect(new Set(r.map((d) => d.period)).size).toBe(12);
  });

  it("alta el 31 de diciembre arranca en enero del año siguiente", () => {
    const r = initialDuePeriods({ ...base, joinedAt: new Date("2026-12-31T12:00:00Z") });
    expect(r.map((d) => d.period)).toEqual(["2027-01", "2027-02", "2027-03"]);
  });
});

describe("monthlyDuePeriod", () => {
  it("arma el vencimiento de un período dado", () => {
    expect(monthlyDuePeriod("2026-03", 10).dueDate.toISOString().slice(0, 10)).toBe("2026-03-10");
  });

  /**
   * Febrero con día de vencimiento 30: se topea al último día del mes en vez de desbordar
   * a marzo, que es el error clásico de aritmética de fechas.
   */
  it("un día que no existe en el mes se topea al último día", () => {
    expect(monthlyDuePeriod("2026-02", 30).dueDate.toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("año bisiesto", () => {
    expect(monthlyDuePeriod("2028-02", 30).dueDate.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("día 31 en un mes de 30", () => {
    expect(monthlyDuePeriod("2026-04", 31).dueDate.toISOString().slice(0, 10)).toBe("2026-04-30");
  });
});
