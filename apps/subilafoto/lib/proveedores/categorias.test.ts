import { describe, expect, test } from "vitest";
import { CATEGORIAS, esCategoriaValida, nombreDeCategoria } from "./categorias";

describe("las categorías de proveedor", () => {
  test("no hay dos con la misma clave", () => {
    const claves = CATEGORIAS.map((c) => c.clave);
    expect(new Set(claves).size).toBe(claves.length);
  });

  test("las claves no tienen mayúsculas, espacios ni acentos", () => {
    for (const c of CATEGORIAS) expect(c.clave).toMatch(/^[a-z]+$/);
  });

  test("está la que hace falta para el criterio: el salón", () => {
    expect(CATEGORIAS.some((c) => c.clave === "salon")).toBe(true);
  });

  test("hay una salida para lo que no está en la lista", () => {
    expect(CATEGORIAS.some((c) => c.clave === "otro")).toBe(true);
  });

  test("una clave inventada no vale", () => {
    expect(esCategoriaValida("salon")).toBe(true);
    expect(esCategoriaValida("<script>")).toBe(false);
  });

  test("el nombre visible sale de la clave", () => {
    expect(nombreDeCategoria("dj")).toBe("DJ");
    // Una clave vieja que ya no está en la lista se muestra tal cual, no vacía.
    expect(nombreDeCategoria("kioscos")).toBe("kioscos");
  });
});
