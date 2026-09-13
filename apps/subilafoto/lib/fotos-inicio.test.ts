import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { COPIAS_DEL_BUCLE, FOTOS_INICIO, duplicarParaBucle } from "./fotos-inicio";

/** Ancho de una foto en la franja, al tamaño más grande (9rem de alto, 3:2) más su separación. */
const ANCHO_DE_UNA_FOTO = 9 * 16 * 1.5 + 12;
/** El monitor más ancho que se puede esperar: un ultrapanorámico de 3440. */
const PANTALLA_MAS_ANCHA = 3440;

describe("franja de fotos del inicio", () => {
  test("la pista es más ancha que cualquier pantalla, aun con pocas fotos", () => {
    // La animación desplaza una copia entera y vuelve a cero. Para que nunca
    // se vea el vacío del final, lo que queda detrás —las copias restantes—
    // tiene que alcanzar para tapar la pantalla más ancha.
    const unaCopia = FOTOS_INICIO.length * ANCHO_DE_UNA_FOTO;
    expect((COPIAS_DEL_BUCLE - 1) * unaCopia).toBeGreaterThanOrEqual(PANTALLA_MAS_ANCHA);
  });

  test("el desplazamiento del CSS coincide con la cantidad de copias", () => {
    // Si alguien cambia una cosa y no la otra, la franja pega un salto en cada
    // vuelta. Es el error más fácil de cometer acá y el más difícil de ver.
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
    const esperado = `translateX(-${(100 / COPIAS_DEL_BUCLE).toFixed(4)}%)`;
    expect(css).toContain(esperado);
  });

  test("cada foto se sirve desde el propio dominio", () => {
    // Nada de enlazar a un CDN ajeno: si ese servicio cambia o corta el acceso,
    // la portada de un producto que se vende queda rota.
    for (const foto of FOTOS_INICIO) {
      expect(foto.src.startsWith("/inicio/")).toBe(true);
      expect(foto.src).not.toMatch(/^https?:/);
    }
  });

  test("cada foto tiene texto alternativo con sentido", () => {
    for (const foto of FOTOS_INICIO) {
      expect(foto.alt.trim().length).toBeGreaterThan(10);
    }
  });

  test("no hay dos archivos repetidos", () => {
    expect(new Set(FOTOS_INICIO.map((f) => f.src)).size).toBe(FOTOS_INICIO.length);
  });

  test("el bucle repite la lista conservando el orden", () => {
    const bucle = duplicarParaBucle(FOTOS_INICIO);
    const orden = FOTOS_INICIO.map((f) => f.src);

    expect(bucle).toHaveLength(FOTOS_INICIO.length * COPIAS_DEL_BUCLE);
    expect(bucle.slice(0, FOTOS_INICIO.length)).toEqual(FOTOS_INICIO);
    for (let copia = 1; copia < COPIAS_DEL_BUCLE; copia++) {
      const desde = copia * FOTOS_INICIO.length;
      const trozo = bucle.slice(desde, desde + FOTOS_INICIO.length);
      expect(trozo.map((f) => f.src)).toEqual(orden);
    }
  });

  test("las copias quedan ocultas para quien usa lector de pantalla", () => {
    // Si no, el lector lee la misma lista de fotos una vez por copia.
    const bucle = duplicarParaBucle(FOTOS_INICIO);
    expect(bucle.slice(0, FOTOS_INICIO.length).every((f) => f.duplicada)).toBe(false);
    expect(bucle.slice(FOTOS_INICIO.length).every((f) => f.duplicada)).toBe(true);
  });
});
