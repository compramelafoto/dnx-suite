import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr, isLastDays, temporalStatus, toArDay } from "./dates";

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
