import { describe, expect, it } from "vitest";
import { calcularVuelto, montosSugeridos } from "./vuelto";

describe("montosSugeridos", () => {
  it("el justo primero y después los billetes redondos", () => {
    // $ 47.300
    expect(montosSugeridos(4_730_000)).toEqual([4_730_000, 4_800_000, 5_000_000, 6_000_000, 10_000_000]);
  });

  it("un total ya redondo no se repite y ofrece los billetes siguientes", () => {
    // $ 140.000
    expect(montosSugeridos(14_000_000)).toEqual([14_000_000, 15_000_000, 16_000_000, 20_000_000]);
  });

  it("como mucho cinco", () => {
    expect(montosSugeridos(350_000).length).toBeLessThanOrEqual(5);
  });

  it("sin total no sugiere nada", () => {
    expect(montosSugeridos(0)).toEqual([]);
  });
});

describe("calcularVuelto", () => {
  it("devuelve la diferencia", () => {
    expect(calcularVuelto(4_730_000, 5_000_000)).toEqual({ estado: "ok", vueltoMinor: 270_000 });
  });

  it("justo: vuelto cero", () => {
    expect(calcularVuelto(4_730_000, 4_730_000)).toEqual({ estado: "ok", vueltoMinor: 0 });
  });

  it("si no alcanza, dice cuánto falta", () => {
    expect(calcularVuelto(4_730_000, 4_000_000)).toEqual({ estado: "falta", faltaMinor: 730_000 });
  });

  it("sin monto todavía no hay nada que mostrar", () => {
    expect(calcularVuelto(4_730_000, null)).toEqual({ estado: "sin-dato" });
  });
});
