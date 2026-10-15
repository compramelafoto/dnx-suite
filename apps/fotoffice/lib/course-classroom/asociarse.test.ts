// lib/course-classroom/asociarse.test.ts
import { describe, expect, it } from "vitest";
import { asociarseAbierto } from "./asociarse";

describe("¿está abierto Asociarse?", () => {
  it("sólo con el módulo de socios, cobros conectados y valor de cuota", () => {
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: true, hayValorCuota: true })).toBe(true);
    expect(asociarseAbierto({ moduloSocios: false, puedeCobrar: true, hayValorCuota: true })).toBe(false);
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: false, hayValorCuota: true })).toBe(false);
    expect(asociarseAbierto({ moduloSocios: true, puedeCobrar: true, hayValorCuota: false })).toBe(false);
  });
});
