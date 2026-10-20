import { describe, expect, test } from "vitest";
import { TAMANO_MAXIMO_PORTADA, claveDePortada, esClaveDePortada, validarPortada } from "./portada";

describe("qué archivos se aceptan como portada", () => {
  test("las imágenes que muestra cualquier navegador", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validarPortada({ tipo, bytes: 500_000 }).ok).toBe(true);
    }
  });

  test("SVG no", () => {
    /*
      El logo sí lo acepta, la portada no. Un SVG puede traer scripts y acá la imagen la
      elige el fotógrafo pero la ven todos los invitados a pantalla completa. Para una
      foto de la quinceañera tampoco tiene sentido.
    */
    expect(validarPortada({ tipo: "image/svg+xml", bytes: 1000 }).ok).toBe(false);
  });

  test("HEIC tampoco: la portada se sirve como llega", () => {
    // Las del invitado las convertimos al moderar; ésta no pasa por ahí.
    expect(validarPortada({ tipo: "image/heic", bytes: 1000 }).ok).toBe(false);
  });

  test("un archivo vacío se rechaza con un motivo entendible", () => {
    const v = validarPortada({ tipo: "image/jpeg", bytes: 0 });

    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("vacío");
  });

  test("más del tope se rechaza diciendo cuánto es el tope", () => {
    const v = validarPortada({ tipo: "image/jpeg", bytes: TAMANO_MAXIMO_PORTADA + 1 });

    expect(v.ok).toBe(false);
    expect(v.motivo).toContain("MB");
  });
});

describe("la ruta dentro del bucket", () => {
  test("cuelga del evento, para que la borre la purga a los 30 días", () => {
    /*
      Va bajo `eventos/` a propósito, al revés que el logo: la portada es **de este
      evento** y tiene que desaparecer con él. El logo es del vendedor y sobrevive.
    */
    const clave = claveDePortada("ABC123", "image/jpeg", "deadbeef");

    expect(clave.startsWith("eventos/ABC123/")).toBe(true);
    expect(clave.endsWith(".jpg")).toBe(true);
  });

  test("nada de lo que manda el navegador llega crudo a la ruta", () => {
    const clave = claveDePortada("../../otro", "image/png", "a/../../b");

    expect(clave).not.toContain("..");
    expect(clave.split("/")).toHaveLength(3);
  });

  test("un tipo desconocido no inventa extensión", () => {
    expect(claveDePortada("ABC123", "application/x-cosa", "id").endsWith(".bin")).toBe(true);
  });
});

describe("reconocer una clave nuestra", () => {
  test("la que generamos, sí", () => {
    expect(esClaveDePortada(claveDePortada("ABC123", "image/jpeg", "deadbeef"))).toBe(true);
  });

  test("una dirección pegada que empieza parecido, no", () => {
    /*
      Sin anclar al principio, `https://ajeno.com/eventos/X/portada-y.jpg` nos haría
      firmar una clave que no existe y mostrar nada.
    */
    expect(esClaveDePortada("https://ajeno.com/eventos/X/portada-y.jpg")).toBe(false);
  });

  test("una que se escapa de la carpeta, no", () => {
    expect(esClaveDePortada("eventos/../../secreto.jpg")).toBe(false);
    expect(esClaveDePortada("eventos//otro/x.jpg")).toBe(false);
  });

  test("una foto de invitado no es una portada", () => {
    // Las fotos del invitado cuelgan del mismo evento pero no llevan el prefijo.
    expect(esClaveDePortada("eventos/ABC123/cmua0tpzk0001l304or8j38la.jpg")).toBe(false);
  });

  test("vacío o nulo, no", () => {
    expect(esClaveDePortada(null)).toBe(false);
    expect(esClaveDePortada("")).toBe(false);
  });
});
