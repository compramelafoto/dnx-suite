import { describe, expect, it } from "vitest";
import {
  BOOKINGS_TIME_ZONE,
  addMinutes,
  expandInterval,
  localMoment,
  minuteOfDayToLabel,
  monthKeyOf,
  overlaps,
} from "./time";

const tz = BOOKINGS_TIME_ZONE;

describe("el instante visto desde Rosario", () => {
  it("un sábado a las 14 de Rosario es sábado a las 14", () => {
    // 2026-09-19T17:00Z = sábado 19/09 14:00 en Argentina (UTC-3).
    const m = localMoment(new Date("2026-09-19T17:00:00Z"), tz);
    expect(m.weekday).toBe(6);
    expect(m.minuteOfDay).toBe(14 * 60);
    expect(m.ymd).toBe("2026-09-19");
  });

  it("el domingo es 0 y el lunes es 1", () => {
    expect(localMoment(new Date("2026-09-20T15:00:00Z"), tz).weekday).toBe(0);
    expect(localMoment(new Date("2026-09-21T15:00:00Z"), tz).weekday).toBe(1);
  });

  it("las 23:00 del domingo en Rosario son lunes en UTC, y sigue siendo domingo", () => {
    // Sin la conversión, un cálculo hecho en UTC diría lunes y correría el horario un día.
    const m = localMoment(new Date("2026-09-21T02:00:00Z"), tz);
    expect(m.weekday).toBe(0);
    expect(m.minuteOfDay).toBe(23 * 60);
  });

  it("la medianoche exacta es el minuto cero", () => {
    expect(localMoment(new Date("2026-09-19T03:00:00Z"), tz).minuteOfDay).toBe(0);
  });
});

describe("el mes al que pertenece un instante", () => {
  it("usa el mes de Rosario, no el de UTC", () => {
    // 2026-10-01T01:00Z es todavía 30 de septiembre en Argentina.
    expect(monthKeyOf(new Date("2026-10-01T01:00:00Z"), tz)).toBe("2026-09");
    expect(monthKeyOf(new Date("2026-10-01T05:00:00Z"), tz)).toBe("2026-10");
  });
});

describe("solapamiento", () => {
  const r = (a: string, b: string) => ({ startAt: new Date(a), endAt: new Date(b) });

  it("dos rangos que se pisan se detectan", () => {
    expect(
      overlaps(
        r("2026-09-19T14:00:00Z", "2026-09-19T16:00:00Z"),
        r("2026-09-19T15:00:00Z", "2026-09-19T17:00:00Z"),
      ),
    ).toBe(true);
  });

  it("uno adentro del otro también", () => {
    expect(
      overlaps(
        r("2026-09-19T14:00:00Z", "2026-09-19T18:00:00Z"),
        r("2026-09-19T15:00:00Z", "2026-09-19T16:00:00Z"),
      ),
    ).toBe(true);
  });

  it("pegados NO se pisan: de 14 a 16 y de 16 a 18 conviven", () => {
    expect(
      overlaps(
        r("2026-09-19T14:00:00Z", "2026-09-19T16:00:00Z"),
        r("2026-09-19T16:00:00Z", "2026-09-19T18:00:00Z"),
      ),
    ).toBe(false);
  });

  it("separados no se pisan", () => {
    expect(
      overlaps(
        r("2026-09-19T14:00:00Z", "2026-09-19T15:00:00Z"),
        r("2026-09-19T16:00:00Z", "2026-09-19T17:00:00Z"),
      ),
    ).toBe(false);
  });
});

describe("el tiempo de limpieza entre reservas", () => {
  it("agranda el rango para los dos lados", () => {
    const e = expandInterval(
      { startAt: new Date("2026-09-19T14:00:00Z"), endAt: new Date("2026-09-19T16:00:00Z") },
      30,
    );
    expect(e.startAt.toISOString()).toBe("2026-09-19T13:30:00.000Z");
    expect(e.endAt.toISOString()).toBe("2026-09-19T16:30:00.000Z");
  });

  it("sin tiempo de limpieza el rango no cambia", () => {
    const original = {
      startAt: new Date("2026-09-19T14:00:00Z"),
      endAt: new Date("2026-09-19T16:00:00Z"),
    };
    expect(expandInterval(original, 0)).toEqual(original);
  });
});

describe("etiquetas", () => {
  it("el minuto del día se lee como hora", () => {
    expect(minuteOfDayToLabel(540)).toBe("09:00");
    expect(minuteOfDayToLabel(0)).toBe("00:00");
    expect(minuteOfDayToLabel(1290)).toBe("21:30");
  });

  it("sumar minutos no rompe el cruce de día", () => {
    expect(addMinutes(new Date("2026-09-19T23:30:00Z"), 60).toISOString()).toBe(
      "2026-09-20T00:30:00.000Z",
    );
  });
});
