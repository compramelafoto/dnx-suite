import { describe, expect, it, vi } from "vitest";
import { confirmarListo, esEtapaDeListo } from "./confirmar-listo";

describe("esEtapaDeListo", () => {
  it("por color amarillo o por nombre", () => {
    expect(esEtapaDeListo({ name: "Listo para retirar", color: "amarillo" })).toBe(true);
    expect(esEtapaDeListo({ name: "Para entregar" })).toBe(true);
    expect(esEtapaDeListo({ name: "En preparación", color: "azul" })).toBe(false);
    expect(esEtapaDeListo({ name: "Entregado", color: "verde" })).toBe(false);
  });
});

describe("confirmarListo", () => {
  it("a Listo pregunta, y sólo sigue si confirman", () => {
    const no = vi.fn(() => false);
    expect(confirmarListo({ name: "Listo para retirar", color: "amarillo" }, "Anna", no)).toBe(false);
    expect(String((no.mock.calls[0] as unknown[])[0])).toContain("Anna");
    expect(confirmarListo({ name: "Listo para retirar" }, null, () => true)).toBe(true);
  });
  it("a otra etapa no pregunta", () => {
    const p = vi.fn(() => false);
    expect(confirmarListo({ name: "En preparación", color: "azul" }, "Anna", p)).toBe(true);
    expect(p).not.toHaveBeenCalled();
  });
});
