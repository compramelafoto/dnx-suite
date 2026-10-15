import { describe, expect, it } from "vitest";
import { argentinaHolidays, easterSunday, eventDayType, isValidYmd } from "./holidays";

const fechas = (year: number) => argentinaHolidays(year).filter((h) => h.kind === "holiday").map((h) => h.date);

describe("Pascua (algoritmo anónimo gregoriano)", () => {
  it("2026: 5 de abril; 2027: 28 de marzo", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2027)).toBe("2027-03-28");
  });
});

describe("feriados de Argentina por la Ley 27.399", () => {
  it("2026: inamovibles, Carnaval, Viernes Santo y trasladables movidos al lunes", () => {
    const f = fechas(2026);
    for (const d of [
      "2026-01-01", "2026-02-16", "2026-02-17", "2026-03-24", "2026-04-02", "2026-04-03", "2026-05-01", "2026-05-25",
      "2026-06-15", "2026-06-20", "2026-07-09", "2026-08-17", "2026-10-12", "2026-11-23", "2026-12-08", "2026-12-25",
    ]) {
      expect(f, d).toContain(d);
    }
    // Güemes (miércoles 17/6) pasa al lunes 15; Soberanía (viernes 20/11) pasa al lunes 23.
    expect(f).not.toContain("2026-06-17");
    expect(f).not.toContain("2026-11-20");
  });

  it("trasladables: martes y miércoles al lunes anterior; jueves y viernes al lunes siguiente; el resto, en su día", () => {
    // 2027: 17/6 es jueves → lunes 21; 17/8 es martes → lunes 16; 12/10 es martes → lunes 11; 20/11 es sábado → queda.
    const f = fechas(2027);
    expect(f).toEqual(expect.arrayContaining(["2027-06-21", "2027-08-16", "2027-10-11", "2027-11-20"]));
  });

  it("los días no laborables con fines turísticos de 2026 están, pero no son feriados", () => {
    const todos = argentinaHolidays(2026);
    const turisticos = todos.filter((h) => h.kind === "non-working").map((h) => h.date);
    expect(turisticos).toEqual(["2026-03-23", "2026-07-10", "2026-12-07"]);
  });
});

describe("tipo de día del evento", () => {
  it("día hábil, sábado, domingo y feriado", () => {
    expect(eventDayType("2026-10-14")).toMatchObject({ dayType: "weekday" });
    expect(eventDayType("2026-10-17")).toMatchObject({ dayType: "saturday" });
    expect(eventDayType("2026-10-18")).toMatchObject({ dayType: "sunday" });
    expect(eventDayType("2026-12-25")).toMatchObject({ dayType: "holiday", holidayName: "Navidad" });
  });

  it("un feriado que cae sábado es feriado y además sábado", () => {
    expect(eventDayType("2026-06-20")).toMatchObject({ dayType: "holiday", isSaturday: true, isSunday: false });
  });

  it("las fechas propias del perfil cuentan como feriado", () => {
    expect(eventDayType("2026-10-07", ["2026-10-07"])).toMatchObject({ dayType: "holiday", holidayName: "Feriado propio" });
  });

  it("un día no laborable turístico no lleva recargo de feriado, pero se avisa", () => {
    expect(eventDayType("2026-12-07")).toMatchObject({ dayType: "weekday", nonWorkingDay: true });
  });

  it("fecha inválida o vacía: null", () => {
    expect(eventDayType("")).toBeNull();
    expect(eventDayType("2026-02-30")).toBeNull();
    expect(isValidYmd("2026-02-28")).toBe(true);
  });
});
