import { describe, expect, it } from "vitest";
import { BOOKINGS_TIME_ZONE } from "./time";
import { computeFreeHoursBalance, monthBoundsFor } from "./free-hours";

const tz = BOOKINGS_TIME_ZONE;

describe("la bolsa del mes", () => {
  it("sin nada usado, están las horas completas", () => {
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: 2,
      usedMinutes: 0,
      monthKey: "2026-09",
    });
    expect(b.grantedMinutes).toBe(120);
    expect(b.availableMinutes).toBe(120);
  });

  it("lo usado se descuenta", () => {
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: 2,
      usedMinutes: 60,
      monthKey: "2026-09",
    });
    expect(b.availableMinutes).toBe(60);
  });

  it("un espacio que no bonifica no da nada", () => {
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: 0,
      usedMinutes: 0,
      monthKey: "2026-09",
    });
    expect(b.availableMinutes).toBe(0);
  });

  it("nunca queda negativa, aunque se haya usado de más", () => {
    // Puede pasar si el dueño baja las horas bonificadas con reservas ya hechas.
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: 1,
      usedMinutes: 300,
      monthKey: "2026-09",
    });
    expect(b.availableMinutes).toBe(0);
  });

  it("un valor absurdo se trata como cero, no rompe el precio", () => {
    const b = computeFreeHoursBalance({
      grantedHoursPerMonth: Number.NaN,
      usedMinutes: -50,
      monthKey: "2026-09",
    });
    expect(b.grantedMinutes).toBe(0);
    expect(b.usedMinutes).toBe(0);
    expect(b.availableMinutes).toBe(0);
  });
});

describe("los bordes del mes", () => {
  it("son la medianoche local del 1 y la del 1 siguiente", () => {
    const b = monthBoundsFor(new Date("2026-09-19T17:00:00Z"), tz);
    // Medianoche del 1/9 en Rosario = 03:00Z.
    expect(b.startAt.toISOString()).toBe("2026-09-01T03:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("diciembre pasa a enero del año siguiente", () => {
    const b = monthBoundsFor(new Date("2026-12-15T15:00:00Z"), tz);
    expect(b.endAt.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("un instante que en UTC ya es del mes siguiente pertenece al mes local", () => {
    // 2026-10-01T01:00Z todavía es 30 de septiembre en Rosario.
    const b = monthBoundsFor(new Date("2026-10-01T01:00:00Z"), tz);
    expect(b.startAt.toISOString()).toBe("2026-09-01T03:00:00.000Z");
  });

  it("febrero, que es el mes corto, cierra bien", () => {
    const b = monthBoundsFor(new Date("2026-02-10T15:00:00Z"), tz);
    expect(b.startAt.toISOString()).toBe("2026-02-01T03:00:00.000Z");
    expect(b.endAt.toISOString()).toBe("2026-03-01T03:00:00.000Z");
  });
});
