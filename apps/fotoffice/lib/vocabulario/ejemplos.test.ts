import { describe, expect, it } from "vitest";
import { frasesDeEjemplo } from "./ejemplos";
import { personVocabulary } from "./personas";
import { aplicarVocabulario } from "./plantilla";

/**
 * La vista previa de la pantalla de palabras.
 *
 * El valor de estos tests no es comprobar que la función devuelve una lista: es que la lista
 * sigue saliendo del sistema de verdad. El día que alguien le saque los marcadores a la
 * descripción del módulo, la vista previa se volvería inmóvil —siempre el mismo texto,
 * escribas lo que escribas— y nadie se enteraría hasta que una institución se quejara.
 */
describe("frasesDeEjemplo", () => {
  it("hay frases para mostrar", () => {
    expect(frasesDeEjemplo().length).toBeGreaterThanOrEqual(3);
  });

  it("todas llevan al menos un marcador", () => {
    for (const frase of frasesDeEjemplo()) {
      expect(frase.plantilla).toMatch(/\{[Pp]ersonas?\}/);
    }
  });

  it("cada frase dice dónde se lee", () => {
    for (const frase of frasesDeEjemplo()) {
      expect(frase.donde.length).toBeGreaterThan(0);
    }
  });

  it("con voluntarios, ninguna frase sigue diciendo socios", () => {
    const voluntarios = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });
    for (const frase of frasesDeEjemplo()) {
      const resuelta = aplicarVocabulario(frase.plantilla, voluntarios);
      expect(resuelta).not.toMatch(/socio/i);
      expect(resuelta).not.toContain("{");
    }
  });

  it("sin configurar nada, se leen exactamente como hoy", () => {
    const socios = personVocabulary(null);
    const textos = frasesDeEjemplo().map((f) => aplicarVocabulario(f.plantilla, socios));
    expect(textos).toContain("Todos los socios, su estado y su ficha.");
  });
});
