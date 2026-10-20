import { describe, expect, it } from "vitest";
import { diaArgentino, mesArgentino, mesSiguiente } from "./dia-argentino";

describe("día y mes argentinos", () => {
  it("usa la hora argentina, no UTC", () => {
    // 02:00 UTC del 1/11 son las 23:00 del 31/10 en Argentina.
    expect(diaArgentino(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
    expect(mesArgentino(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
    expect(mesArgentino(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11");
  });
  it("mes siguiente, con cambio de año", () => {
    expect(mesSiguiente("2026-10")).toBe("2026-11");
    expect(mesSiguiente("2026-12")).toBe("2027-01");
  });
});
