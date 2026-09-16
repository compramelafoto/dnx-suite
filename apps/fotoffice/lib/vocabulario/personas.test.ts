import { describe, expect, it } from "vitest";
import {
  DEFAULT_PERSON_TERMS,
  personTermsFromRow,
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

/**
 * `personTermsFromRow` traduce los nombres de columna de la base
 * (`personSingular` / `personPlural`) al vocabulario del dominio
 * (`singular` / `plural`).
 *
 * Este mapeo vivía antes suelto dentro del cargador de datos, sin ningún test que lo
 * alcanzara: pasaba la fila cruda de Prisma directo a `personVocabulary`, que no reconocía
 * esos nombres de columna y siempre caía en "socio/socios", sin importar lo que un workspace
 * hubiera configurado. El caso "no reconoce socios donde debería decir otra cosa", al final
 * de este describe, es el que hubiera atrapado ese bug.
 */
describe("personTermsFromRow", () => {
  it("con una fila con las dos palabras, las mapea a singular/plural", () => {
    const terms = personTermsFromRow({
      personSingular: "voluntario/a",
      personPlural: "voluntarios/as",
    });
    expect(terms.singular).toBe("voluntario/a");
    expect(terms.plural).toBe("voluntarios/as");
  });

  it("con null (workspace sin configurar), devuelve las dos en null", () => {
    const terms = personTermsFromRow(null);
    expect(terms.singular).toBeNull();
    expect(terms.plural).toBeNull();
  });

  it("con una fila con solo una de las dos, mapea esa y deja la otra en null", () => {
    const terms = personTermsFromRow({ personSingular: "voluntario/a", personPlural: null });
    expect(terms.singular).toBe("voluntario/a");
    expect(terms.plural).toBeNull();

    const soloPlural = personTermsFromRow({ personSingular: null, personPlural: "alumnos" });
    expect(soloPlural.singular).toBeNull();
    expect(soloPlural.plural).toBe("alumnos");
  });

  it("una fila de voluntarios da Voluntarios/as y no Socios", () => {
    // El caso que importa: sin este test, un mapeo roto (por ejemplo, uno que ignorara
    // personSingular/personPlural) seguía "funcionando" en socios y nadie se enteraba.
    const fila = { personSingular: "voluntario/a", personPlural: "voluntarios/as" };
    const v = personVocabulary(personTermsFromRow(fila));
    expect(v.Plural).toBe("Voluntarios/as");
    expect(v.Plural).not.toBe("Socios");
  });
});
