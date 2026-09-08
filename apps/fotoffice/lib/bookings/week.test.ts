import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { shiftWeeks, weekDays, weekRange } from "./week";

const tz = BOOKINGS_TIME_ZONE;

describe("la semana que se muestra", () => {
  it("empieza el lunes, aunque el día pedido sea un jueves", () => {
    // Jueves 17/09/2026 a las 15:00 locales.
    const r = weekRange(new Date("2026-09-17T18:00:00Z"), tz);
    expect(weekDays(r, tz)[0].ymd).toBe("2026-09-14");
  });

  it("un domingo pertenece a la semana que arrancó el lunes anterior", () => {
    // Sin esta regla, el domingo se vería solo en una semana propia.
    const r = weekRange(new Date("2026-09-20T18:00:00Z"), tz);
    const dias = weekDays(r, tz);
    expect(dias[0].ymd).toBe("2026-09-14");
    expect(dias[6].ymd).toBe("2026-09-20");
  });

  it("tiene siete días", () => {
    expect(weekDays(weekRange(new Date("2026-09-17T18:00:00Z"), tz), tz)).toHaveLength(7);
  });

  it("cada día trae una etiqueta legible", () => {
    const dias = weekDays(weekRange(new Date("2026-09-17T18:00:00Z"), tz), tz);
    expect(dias[0].label.toLowerCase()).toContain("lun");
    expect(dias[0].label).toContain("14");
  });

  it("moverse una semana adelante y volver deja el mismo lugar", () => {
    const jueves = new Date("2026-09-17T18:00:00Z");
    const ida = shiftWeeks(jueves, 1);
    expect(weekDays(weekRange(ida, tz), tz)[0].ymd).toBe("2026-09-21");
    expect(weekDays(weekRange(shiftWeeks(ida, -1), tz), tz)[0].ymd).toBe("2026-09-14");
  });

  it("la ventana arranca a la medianoche local del lunes", () => {
    const r = weekRange(new Date("2026-09-17T18:00:00Z"), tz);
    // Medianoche del lunes 14 en Rosario = 03:00Z.
    expect(r.startAt.toISOString()).toBe("2026-09-14T03:00:00.000Z");
    expect(r.endAt.getTime() - r.startAt.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });
});
