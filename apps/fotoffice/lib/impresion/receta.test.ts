import { describe, expect, it } from "vitest";
import { COLOR_BORDE_POR_OMISION, anguloTotal, colorBordeDe, recetaInicial, validarReceta, type Receta } from "./receta";
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
    expect(validarReceta({ ...r, modo: "OTRO" })).toBeNull();
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

describe("receta de la etapa 2", () => {
  it("una receta guardada en la etapa 1 (sin orientación ni color) sigue siendo válida e igual", () => {
    // Tal cual la guardó el carnet en la base: sin `orientacion` ni `colorBorde`.
    const etapa1 = {
      version: 1,
      modo: "RECORTAR",
      rotacion90: 90,
      enderezar: -2.5,
      encuadre: { x: 0.1, y: 0.2, ancho: 0.5, alto: 0.6 },
      ajustes: { exposicion: 5, contraste: 0, luces: 0, sombras: 0, blancos: 0, negros: 0, temperatura: 0, tinte: 0, saturacion: 0, intensidad: 0 },
      nitidez: null,
    };
    expect(validarReceta(etapa1)).toEqual(etapa1);
    expect(colorBordeDe(validarReceta(etapa1)!)).toBe("#ffffff");
  });

  it("ENCAJAR acepta un encuadre que se sale de la foto; RECORTAR no", () => {
    const encajar: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "HORIZONTAL", colorBorde: "#ffffff", encuadre: { x: 0, y: -0.0965, ancho: 1, alto: 1.193 } };
    expect(validarReceta(encajar)).toEqual(encajar);
    expect(validarReceta({ ...encajar, modo: "RECORTAR" })).toBeNull();
  });

  it("ENCAJAR: un lado de exactamente 20 vale; 20,01 no", () => {
    const base: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL" };
    expect(validarReceta({ ...base, encuadre: { x: -9.5, y: 0, ancho: 20, alto: 1 } })).not.toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: 0, y: -9.5, ancho: 1, alto: 20 } })).not.toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: -9.5, y: 0, ancho: 20.01, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: 0, y: -9.5, ancho: 1, alto: 20.01 } })).toBeNull();
  });
  it("ENCAJAR rechaza un encuadre que no toca la foto o que la deja diminuta", () => {
    const base: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL" };
    expect(validarReceta({ ...base, encuadre: { x: 1.5, y: 0, ancho: 1, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: -12, y: 0, ancho: 25, alto: 1 } })).toBeNull();
    expect(validarReceta({ ...base, encuadre: { x: 0, y: 0, ancho: 0, alto: 1 } })).toBeNull();
  });

  it("color de borde: #rrggbb en minúscula; si falta, blanco", () => {
    const r: Receta = { ...recetaInicial(), modo: "ENCAJAR", orientacion: "VERTICAL", colorBorde: "#102030" };
    expect(validarReceta(r)).toEqual(r);
    expect(colorBordeDe(r)).toBe("#102030");
    expect(validarReceta({ ...r, colorBorde: "red" })).toBeNull();
    expect(validarReceta({ ...r, colorBorde: "#FFF" })).toBeNull();
    expect(colorBordeDe(recetaInicial())).toBe(COLOR_BORDE_POR_OMISION);
  });

  it("rechaza una orientación desconocida", () => {
    expect(validarReceta({ ...recetaInicial(), orientacion: "DIAGONAL" })).toBeNull();
  });
});
