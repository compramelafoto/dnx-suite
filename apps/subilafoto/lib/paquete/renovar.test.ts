import { describe, expect, test } from "vitest";
import { TOPE_DE_RENOVACIONES, sePuedeRenovar } from "./renovar";

const AHORA = new Date("2026-10-20T12:00:00Z");
const RETENCION = new Date("2026-11-10T08:00:00Z");

const listo = (extra: Partial<{ tokenExpiresAt: Date | null; regenerations: number }> = {}) => ({
  status: "READY",
  tokenExpiresAt: new Date("2026-10-19T12:00:00Z"),
  regenerations: 0,
  ...extra,
});

const BASE = { paquetes: [listo()], retentionUntil: RETENCION, ahora: AHORA };

describe("pedir enlaces nuevos", () => {
  test("con el enlace vencido se puede", () => {
    expect(sePuedeRenovar(BASE)).toEqual({ sePuede: true });
  });

  test("sin paquete todavía no hay nada que renovar", () => {
    const r = sePuedeRenovar({ ...BASE, paquetes: [] });
    expect(r.sePuede).toBe(false);
  });

  test("con el paquete a medio armar tampoco", () => {
    const r = sePuedeRenovar({ ...BASE, paquetes: [{ ...listo(), status: "BUILDING" }] });
    expect(r.sePuede).toBe(false);
  });

  test("si el enlace sigue vigente no hace falta", () => {
    const vigente = listo({ tokenExpiresAt: new Date("2026-10-25T12:00:00Z") });
    expect(sePuedeRenovar({ ...BASE, paquetes: [vigente] }).sePuede).toBe(false);
  });

  test("con el material ya borrado no se renueva nada", () => {
    const r = sePuedeRenovar({ ...BASE, ahora: RETENCION });
    expect(r).toEqual({ sePuede: false, motivo: "El material ya se borró. Se conserva 30 días." });
  });

  test("hay un tope de renovaciones", () => {
    const gastado = listo({ regenerations: TOPE_DE_RENOVACIONES });
    expect(sePuedeRenovar({ ...BASE, paquetes: [gastado] }).sePuede).toBe(false);
  });

  test("una vuelta antes del tope todavía se puede", () => {
    const casi = listo({ regenerations: TOPE_DE_RENOVACIONES - 1 });
    expect(sePuedeRenovar({ ...BASE, paquetes: [casi] })).toEqual({ sePuede: true });
  });

  test("con varias partes, alcanza con que una esté vencida", () => {
    const paquetes = [listo({ tokenExpiresAt: new Date("2026-10-25T12:00:00Z") }), listo()];
    expect(sePuedeRenovar({ ...BASE, paquetes })).toEqual({ sePuede: true });
  });

  test("un paquete sin vencimiento cuenta como vencido", () => {
    expect(sePuedeRenovar({ ...BASE, paquetes: [listo({ tokenExpiresAt: null })] })).toEqual({
      sePuede: true,
    });
  });
});
