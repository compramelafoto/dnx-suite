import { describe, expect, test } from "vitest";
import { PLANTILLAS, plantillaPorClave } from "./plantillas";
import { contraste } from "./contraste";
import { resolverTema } from "./tema";

describe("catálogo de plantillas", () => {
  test("son seis y cada una tiene clave única", () => {
    expect(PLANTILLAS).toHaveLength(6);
    expect(new Set(PLANTILLAS.map((p) => p.clave)).size).toBe(6);
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
