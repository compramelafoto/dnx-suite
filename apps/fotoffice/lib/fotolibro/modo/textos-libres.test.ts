import { describe, expect, it } from "vitest";
import { conCuerpo, esTextoLibre, moverTexto, nuevoTexto, puntosDe } from "./textos-libres";
import { generarBloques } from "./bloques";
import { leerEstadoFotolibro } from "./estado";

const lienzo = { width: 7205, height: 3602, dpi: 300 };

describe("textos libres del Modo Fotolibro", () => {
  it("se crean en el centro del pliego, a 24 pt, y no son automáticos", () => {
    const t = nuevoTexto(2, lienzo, "fl-txt-1");
    expect(t.pageIndex).toBe(2);
    expect(puntosDe(t, 300)).toBe(24);
    expect(esTextoLibre(t)).toBe(true);
  });

  it("el armado de fotos no los toca", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [] } }, 3);
    const t = nuevoTexto(2, lienzo, "fl-txt-1");
    expect(generarBloques(e, lienzo, [t]).find((b) => b.id === "fl-txt-1")).toEqual(t);
  });

  it("al moverlos no se salen del pliego, y al agrandar la letra crece la caja", () => {
    const t = nuevoTexto(0, lienzo, "x");
    const m = moverTexto(t, -500, 99999, lienzo);
    expect(m.layout.x).toBe(0);
    expect(m.layout.y + m.layout.height).toBe(lienzo.height);
    expect(conCuerpo(t, 48, 300).layout.height).toBeGreaterThan(t.layout.height);
  });
});
