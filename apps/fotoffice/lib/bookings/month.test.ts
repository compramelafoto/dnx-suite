import { describe, expect, it } from "vitest";
import { monthGrid, monthLabel, monthRange, shiftMonths } from "./month";
import { BOOKINGS_TIME_ZONE, localMoment } from "./time";

const TZ = BOOKINGS_TIME_ZONE;
const ymd = (d: Date) => localMoment(d, TZ).ymd;

describe("el mes que se mira", () => {
  it("va del día 1 al día 1 del mes siguiente", () => {
    const r = monthRange(new Date("2026-09-17T15:00:00-03:00"), TZ);
    expect(ymd(r.startAt)).toBe("2026-09-01");
    expect(ymd(r.endAt)).toBe("2026-10-01");
  });

  it("arranca a la medianoche local, no a la UTC", () => {
    const r = monthRange(new Date("2026-09-17T15:00:00-03:00"), TZ);
    expect(localMoment(r.startAt, TZ).minuteOfDay).toBe(0);
  });

  it("cierra bien febrero, que es el mes que rompe las cuentas", () => {
    const r = monthRange(new Date("2027-02-14T12:00:00-03:00"), TZ);
    expect(ymd(r.startAt)).toBe("2027-02-01");
    expect(ymd(r.endAt)).toBe("2027-03-01");
  });

  it("funciona parado en el último día del mes a la noche", () => {
    const r = monthRange(new Date("2026-09-30T23:30:00-03:00"), TZ);
    expect(ymd(r.startAt)).toBe("2026-09-01");
    expect(ymd(r.endAt)).toBe("2026-10-01");
  });
});

describe("moverse de mes", () => {
  it("avanza uno", () => {
    expect(ymd(shiftMonths(new Date("2026-09-17T12:00:00-03:00"), 1, TZ)).slice(0, 7)).toBe(
      "2026-10",
    );
  });

  it("retrocede uno", () => {
    expect(ymd(shiftMonths(new Date("2026-09-17T12:00:00-03:00"), -1, TZ)).slice(0, 7)).toBe(
      "2026-08",
    );
  });

  it("cruza el fin de año", () => {
    expect(ymd(shiftMonths(new Date("2026-12-15T12:00:00-03:00"), 1, TZ)).slice(0, 7)).toBe(
      "2027-01",
    );
  });

  it("desde el 31 no se saltea el mes corto", () => {
    // Un mes después del 31 de enero no puede caer en marzo.
    expect(ymd(shiftMonths(new Date("2027-01-31T12:00:00-03:00"), 1, TZ)).slice(0, 7)).toBe(
      "2027-02",
    );
  });
});

describe("la grilla del calendario", () => {
  const grilla = monthGrid(new Date("2026-09-17T12:00:00-03:00"), TZ);

  it("tiene seis semanas siempre", () => {
    expect(grilla).toHaveLength(42);
  });

  it("arranca un domingo", () => {
    expect(localMoment(new Date(`${grilla[0]!.ymd}T12:00:00-03:00`), TZ).weekday).toBe(0);
  });

  it("marca cuáles son del mes y cuáles son relleno", () => {
    const delMes = grilla.filter((c) => c.inMonth);
    expect(delMes).toHaveLength(30);
    expect(delMes[0]!.ymd).toBe("2026-09-01");
    expect(delMes.at(-1)!.ymd).toBe("2026-09-30");
  });

  it("no repite ni saltea días", () => {
    expect(new Set(grilla.map((c) => c.ymd)).size).toBe(42);
  });
});

describe("cómo se escribe el mes", () => {
  it("nombra el mes y el año", () => {
    expect(monthLabel(new Date("2026-09-17T12:00:00-03:00"), TZ)).toContain("2026");
    expect(monthLabel(new Date("2026-09-17T12:00:00-03:00"), TZ)).toContain("septiembre");
  });
});
