import { describe, expect, it } from "vitest";
import { contraste } from "@/lib/contraste";
import { PURPURA, paletaDelVendedor } from "./colores";

describe("paletaDelVendedor", () => {
  it("sin color propio usa el púrpura de la marca con letra blanca", () => {
    expect(paletaDelVendedor(null)).toEqual({ fondo: PURPURA, tinta: "#FFFFFF", acento: "#FFD51F" });
  });

  it("un color inválido no rompe la pieza: cae en el púrpura", () => {
    expect(paletaDelVendedor("rojo").fondo).toBe(PURPURA);
  });

  it("con un color claro la letra pasa a oscura", () => {
    const p = paletaDelVendedor("#FFE8A3");
    expect(p.tinta).not.toBe("#FFFFFF");
    expect(contraste(p.fondo, p.tinta)).toBeGreaterThanOrEqual(4.5);
  });

  it("el acento siempre se lee sobre el fondo", () => {
    for (const color of ["#7C2BFF", "#FFD51F", "#0A7D3E", "#E91E63", "#FFFFFF", "#000000"]) {
      const p = paletaDelVendedor(color);
      expect(contraste(p.fondo, p.acento)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
