import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import {
  calendarHref,
  calendarTitle,
  hourBounds,
  layoutOverlaps,
  miniMonthWeeks,
  parseCalendarParams,
  shiftYmd,
  startOfLocalDay,
  viewInterval,
  visibleDays,
} from "./calendar-view";

const tz = BOOKINGS_TIME_ZONE;

describe("los días que se ven", () => {
  it("la semana va de lunes a domingo aunque se pida un sábado", () => {
    const dias = visibleDays("semana", "2026-10-03");
    expect(dias[0]).toBe("2026-09-28");
    expect(dias[6]).toBe("2026-10-04");
  });

  it("el mes se dibuja en semanas enteras, sin una fila sobrante de días ajenos", () => {
    // Octubre 2026 arranca jueves y termina sábado: cinco filas.
    const dias = visibleDays("mes", "2026-10-15");
    expect(dias[0]).toBe("2026-09-28");
    expect(dias.at(-1)).toBe("2026-11-01");
    expect(dias).toHaveLength(35);
  });

  it("un mes que necesita seis filas las tiene", () => {
    // Agosto 2026 arranca sábado y tiene 31 días.
    expect(visibleDays("mes", "2026-08-01")).toHaveLength(42);
  });

  it("el mes en miniatura tiene siempre seis filas, para no saltar de alto", () => {
    expect(miniMonthWeeks("2026-10-03")).toHaveLength(6);
    expect(miniMonthWeeks("2026-10-03")[0][0]).toBe("2026-09-28");
  });
});

describe("las flechas", () => {
  it("avanzan un día, una semana o un mes según la vista", () => {
    expect(shiftYmd("dia", "2026-10-03", 1)).toBe("2026-10-04");
    expect(shiftYmd("semana", "2026-10-03", -1)).toBe("2026-09-26");
    expect(shiftYmd("mes", "2026-10-03", 1)).toBe("2026-11-01");
  });

  it("pasar de mes desde el 31 no se saltea febrero", () => {
    expect(shiftYmd("mes", "2027-01-31", 1)).toBe("2027-02-01");
  });

  it("cruzan el fin de año", () => {
    expect(shiftYmd("semana", "2026-12-30", 1)).toBe("2027-01-06");
    expect(shiftYmd("mes", "2027-01-10", -1)).toBe("2026-12-01");
  });
});

describe("el título", () => {
  it("dice el mes cuando la semana entra entera", () => {
    expect(calendarTitle("semana", "2026-10-14")).toBe("octubre de 2026");
  });

  it("nombra los dos meses cuando la semana cruza", () => {
    expect(calendarTitle("semana", "2026-10-03")).toBe("sep – oct de 2026");
  });

  it("nombra los dos años cuando cruza el fin de año", () => {
    expect(calendarTitle("semana", "2026-12-30")).toBe("dic de 2026 – ene de 2027");
  });

  it("en la vista de día dice la fecha completa", () => {
    expect(calendarTitle("dia", "2026-10-03")).toBe("3 de octubre de 2026");
  });
});

describe("los instantes de una vista", () => {
  it("el día local arranca a las 3 de la mañana UTC en Rosario", () => {
    expect(startOfLocalDay("2026-10-03", tz).toISOString()).toBe("2026-10-03T03:00:00.000Z");
  });

  it("la semana cubre de lunes a la medianoche del lunes siguiente", () => {
    const r = viewInterval("semana", "2026-10-03", tz);
    expect(r.startAt.toISOString()).toBe("2026-09-28T03:00:00.000Z");
    expect(r.endAt.toISOString()).toBe("2026-10-05T03:00:00.000Z");
  });
});

describe("lo que dice la dirección", () => {
  const ahora = new Date("2026-10-03T18:00:00Z");

  it("sin nada, hoy en la vista por defecto", () => {
    expect(parseCalendarParams({}, ahora, tz)).toEqual({ ymd: "2026-10-03", view: "semana" });
  });

  it("respeta la fecha y la vista pedidas", () => {
    expect(parseCalendarParams({ fecha: "2027-03-15", vista: "mes" }, ahora, tz)).toEqual({
      ymd: "2027-03-15",
      view: "mes",
    });
  });

  it("los enlaces viejos con ?semana= siguen andando", () => {
    expect(parseCalendarParams({ semana: "2026-09-17T18:00:00.000Z" }, ahora, tz).ymd).toBe(
      "2026-09-17",
    );
  });

  it("una fecha imposible vuelve a hoy en vez de romper", () => {
    expect(parseCalendarParams({ fecha: "2026-02-31", vista: "año" }, ahora, tz)).toEqual({
      ymd: "2026-10-03",
      view: "semana",
    });
  });

  it("el enlace conserva el espacio elegido", () => {
    expect(calendarHref("/portal/reservas", { ymd: "2026-10-05" }, { espacio: "abc" })).toBe(
      "/portal/reservas?espacio=abc&fecha=2026-10-05",
    );
  });
});

describe("el alto de la grilla", () => {
  it("abarca el horario de todos los espacios en horas enteras", () => {
    expect(
      hourBounds(
        [
          { startMinute: 9 * 60 + 30, endMinute: 13 * 60 },
          { startMinute: 14 * 60, endMinute: 20 * 60 + 30 },
        ],
        [],
      ),
    ).toEqual({ startHour: 9, endHour: 21 });
  });

  it("se estira para que una reserva fuera de horario igual se vea", () => {
    expect(
      hourBounds([{ startMinute: 9 * 60, endMinute: 18 * 60 }], [
        { startMinute: 21 * 60, endMinute: 23 * 60 },
      ]),
    ).toEqual({ startHour: 9, endHour: 23 });
  });
});

describe("reservas que se pisan", () => {
  it("las que no se tocan ocupan todo el ancho", () => {
    const r = layoutOverlaps([
      { id: "a", startMinute: 600, endMinute: 660 },
      { id: "b", startMinute: 660, endMinute: 720 },
    ]);
    expect(r.map((e) => [e.id, e.column, e.columns])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("dos a la misma hora se reparten el ancho", () => {
    const r = layoutOverlaps([
      { id: "a", startMinute: 600, endMinute: 720 },
      { id: "b", startMinute: 630, endMinute: 690 },
      { id: "c", startMinute: 690, endMinute: 750 },
    ]);
    const por = Object.fromEntries(r.map((e) => [e.id, [e.column, e.columns]]));
    expect(por).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] });
  });
});
