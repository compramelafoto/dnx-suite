import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/db", () => ({ prisma: {} }));

import { estadoCalificacion, estadoVenta, plazoParaCalificar } from "./estado";

const DIA = 24 * 60 * 60 * 1000;
const confirmada = new Date("2026-11-01T12:00:00Z");

describe("estadoCalificacion", () => {
  it("confirmada, dentro del plazo y sin calificar: formulario", () => {
    const ahora = new Date(confirmada.getTime() + 29 * DIA);
    expect(estadoCalificacion({ status: "CONFIRMED", resolvedAt: confirmada }, false, ahora)).toBe("FORMULARIO");
  });

  it("el último instante del plazo todavía vale; un instante después, venció", () => {
    const limite = plazoParaCalificar(confirmada);
    expect(limite.getTime() - confirmada.getTime()).toBe(30 * DIA);
    expect(estadoCalificacion({ status: "CONFIRMED", resolvedAt: confirmada }, false, limite)).toBe("FORMULARIO");
    expect(
      estadoCalificacion({ status: "CONFIRMED", resolvedAt: confirmada }, false, new Date(limite.getTime() + 1)),
    ).toBe("VENCIDO");
  });

  it("si ya calificó, lo dice aunque el plazo haya pasado", () => {
    const tarde = new Date(confirmada.getTime() + 90 * DIA);
    expect(estadoCalificacion({ status: "CONFIRMED", resolvedAt: confirmada }, true, tarde)).toBe("YA_CALIFICASTE");
  });

  it("una venta no confirmada no se califica", () => {
    for (const status of ["PENDING_BUYER", "DECLINED", "EXPIRED"] as const) {
      expect(estadoCalificacion({ status, resolvedAt: confirmada }, false)).toBe("NO_CORRESPONDE");
    }
    expect(estadoCalificacion({ status: "CONFIRMED", resolvedAt: null }, false)).toBe("NO_CORRESPONDE");
  });
});

describe("estadoVenta", () => {
  it("nombra el estado según quién mira", () => {
    expect(estadoVenta("PENDING_BUYER", "COMPRADOR").texto).toBe("Falta que confirmes");
    expect(estadoVenta("PENDING_BUYER", "VENDEDOR").texto).toBe("Esperando al comprador");
    expect(estadoVenta("CONFIRMED", "VENDEDOR").clase).toContain("estado-publicada");
  });
});
