import { describe, expect, it } from "vitest";
import { fechaYHora, horaDeLista, soloHora } from "./formato";

describe("formato de la Bandeja (hora argentina)", () => {
  const f = new Date("2026-10-09T15:05:00.000Z"); // 12:05 en Argentina (UTC-3)

  it("muestra la hora de Argentina, no la UTC", () => {
    expect(soloHora(f)).toBe("12:05");
    expect(fechaYHora(f)).toBe("09/10/2026 12:05");
  });

  it("la lista muestra sólo la hora si es de hoy y el día si no", () => {
    expect(horaDeLista(f, new Date("2026-10-09T20:00:00.000Z"))).toBe("12:05");
    expect(horaDeLista(f, new Date("2026-10-10T20:00:00.000Z"))).toBe("09/10 12:05");
  });

  it("a las 01:00 UTC todavía es el día anterior en Argentina", () => {
    expect(fechaYHora(new Date("2026-10-10T01:00:00.000Z"))).toBe("09/10/2026 22:00");
  });
});
