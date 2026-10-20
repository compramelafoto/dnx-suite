import { describe, expect, it } from "vitest";
import { sumarDiasHabiles } from "./dias-habiles";

describe("sumarDiasHabiles", () => {
  it("de lunes a miércoles", () => {
    expect(sumarDiasHabiles("2026-10-19", 2)).toBe("2026-10-21");
  });
  it("de jueves salta el fin de semana", () => {
    expect(sumarDiasHabiles("2026-10-22", 2)).toBe("2026-10-26");
  });
  it("salta un feriado nacional (25/12/2026 es viernes)", () => {
    expect(sumarDiasHabiles("2026-12-23", 2)).toBe("2026-12-28");
  });
  it("un pago en sábado cuenta desde el lunes", () => {
    expect(sumarDiasHabiles("2026-10-24", 2)).toBe("2026-10-27");
  });
});
