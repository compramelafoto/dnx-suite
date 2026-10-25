import { describe, expect, it } from "vitest";
import { calcularVuelto, montosSugeridos } from "./vuelto";

describe("montosSugeridos", () => {
  it("el justo primero y después los billetes redondos", () => {
    // $ 47.300
    // $ 47.300 → 48.000 (billetes de 1.000 o 2.000), 50.000 (10.000), 60.000 (20.000)
    expect(montosSugeridos(4_730_000)).toEqual([4_730_000, 4_800_000, 5_000_000, 6_000_000]);
  });

  it("un total ya redondo no se repite y ofrece los billetes siguientes", () => {
    // $ 140.000
    expect(montosSugeridos(14_000_000)).toEqual([14_000_000, 15_000_000, 16_000_000]);
  });

  it("nunca sugiere algo que no se pueda juntar con los billetes de acá", () => {
    // $ 18.600: antes salía $ 50.000 o $ 100.000 (no son billetes argentinos de uso).
    expect(montosSugeridos(1_860_000)).toEqual([1_860_000, 1_900_000, 2_000_000]);
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
