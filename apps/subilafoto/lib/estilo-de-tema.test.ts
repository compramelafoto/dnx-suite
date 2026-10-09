import { describe, expect, test } from "vitest";
import { estiloDeTema } from "./estilo-de-tema";
import { TEMA_BASE } from "./tema";

describe("el estilo que se aplica a una pantalla", () => {
  test("sin textura, el fondo es el color solo", () => {
    const estilo = estiloDeTema({ ...TEMA_BASE, textura: "ninguna" });

    expect(estilo.background).toBe(TEMA_BASE.fondo);
    expect(estilo.backgroundImage).toBeUndefined();
  });

  test("con textura, el color queda abajo y el dibujo arriba", () => {
    /*
      El color tiene que seguir estando: la textura es un SVG con partes transparentes, y
      sin color de fondo la pantalla del salón quedaría blanca con dibujitos.
    */
    const estilo = estiloDeTema({ ...TEMA_BASE, textura: "estrellas" });

    expect(estilo.background).toBe(TEMA_BASE.fondo);
    expect(estilo.backgroundImage).toContain("data:image/svg+xml");
    expect(estilo.backgroundSize).toBeTruthy();
  });

  test("lleva el texto y la tipografía del tema", () => {
    const estilo = estiloDeTema(TEMA_BASE);

    expect(estilo.color).toBe(TEMA_BASE.texto);
    expect(estilo.fontFamily).toContain(TEMA_BASE.tipografia);
  });

  test("la tipografía siempre tiene de dónde caerse", () => {
    // Si la fuente no cargó —datos móviles en un salón—, el texto se tiene que ver igual.
    const estilo = estiloDeTema(TEMA_BASE);

    expect(estilo.fontFamily).toContain("sans-serif");
  });

  test("la textura usa el acento y no el color del texto", () => {
    // Con el color del texto el dibujo competiría con lo que hay que leer.
    const conAcentoRaro = { ...TEMA_BASE, acento: "#FF0000", textura: "lunares" as const };
    const estilo = estiloDeTema(conAcentoRaro);

    expect(estilo.backgroundImage).toContain("%23FF0000");
  });
});
