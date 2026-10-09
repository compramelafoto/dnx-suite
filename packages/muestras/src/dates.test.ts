import { describe, expect, it } from "vitest";
import { addArDays, dateRangeText, dayEndAr, dayStartAr, formatArDay, formatArDayLong, isLastDays, temporalStatus, toArDay } from "./dates";

describe("fechas en hora argentina", () => {
  it("el día empieza a las 00:00 ART (03:00 UTC)", () => {
    expect(dayStartAr("2026-11-05").toISOString()).toBe("2026-11-05T03:00:00.000Z");
  });

  it("el día termina a las 23:59:59.999 ART", () => {
    expect(dayEndAr("2026-11-05").toISOString()).toBe("2026-11-06T02:59:59.999Z");
  });

  it("rechaza un texto que no es AAAA-MM-DD", () => {
    expect(() => dayStartAr("5/11/2026")).toThrow("Fecha inválida");
  });

  it("toArDay devuelve el día argentino aunque en UTC ya sea el siguiente", () => {
    expect(toArDay(new Date("2026-11-06T01:00:00.000Z"))).toBe("2026-11-05");
  });
});

describe("estado temporal", () => {
  const a = { startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20") };

  it("antes del inicio está próxima", () => {
    expect(temporalStatus(a, new Date("2026-11-05T02:59:59.000Z"))).toBe("UPCOMING");
  });
  it("el primer minuto del día de inicio está abierta", () => {
    expect(temporalStatus(a, new Date("2026-11-05T03:00:00.000Z"))).toBe("OPEN");
  });
  it("el último día a las 23:30 ART sigue abierta", () => {
    expect(temporalStatus(a, new Date("2026-11-21T02:30:00.000Z"))).toBe("OPEN");
  });
  it("después del cierre está cerrada", () => {
    expect(temporalStatus(a, new Date("2026-11-21T03:00:00.000Z"))).toBe("CLOSED");
  });
  it("últimos días: abierta y cierra dentro de 7 días", () => {
    expect(isLastDays(a, new Date("2026-11-15T15:00:00.000Z"))).toBe(true);
    expect(isLastDays(a, new Date("2026-11-10T15:00:00.000Z"))).toBe(false);
    expect(isLastDays(a, new Date("2026-11-22T15:00:00.000Z"))).toBe(false);
  });
});

describe("formatArDay", () => {
  it("usa la hora argentina, no la UTC", () => {
    const t = formatArDay(new Date("2026-11-06T01:00:00Z"));
    expect(t).toContain("5");
    expect(t.toLowerCase()).toContain("nov");
  });
});

describe("fechas largas", () => {
  const d = (day: string) => dayStartAr(day);
  it("día largo en hora argentina", () => {
    expect(formatArDayLong(d("2026-11-05"))).toBe("5 de noviembre de 2026");
    // 02:30 UTC del 6 todavía es el 5 en Argentina.
    expect(formatArDayLong(new Date("2026-11-06T02:30:00Z"))).toBe("5 de noviembre de 2026");
  });
  it("rangos según mes y año", () => {
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-11-05"))).toBe("5 de noviembre de 2026");
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-11-20"))).toBe("Del 5 al 20 de noviembre de 2026");
    expect(dateRangeText(d("2026-11-05"), dayEndAr("2026-12-20"))).toBe("Del 5 de noviembre al 20 de diciembre de 2026");
    expect(dateRangeText(d("2026-12-20"), dayEndAr("2027-01-10"))).toBe("Del 20 de diciembre de 2026 al 10 de enero de 2027");
  });
  it("sumar días cruza meses y años", () => {
    expect(addArDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addArDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
