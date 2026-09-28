import { describe, it, expect } from "vitest";
import { presupuestoPorWorkspace, decidirWorkspace } from "./budget";

describe("presupuestoPorWorkspace", () => {
  it("reparte el tiempo equitativamente", () => {
    // 270 s = 270_000 ms, 3 workspaces: cada uno debería obtener 90_000 ms
    const presupuesto = presupuestoPorWorkspace(270_000, 3);
    expect(presupuesto).toBe(90_000);
  });

  it("calcula correctamente con un solo workspace", () => {
    const presupuesto = presupuestoPorWorkspace(300_000, 1);
    expect(presupuesto).toBe(300_000);
  });

  it("redondea hacia abajo", () => {
    // 100_000 / 3 = 33_333.33... → 33_333
    const presupuesto = presupuestoPorWorkspace(100_000, 3);
    expect(presupuesto).toBe(33_333);
  });

  it("retorna 0 si no hay workspaces pendientes", () => {
    const presupuesto = presupuestoPorWorkspace(270_000, 0);
    expect(presupuesto).toBe(0);
  });

  it("retorna 0 si hay pendientes negativas", () => {
    const presupuesto = presupuestoPorWorkspace(270_000, -5);
    expect(presupuesto).toBe(0);
  });

  it("maneja tiempo restante de 0", () => {
    const presupuesto = presupuestoPorWorkspace(0, 3);
    expect(presupuesto).toBe(0);
  });

  it("retorna 0 si el tiempo restante es negativo", () => {
    const presupuesto = presupuestoPorWorkspace(-1000, 3);
    expect(presupuesto).toBe(0);
  });
});

describe("decidirWorkspace", () => {
  it("no omite si hay suficiente tiempo total: 19 workspaces con 270 s", () => {
    // 270_000 / 19 ≈ 14_210 ms (redondeado hacia abajo)
    const decision = decidirWorkspace(270_000, 19);
    expect(decision.omitir).toBe(false);
    if (!decision.omitir) {
      expect(decision.deadlineMs).toBe(14_210);
    }
  });

  it("omite si el tiempo total restante es insuficiente: 14999 ms", () => {
    const decision = decidirWorkspace(14_999, 5);
    expect(decision.omitir).toBe(true);
  });

  it("omite si el tiempo es exactamente insuficiente: 14999 ms", () => {
    const decision = decidirWorkspace(14_999, 1);
    expect(decision.omitir).toBe(true);
  });

  it("no omite si el tiempo es exactamente el límite: 15000 ms", () => {
    const decision = decidirWorkspace(15_000, 1);
    expect(decision.omitir).toBe(false);
    if (!decision.omitir) {
      expect(decision.deadlineMs).toBe(15_000);
    }
  });
});
