import { describe, expect, it } from "vitest";
import { isDigestWindow, isoWeekKey } from "./schedule";

describe("resumen semanal", () => {
  it("lunes desde las 9 de Argentina (12 UTC)", () => {
    // Lunes 12/10/2026.
    expect(isDigestWindow(new Date("2026-10-12T11:59:00Z"))).toBe(false); // 8:59 AR
    expect(isDigestWindow(new Date("2026-10-12T12:00:00Z"))).toBe(true); // 9:00 AR
    expect(isDigestWindow(new Date("2026-10-13T02:59:00Z"))).toBe(true); // lunes 23:59 AR
    expect(isDigestWindow(new Date("2026-10-13T03:00:00Z"))).toBe(false); // martes 0:00 AR
    expect(isDigestWindow(new Date("2026-10-11T15:00:00Z"))).toBe(false); // domingo
  });

  it("semana ISO según la fecha argentina", () => {
    expect(isoWeekKey(new Date("2026-10-12T12:00:00Z"))).toBe("2026-W42");
    // Lunes 0:30 UTC sigue siendo domingo en Argentina.
    expect(isoWeekKey(new Date("2026-10-12T00:30:00Z"))).toBe("2026-W41");
    expect(isoWeekKey(new Date("2027-01-01T15:00:00Z"))).toBe("2026-W53");
  });
});
