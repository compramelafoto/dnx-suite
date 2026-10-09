import { describe, expect, test } from "vitest";
import { estiloDeTema, estiloLegible } from "./estilo-de-tema";
import { TEMA_BASE } from "./tema";

const CARTEL = "var(--slf-font-cartel)";

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

describe("el estilo del teléfono del invitado", () => {
  test("nunca usa la letra de cartel, por más que la plantilla la pida", () => {
    /*
      El defecto que esto previene: el estilo "Pista" usa una condensada en mayúsculas que
      se lee perfecto proyectada a tres metros y es ilegible en un teléfono, a oscuras, en
      una fiesta. La letra de la plantilla manda en la pantalla del salón; la del invitado
      tiene que poder leerse.
    */
    const estilo = estiloLegible({ ...TEMA_BASE, tipografia: CARTEL });

    expect(estilo.fontFamily).not.toContain("cartel");
  });

  test("tampoco la manuscrita", () => {
    const estilo = estiloLegible({ ...TEMA_BASE, tipografia: "var(--slf-font-mano)" });

    expect(estilo.fontFamily).not.toContain("mano");
  });

  test("conserva los colores y la textura del evento", () => {
    // Lo que cambia es la letra, no la identidad: el invitado tiene que ver su fiesta.
    const tema = { ...TEMA_BASE, tipografia: CARTEL, acento: "#FF0000", textura: "globos" as const };
    const estilo = estiloLegible(tema);

    expect(estilo.background).toBe(tema.fondo);
    expect(estilo.color).toBe(tema.texto);
    expect(estilo.backgroundImage).toContain("%23FF0000");
  });

  test("la serif sí se respeta: es legible y da el tono de una boda", () => {
    const estilo = estiloLegible({ ...TEMA_BASE, tipografia: "var(--slf-font-serif)" });

    expect(estilo.fontFamily).toContain("serif");
  });
});
