import { describe, expect, it } from "vitest";
import { anguloTotal, recetaInicial, validarReceta } from "./receta";
import { huellaDe } from "./huella";

describe("receta", () => {
  it("la inicial es válida, neutra y sin giro", () => {
    const r = recetaInicial();
    expect(validarReceta(r)).toEqual(r);
    expect(anguloTotal(r)).toBe(0);
  });
  it("rechaza encuadres fuera de la foto, giros raros y enderezados de más", () => {
    const r = recetaInicial();
    expect(validarReceta({ ...r, encuadre: { x: 0.6, y: 0, ancho: 0.5, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...r, rotacion90: 45 })).toBeNull();
    expect(validarReceta({ ...r, enderezar: 11 })).toBeNull();
    expect(validarReceta({ ...r, modo: "ENCAJAR" })).toBeNull();
    expect(validarReceta("no")).toBeNull();
  });
  it("el ángulo total suma giro y enderezado", () => {
    expect(anguloTotal({ ...recetaInicial(), rotacion90: 90, enderezar: -3.5 })).toBe(86.5);
  });
  it("la huella no depende del orden de las claves", () => {
    expect(huellaDe({ a: 1, b: { c: 2, d: 3 } })).toBe(huellaDe({ b: { d: 3, c: 2 }, a: 1 }));
    expect(huellaDe({ a: 1 })).not.toBe(huellaDe({ a: 2 }));
  });
});
