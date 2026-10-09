import { describe, expect, it } from "vitest";
import {
  citaDesdeRegla, diasQueOcupa, minutosDeHora, moverVista, rangoDia, rangoGrillaMes, rangoMes, rangoSemana, seSuperpone,
} from "./fechas";

describe("citaDesdeRegla", () => {
  it("con hora: la hora de Argentina (UTC−3) y la duración", () => {
    const c = citaDesdeRegla("2026-12-26", 0, "21:30", 90);
    expect(c.allDay).toBe(false);
    expect(c.startAt.toISOString()).toBe("2026-12-27T00:30:00.000Z");
    expect(c.endAt.toISOString()).toBe("2026-12-27T02:00:00.000Z");
  });
  it("suma los días del evento, también negativos", () => {
    expect(citaDesdeRegla("2026-03-01", -1, "10:00", 60).startAt.toISOString()).toBe("2026-02-28T13:00:00.000Z");
    expect(citaDesdeRegla("2026-03-01", 30, "10:00", 60).startAt.toISOString()).toBe("2026-03-31T13:00:00.000Z");
  });
  it("sin hora: todo el día, de 00:00 a 00:00 de Argentina", () => {
    const c = citaDesdeRegla("2026-12-26", 2, null, 60);
    expect(c).toEqual({ allDay: true, startAt: new Date("2026-12-28T03:00:00.000Z"), endAt: new Date("2026-12-29T03:00:00.000Z") });
  });
  it("una hora inválida cuenta como todo el día; la duración inválida, una hora", () => {
    expect(citaDesdeRegla("2026-12-26", 0, "25:00", 60).allDay).toBe(true);
    const c = citaDesdeRegla("2026-12-26", 0, "09:00", 0);
    expect(c.endAt.getTime() - c.startAt.getTime()).toBe(3_600_000);
  });
  it("fecha inválida: error", () => {
    expect(() => citaDesdeRegla("2026-02-30", 0, null, 60)).toThrow(RangeError);
  });
  it("minutosDeHora", () => {
    expect(minutosDeHora("00:00")).toBe(0);
    expect(minutosDeHora("23:59")).toBe(1439);
    expect(minutosDeHora("24:00")).toBeNull();
    expect(minutosDeHora("9:00")).toBeNull();
    expect(minutosDeHora(null)).toBeNull();
  });
});

describe("rangos de la vista", () => {
  it("día", () => {
    const r = rangoDia("2026-10-09");
    expect(r.desde.toISOString()).toBe("2026-10-09T03:00:00.000Z");
    expect(r.hasta.toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });
  it("semana: lunes a domingo", () => {
    const r = rangoSemana("2026-10-09"); // viernes
    expect([r.desdeDia, r.hastaDia]).toEqual(["2026-10-05", "2026-10-11"]);
    expect(rangoSemana("2026-10-11").desdeDia).toBe("2026-10-05"); // domingo
    expect(rangoSemana("2026-10-05").desdeDia).toBe("2026-10-05"); // lunes
  });
  it("mes y grilla del mes", () => {
    expect([rangoMes("2026-02-15").desdeDia, rangoMes("2026-02-15").hastaDia]).toEqual(["2026-02-01", "2026-02-28"]);
    expect([rangoMes("2028-02-15").hastaDia]).toEqual(["2028-02-29"]);
    const g = rangoGrillaMes("2026-10-09"); // oct 2026: jueves 1 a sábado 31
    expect([g.desdeDia, g.hastaDia]).toEqual(["2026-09-28", "2026-11-01"]);
  });
  it("moverVista", () => {
    expect(moverVista("dia", "2026-10-09", -1)).toBe("2026-10-08");
    expect(moverVista("semana", "2026-10-09", 1)).toBe("2026-10-16");
    expect(moverVista("mes", "2026-01-31", 1)).toBe("2026-02-28");
    expect(moverVista("mes", "2026-01-15", -1)).toBe("2025-12-15");
  });
  it("superposición y días que ocupa (fin exclusivo)", () => {
    const d = rangoDia("2026-10-09");
    expect(seSuperpone(new Date("2026-10-10T02:59:00Z"), new Date("2026-10-10T04:00:00Z"), d.desde, d.hasta)).toBe(true);
    expect(seSuperpone(new Date("2026-10-10T03:00:00Z"), new Date("2026-10-10T04:00:00Z"), d.desde, d.hasta)).toBe(false);
    expect(diasQueOcupa(new Date("2026-10-09T03:00:00Z"), new Date("2026-10-10T03:00:00Z"))).toEqual(["2026-10-09"]);
    expect(diasQueOcupa(new Date("2026-10-09T20:00:00Z"), new Date("2026-10-10T05:00:00Z"))).toEqual(["2026-10-09", "2026-10-10"]);
  });
});
