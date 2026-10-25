import { describe, expect, it } from "vitest";
import { recorteInicial, recorteValido } from "@/lib/impresiones/recorte";
import { ajustarRecorte } from "./editor-recorte";

// Foto 6000x4000 (3:2) en 13x18 → apaisada 18x13: el recorte más grande ocupa todo el alto.
const base = recorteInicial(6000, 4000, 13, 18);
const proporcion = (r: { w: number; h: number }) => (r.w * 6000) / (r.h * 4000);

describe("ajustarRecorte", () => {
  it("no deja salir el recorte de la foto", () => {
    const r = ajustarRecorte({ ...base, x: 0.9, y: -0.5 }, base);
    expect(recorteValido(r)).toBe(true);
    expect(r.x + r.w).toBeCloseTo(1);
    expect(r.y).toBe(0);
  });
  it("no deja agrandar más que la foto ni achicar más que 3×, y conserva la proporción del tamaño", () => {
    const grande = ajustarRecorte({ x: 0, y: 0, w: 1, h: 1 }, base);
    expect(grande.w).toBeCloseTo(base.w);
    expect(grande.h).toBeCloseTo(base.h);
    const chico = ajustarRecorte({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 }, base);
    expect(chico.w).toBeCloseTo(base.w / 3);
    expect(proporcion(chico)).toBeCloseTo(18 / 13);
    expect(recorteValido(chico)).toBe(true);
  });
  it("valores raros igual quedan válidos", () => {
    for (const r of [{ x: -3, y: 7, w: 5, h: 0.2 }, { x: 0.99, y: 0.99, w: 0.4, h: 0.4 }]) expect(recorteValido(ajustarRecorte(r, base))).toBe(true);
  });
});
