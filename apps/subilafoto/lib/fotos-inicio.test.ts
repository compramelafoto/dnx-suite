import { describe, expect, test } from "vitest";
import { FOTOS_INICIO, duplicarParaBucle } from "./fotos-inicio";

describe("franja de fotos del inicio", () => {
  test("hay suficientes para llenar una pantalla ancha", () => {
    // Con menos de ocho, en un monitor grande se ve el hueco entre la última y
    // la primera cuando el bucle vuelve a empezar.
    expect(FOTOS_INICIO.length).toBeGreaterThanOrEqual(8);
  });

  test("cada foto se sirve desde el propio dominio", () => {
    // Nada de enlazar a Unsplash u otro CDN ajeno: si ese servicio cambia o
    // corta el acceso, la portada de un producto que se vende queda rota.
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

  test("el bucle duplica la lista conservando el orden", () => {
    // La franja se mueve un ancho completo y vuelve a cero. Para que el salto
    // sea invisible tiene que haber una segunda copia idéntica detrás.
    const bucle = duplicarParaBucle(FOTOS_INICIO);

    const orden = FOTOS_INICIO.map((f) => f.src);

    expect(bucle).toHaveLength(FOTOS_INICIO.length * 2);
    expect(bucle.slice(0, FOTOS_INICIO.length)).toEqual(FOTOS_INICIO);
    // La copia lleva el mismo orden; lo único que cambia es la marca.
    expect(bucle.slice(FOTOS_INICIO.length).map((f) => f.src)).toEqual(orden);
  });

  test("la segunda copia queda oculta para quien usa lector de pantalla", () => {
    // Si no, el lector lee dos veces la misma lista de fotos.
    const bucle = duplicarParaBucle(FOTOS_INICIO);
    expect(bucle.slice(FOTOS_INICIO.length).every((f) => f.duplicada)).toBe(true);
    expect(bucle.slice(0, FOTOS_INICIO.length).every((f) => f.duplicada)).toBe(false);
  });
});
