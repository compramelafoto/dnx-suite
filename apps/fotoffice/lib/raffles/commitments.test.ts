import { describe, expect, it } from "vitest";
import {
  activeCommitmentsFor,
  monthsRemaining,
  nextPeriod,
  periodOf,
  planMonthlyRaffle,
} from "./commitments";

const compromiso = (extra = {}) => ({
  id: "c-1",
  title: "50% OFF en cursos seleccionados",
  startPeriod: "2026-09",
  endPeriod: "2026-12",
  cancelledAt: null as Date | null,
  ...extra,
});

describe("qué compromisos van en el sorteo de un mes", () => {
  it("uno vigente entra", () => {
    expect(activeCommitmentsFor([compromiso()], "2026-10")).toHaveLength(1);
  });

  it("el mes de inicio entra: el compromiso arranca ese mes", () => {
    expect(activeCommitmentsFor([compromiso()], "2026-09")).toHaveLength(1);
  });

  it("el mes de fin entra: «hasta diciembre inclusive» incluye diciembre", () => {
    expect(activeCommitmentsFor([compromiso()], "2026-12")).toHaveLength(1);
  });

  it("el mes siguiente al fin ya no entra", () => {
    expect(activeCommitmentsFor([compromiso()], "2027-01")).toHaveLength(0);
  });

  it("un mes anterior al inicio tampoco", () => {
    expect(activeCommitmentsFor([compromiso()], "2026-08")).toHaveLength(0);
  });

  it("un compromiso cancelado no entra aunque el mes esté en rango", () => {
    expect(activeCommitmentsFor([compromiso({ cancelledAt: new Date() })], "2026-10")).toHaveLength(0);
  });

  it("sin fecha de fin, sigue para siempre", () => {
    expect(activeCommitmentsFor([compromiso({ endPeriod: null })], "2030-06")).toHaveLength(1);
  });

  it("el cambio de año se cuenta bien", () => {
    const largo = compromiso({ startPeriod: "2026-11", endPeriod: "2027-02" });
    for (const mes of ["2026-11", "2026-12", "2027-01", "2027-02"]) {
      expect(activeCommitmentsFor([largo], mes)).toHaveLength(1);
    }
    expect(activeCommitmentsFor([largo], "2027-03")).toHaveLength(0);
  });
});

describe("cuántos sorteos le quedan a un compromiso", () => {
  it("de septiembre a diciembre, mirando desde septiembre, quedan cuatro", () => {
    expect(monthsRemaining(compromiso(), "2026-09")).toBe(4);
  });

  it("mirando desde diciembre queda uno: el de diciembre", () => {
    expect(monthsRemaining(compromiso(), "2026-12")).toBe(1);
  });

  it("vencido, cero", () => {
    expect(monthsRemaining(compromiso(), "2027-01")).toBe(0);
  });

  it("sin fecha de fin no hay número que dar", () => {
    expect(monthsRemaining(compromiso({ endPeriod: null }), "2026-09")).toBe(null);
  });
});

describe("períodos", () => {
  it("el período de una fecha se lee en hora argentina", () => {
    // 2026-10-01T02:00Z son todavía las 23:00 del 30/09 en Buenos Aires.
    expect(periodOf(new Date("2026-10-01T02:00:00Z"))).toBe("2026-09");
    expect(periodOf(new Date("2026-10-01T04:00:00Z"))).toBe("2026-10");
  });

  it("el mes que sigue a diciembre es enero del año próximo", () => {
    expect(nextPeriod("2026-12")).toBe("2027-01");
  });
});

describe("el plan del sorteo mensual", () => {
  const reglas = { drawDay: 30, drawHour: 20, entriesCloseHoursBefore: 24 };

  it("arma título y fechas para el mes", () => {
    const plan = planMonthlyRaffle("2026-10", reglas);
    expect(plan.title).toBe("Sorteo de octubre de 2026");
    // 30/10 a las 20:00 en Buenos Aires son las 23:00 UTC.
    expect(plan.drawsAt.toISOString()).toBe("2026-10-30T23:00:00.000Z");
  });

  it("el padrón cierra 24 horas antes del acto", () => {
    const plan = planMonthlyRaffle("2026-10", reglas);
    const horas = (plan.drawsAt.getTime() - plan.entriesCloseAt.getTime()) / 3_600_000;
    expect(horas).toBe(24);
  });

  it("un día 30 en febrero cae al último día del mes, no se pasa a marzo", () => {
    const plan = planMonthlyRaffle("2027-02", reglas);
    expect(plan.drawsAt.toISOString()).toBe("2027-02-28T23:00:00.000Z");
  });

  it("febrero de un año bisiesto llega al 29", () => {
    const plan = planMonthlyRaffle("2028-02", reglas);
    expect(plan.drawsAt.toISOString()).toBe("2028-02-29T23:00:00.000Z");
  });
});
