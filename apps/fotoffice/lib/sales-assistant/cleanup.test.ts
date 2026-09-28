import { describe, expect, it } from "vitest";
import { esCandidataACerrar } from "./cleanup";
import type { OportunidadVenta } from "./opportunity";

const HOY = new Date("2026-09-28T10:00:00Z");
const op = (p: Partial<OportunidadVenta>): OportunidadVenta =>
  ({ fechaEvento: null, modificadaEn: HOY, movimientos: [], abierta: true, ...p }) as OportunidadVenta;

describe("esCandidataACerrar", () => {
  it("propone cerrar si el evento ya pasó", () => {
    const r = esCandidataACerrar({ oportunidad: op({ fechaEvento: new Date("2026-09-26T00:00:00Z") }), staleDays: 120, hoy: HOY });
    expect(r).toEqual({ cerrar: true, motivo: "La fecha del evento ya pasó" });
  });
  it("no la cierra si el evento es hoy", () => {
    expect(esCandidataACerrar({ oportunidad: op({ fechaEvento: new Date("2026-09-28T03:00:00Z") }), staleDays: 120, hoy: HOY }).cerrar).toBe(false);
  });
  it("propone cerrar si no se movió en staleDays días", () => {
    const r = esCandidataACerrar({ oportunidad: op({ modificadaEn: new Date("2026-05-31T00:00:00Z") }), staleDays: 120, hoy: HOY });
    expect(r).toEqual({ cerrar: true, motivo: "Sin movimiento hace 120 días" });
  });
  it("no la cierra a los 119 días", () => {
    expect(esCandidataACerrar({ oportunidad: op({ modificadaEn: new Date("2026-06-01T12:00:00Z") }), staleDays: 120, hoy: HOY }).cerrar).toBe(false);
  });
});
