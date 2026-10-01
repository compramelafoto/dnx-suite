import { describe, expect, test } from "vitest";
import { estadoDelAdicional } from "./adicional";

const AHORA = new Date("2026-10-15T12:00:00Z");
const BASE = {
  downloadStatus: "OFFERED",
  adicionalCents: 18_000,
  retentionUntil: new Date("2026-11-09T12:00:00Z"),
  ahora: AHORA,
};

describe("cuándo se puede comprar la descarga", () => {
  test("con el evento en venta y dentro del plazo, sí", () => {
    expect(estadoDelAdicional(BASE)).toEqual({ sePuede: true, precioCents: 18_000 });
  });

  test("si la descarga viene incluida, no hay nada que comprar", () => {
    const r = estadoDelAdicional({ ...BASE, adicionalCents: null });
    expect(r.sePuede).toBe(false);
    expect(r.sePuede === false && r.motivo).toMatch(/incluida/i);
  });

  test.each(["PURCHASED", "DELIVERED"])("si ya se compró (%s), no se vuelve a cobrar", (estado) => {
    const r = estadoDelAdicional({ ...BASE, downloadStatus: estado });
    expect(r.sePuede).toBe(false);
    expect(r.sePuede === false && r.motivo).toMatch(/ya compraste/i);
  });

  test("pasada la retención, no se vende", () => {
    // El material se borra solo a los 30 días. Cobrar después es cobrar por algo
    // que no existe, y el borrado no se deshace pagando.
    const r = estadoDelAdicional({ ...BASE, ahora: new Date("2026-11-10T00:00:00Z") });
    expect(r.sePuede).toBe(false);
    expect(r.sePuede === false && r.motivo).toMatch(/borró/i);
  });

  test("justo en el instante del borrado, tampoco", () => {
    const r = estadoDelAdicional({ ...BASE, ahora: BASE.retentionUntil });
    expect(r.sePuede).toBe(false);
  });

  test("un evento marcado como vencido no se vende aunque falte la fecha", () => {
    const r = estadoDelAdicional({
      ...BASE,
      downloadStatus: "EXPIRED",
      retentionUntil: null,
    });
    expect(r.sePuede).toBe(false);
  });

  test("sin fecha de retención se vende igual", () => {
    // Todavía no se calculó. No es motivo para frenar una venta.
    expect(estadoDelAdicional({ ...BASE, retentionUntil: null }).sePuede).toBe(true);
  });

  test("un precio en cero no es una venta", () => {
    expect(estadoDelAdicional({ ...BASE, adicionalCents: 0 }).sePuede).toBe(false);
  });
});
