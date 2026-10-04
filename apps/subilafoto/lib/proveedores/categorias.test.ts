import { describe, expect, test } from "vitest";
import {
  CATEGORIAS,
  categoriaDelEnlace,
  esCategoriaValida,
  etiquetaDeCategoria,
  nombreDeCategoria,
} from "./categorias";

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

describe("el enlace por categoría", () => {
  test("una etiqueta que es una categoría se reconoce", () => {
    expect(categoriaDelEnlace("categoria:salon")).toBe("salon");
  });

  test("el enlace general no tiene categoría", () => {
    expect(categoriaDelEnlace("Proveedores del evento")).toBeNull();
    expect(categoriaDelEnlace(null)).toBeNull();
  });

  test("una categoría que ya no existe se trata como enlace general", () => {
    // Si mañana se saca una categoría, los enlaces viejos siguen sirviendo.
    expect(categoriaDelEnlace("categoria:kioscos")).toBeNull();
  });

  test("la etiqueta se arma con la misma función que la lee", () => {
    expect(categoriaDelEnlace(etiquetaDeCategoria("dj"))).toBe("dj");
  });
});
