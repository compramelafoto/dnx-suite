import { describe, it, expect } from "vitest";
import { presupuestoPorWorkspace } from "./budget";

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
});
