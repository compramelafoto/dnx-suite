import { describe, expect, test } from "vitest";
import { FAMILIAS, PLANTILLAS, plantillaPorClave, plantillasDeFamilia } from "./plantillas";
import { contraste } from "./contraste";
import { resolverTema } from "./tema";

describe("catálogo de plantillas", () => {
  test("cada plantilla tiene una clave única", () => {
    /*
      Se cuentan contra sí mismas y no contra un número fijo: el catálogo crece, y una
      prueba que diga "son seis" sólo obliga a editarla cada vez sin verificar nada.
      Lo que importa es que no haya dos con la misma clave, porque la clave es lo que
      se guarda en el evento.
    */
    expect(new Set(PLANTILLAS.map((p) => p.clave)).size).toBe(PLANTILLAS.length);
  });

  test("todas pertenecen a una familia declarada", () => {
    const declaradas = new Set(FAMILIAS.map((f) => f.clave));
    for (const p of PLANTILLAS) expect(declaradas.has(p.familia)).toBe(true);
  });

  test("ninguna familia queda vacía en el selector", () => {
    // Una familia sin plantillas sería una solapa que se abre y no muestra nada.
    for (const f of FAMILIAS) expect(plantillasDeFamilia(f.clave).length).toBeGreaterThan(0);
  });

  test.each(PLANTILLAS.map((p) => [p.nombre, p] as const))(
    "«%s» se lee desde el fondo del salón",
    (_nombre, plantilla) => {
      const { fondo, texto, acento, textoSobreAcento } = plantilla.tokens;

      // Texto sobre fondo: es el cuerpo, necesita el mínimo de texto normal.
      expect(contraste(texto, fondo)).toBeGreaterThanOrEqual(4.5);
      // El acento es el botón grande y el QR: alcanza el mínimo de elemento grande.
      expect(contraste(acento, fondo)).toBeGreaterThanOrEqual(3);
      // Lo que va escrito ARRIBA del acento (el texto del botón) sí es texto normal.
      expect(contraste(textoSobreAcento, acento)).toBeGreaterThanOrEqual(4.5);
    },
  );

  test.each(PLANTILLAS.map((p) => [p.nombre, p] as const))(
    "«%s» pasa la validación de tokens sin caerse al tema base",
    (_nombre, plantilla) => {
      // Si un color estuviera mal escrito, resolverTema lo reemplazaría en silencio
      // y la plantilla se vería como la de la marca sin que nadie se entere.
      expect(resolverTema(plantilla.tokens)).toEqual(plantilla.tokens);
    },
  );

  test("una clave inexistente no devuelve cualquier cosa", () => {
    expect(plantillaPorClave("no-existe")).toBeUndefined();
  });
});
