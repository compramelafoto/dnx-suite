import { describe, expect, it } from "vitest";
import { expresionMarcaX, posicionMarcaX } from "./marca-tiempo";

const W = 1920;
const w = 400;
const quieta = W - w - 40;

describe("posicionMarcaX", () => {
  it("oculta antes del minuto 1", () => expect(posicionMarcaX(30, W, w)).toBe(W));
  it("empieza a entrar en t=60", () => expect(posicionMarcaX(60, W, w)).toBe(W));
  it("entra a mitad de camino en 60,3", () => {
    expect(posicionMarcaX(60.3, W, w)).toBeCloseTo(W - 0.5 * (w + 40), 5);
  });
  it("queda quieta entre 60,6 y 67,4", () => {
    expect(posicionMarcaX(64, W, w)).toBe(quieta);
  });
  it("sale a mitad de camino en 67,7", () => {
    expect(posicionMarcaX(67.7, W, w)).toBeCloseTo(quieta + 0.5 * (w + 40), 5);
  });
  it("oculta de 68 a 660", () => expect(posicionMarcaX(68.5, W, w)).toBe(W));
  it("vuelve a entrar en 660,3", () => {
    expect(posicionMarcaX(660.3, W, w)).toBeCloseTo(W - 0.5 * (w + 40), 5);
  });
});

describe("expresionMarcaX", () => {
  it("usa el módulo de t-60 en 600", () => expect(expresionMarcaX()).toContain("mod(t-60,600)"));
  it("tiene los paréntesis balanceados", () => {
    const e = expresionMarcaX();
    expect((e.match(/\(/g) ?? []).length).toBe((e.match(/\)/g) ?? []).length);
  });
});
