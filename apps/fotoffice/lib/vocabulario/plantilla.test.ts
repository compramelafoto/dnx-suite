import { describe, expect, it } from "vitest";
import { personVocabulary } from "./personas";
import { aplicarVocabulario } from "./plantilla";

const socios = personVocabulary(null);
const voluntarios = personVocabulary({
  singular: "voluntario/a",
  plural: "voluntarios/as",
});

/**
 * Los marcadores del catálogo de módulos.
 *
 * El menú lateral y el inicio del workspace sacan sus etiquetas de un catálogo global, que no
 * sabe en qué workspace está parado quien mira. La alternativa —buscar la palabra "socio" en
 * el texto y reemplazarla— destrozaría frases: "asociación" y "asociarse" contienen "socia".
 * Por eso los textos llevan marcadores explícitos y solo se sustituye lo que está marcado.
 */
describe("aplicarVocabulario", () => {
  it("reemplaza las cuatro formas", () => {
    expect(aplicarVocabulario("{Persona} {persona} {Personas} {personas}", voluntarios)).toBe(
      "Voluntario/a voluntario/a Voluntarios/as voluntarios/as",
    );
  });

  it("sin configurar nada, dice socios", () => {
    expect(aplicarVocabulario("Padrón de {personas}", socios)).toBe("Padrón de socios");
  });

  it("con Foto Positiva, dice voluntarios", () => {
    expect(aplicarVocabulario("Padrón de {personas}", voluntarios)).toBe(
      "Padrón de voluntarios/as",
    );
  });

  it("reemplaza todas las apariciones, no solo la primera", () => {
    expect(aplicarVocabulario("{personas} y más {personas}", socios)).toBe(
      "socios y más socios",
    );
  });

  it("no toca palabras que contienen la palabra, solo los marcadores", () => {
    // Este es el caso que justifica todo el diseño: un reemplazo de texto plano
    // convertiría "asociación" en "avoluntario/ación".
    const texto = "La asociación permite asociarse a cualquier {persona}";
    expect(aplicarVocabulario(texto, voluntarios)).toBe(
      "La asociación permite asociarse a cualquier voluntario/a",
    );
  });

  it("un texto sin marcadores vuelve igual", () => {
    expect(aplicarVocabulario("Carnets", socios)).toBe("Carnets");
  });

  it("un marcador que no existe se deja como está, no se borra", () => {
    // Borrarlo dejaría una frase incompleta y nadie se enteraría; dejarlo visible hace que
    // se note en la primera mirada.
    expect(aplicarVocabulario("Hola {inventado}", socios)).toBe("Hola {inventado}");
  });

  it("no rompe con texto vacío", () => {
    expect(aplicarVocabulario("", socios)).toBe("");
  });
});
