import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSON_TERMS,
  personVocabulary,
  type PersonTerms,
} from "./personas";

/**
 * Cómo se llama la gente del padrón en cada workspace.
 *
 * FotoOffice promete ser modular y multi-workspace, pero el módulo de Socios se escribió
 * para la SFPR, que tiene socios de verdad. Foto Positiva tiene voluntarios; una agencia
 * tendría colaboradores; una escuela, alumnos. La palabra no puede estar escrita en el
 * código.
 *
 * Se configuran DOS formas —singular y plural— y las mayúsculas se derivan. Pedirle a alguien
 * que cargue cuatro variantes de la misma palabra es pedirle que se equivoque en una.
 */
describe("personVocabulary", () => {
  it("sin configurar nada, son socios", () => {
    // La SFPR y todo lo que ya existe tiene que seguir leyéndose igual.
    const v = personVocabulary(null);
    expect(v.singular).toBe("socio");
    expect(v.plural).toBe("socios");
    expect(v.Singular).toBe("Socio");
    expect(v.Plural).toBe("Socios");
  });

  it("Foto Positiva tiene voluntarios", () => {
    const v = personVocabulary({ singular: "voluntario/a", plural: "voluntarios/as" });
    expect(v.singular).toBe("voluntario/a");
    expect(v.plural).toBe("voluntarios/as");
    expect(v.Singular).toBe("Voluntario/a");
    expect(v.Plural).toBe("Voluntarios/as");
  });

  it("solo se toca la primera letra, no el resto de la palabra", () => {
    // "voluntario/a" no puede volverse "Voluntario/A".
    const v = personVocabulary({ singular: "socio de honor", plural: "socios de honor" });
    expect(v.Singular).toBe("Socio de honor");
    expect(v.Plural).toBe("Socios de honor");
  });

  it("una palabra vacía o de espacios no pisa la de por omisión", () => {
    // Un campo que alguien vació en el formulario no puede dejar las pantallas sin la palabra.
    const v = personVocabulary({ singular: "   ", plural: "" });
    expect(v.singular).toBe("socio");
    expect(v.plural).toBe("socios");
  });

  it("se puede configurar solo una de las dos", () => {
    // Quien escribe el singular y se olvida del plural no queda a medias: la que falta
    // vuelve a la de por omisión en vez de quedar vacía.
    const v = personVocabulary({ singular: "voluntario/a", plural: null });
    expect(v.Singular).toBe("Voluntario/a");
    expect(v.Plural).toBe("Socios");
  });

  it("los espacios de los costados se recortan", () => {
    const v = personVocabulary({ singular: "  fotógrafo  ", plural: " fotógrafos " });
    expect(v.singular).toBe("fotógrafo");
    expect(v.plural).toBe("fotógrafos");
  });

  it("respeta una mayúscula que la persona escribió a propósito", () => {
    // Si alguien carga "Voluntario", la forma en minúscula no se la inventa el sistema:
    // se usa tal cual, porque puede ser un nombre propio de la institución.
    const v = personVocabulary({ singular: "Voluntario", plural: "Voluntarios" });
    expect(v.Singular).toBe("Voluntario");
    expect(v.singular).toBe("Voluntario");
  });

  it("los valores por omisión son los que usa el resto del sistema hoy", () => {
    expect(DEFAULT_PERSON_TERMS.singular).toBe("socio");
    expect(DEFAULT_PERSON_TERMS.plural).toBe("socios");
  });

  it("acepta la forma que devuelve la base, con nulos", () => {
    const deLaBase: PersonTerms = { singular: null, plural: null };
    const v = personVocabulary(deLaBase);
    expect(v.Plural).toBe("Socios");
  });
});
