import { describe, expect, it } from "vitest";
import { activePresencePoint, endOfDayArgentina } from "./presence";

describe("endOfDayArgentina", () => {
  it("de mañana en Argentina: fin de ese día", () => {
    // 18/01 10:00 ART = 13:00Z → fin del 18/01 ART = 19/01 02:59:59.999Z
    expect(endOfDayArgentina(new Date("2027-01-18T13:00:00Z")).toISOString()).toBe("2027-01-19T02:59:59.999Z");
  });
  it("de noche en Argentina (ya es otro día en UTC): sigue siendo el mismo día argentino", () => {
    // 18/01 23:30 ART = 19/01 02:30Z
    expect(endOfDayArgentina(new Date("2027-01-19T02:30:00Z")).toISOString()).toBe("2027-01-19T02:59:59.999Z");
  });
});

describe("activePresencePoint", () => {
  const p = { lat: -38.02, lng: -57.53, validUntil: new Date("2027-01-19T02:59:59.999Z") };
  it("vigente: devuelve el punto", () => {
    expect(activePresencePoint(p, new Date("2027-01-18T20:00:00Z"))).toEqual({ lat: -38.02, lng: -57.53 });
  });
  it("vencido o sin presencia: null", () => {
    expect(activePresencePoint(p, new Date("2027-01-19T03:00:00Z"))).toBe(null);
    expect(activePresencePoint(null, new Date())).toBe(null);
  });
});
