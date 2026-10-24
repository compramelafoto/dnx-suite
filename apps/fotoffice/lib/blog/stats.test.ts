import { describe, expect, it } from "vitest";
import { arDay, arDayRange, fillDays, parseBlogStatsPeriod, periodStartUtc } from "./stats";

describe("estadísticas del blog", () => {
  it("el período por omisión es 30 días y no acepta inventos", () => {
    expect(parseBlogStatsPeriod("7")).toBe(7);
    expect(parseBlogStatsPeriod("90")).toBe(90);
    expect(parseBlogStatsPeriod("15")).toBe(30);
    expect(parseBlogStatsPeriod(undefined)).toBe(30);
  });

  it("cuenta los días en hora argentina, no en UTC", () => {
    // 02:00 UTC del 3/10 todavía es 2/10 en Argentina.
    expect(arDay(new Date("2026-10-03T02:00:00Z"))).toBe("2026-10-02");
    expect(arDay(new Date("2026-10-03T03:00:00Z"))).toBe("2026-10-03");
  });

  it("arma el rango que termina hoy y su comienzo en UTC", () => {
    const now = new Date("2026-10-03T18:00:00Z");
    expect(arDayRange(3, now)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(periodStartUtc(3, now)).toBe("2026-10-01 03:00:00");
  });

  it("completa con ceros los días sin lecturas", () => {
    expect(fillDays(["2026-10-01", "2026-10-02"], [{ day: "2026-10-02", reads: 4 }])).toEqual([
      { day: "2026-10-01", reads: 0 },
      { day: "2026-10-02", reads: 4 },
    ]);
  });
});
