import { describe, expect, test } from "vitest";
import { LIMITE_POR_LOTE, clavesABorrar, enLotes } from "./claves";

describe("qué archivos se borran", () => {
  test("junta originales, variantes y paquetes", () => {
    const r = clavesABorrar({
      originales: ["e/1/foto.jpg"],
      variantes: ["e/1/foto-chica.jpg"],
      paquetes: ["e/1/paquete-1.zip"],
    });
    expect(r).toEqual(["e/1/foto.jpg", "e/1/foto-chica.jpg", "e/1/paquete-1.zip"]);
  });

  test("no repite una clave que aparece dos veces", () => {
    const r = clavesABorrar({
      originales: ["a.jpg", "a.jpg"],
      variantes: ["a.jpg"],
      paquetes: [],
    });
    expect(r).toEqual(["a.jpg"]);
  });

  test("descarta las vacías y las nulas", () => {
    const r = clavesABorrar({
      originales: ["a.jpg", null, ""],
      variantes: ["  "],
      paquetes: [null],
    });
    expect(r).toEqual(["a.jpg"]);
  });

  test("sin nada que borrar devuelve una lista vacía", () => {
    expect(clavesABorrar({ originales: [], variantes: [], paquetes: [] })).toEqual([]);
  });
});

describe("los lotes de borrado", () => {
  test("el tope por pedido es de 1000, que es el de S3", () => {
    expect(LIMITE_POR_LOTE).toBe(1000);
  });

  test("parte una lista larga en lotes del tamaño pedido", () => {
    expect(enLotes(["a", "b", "c", "d", "e"], 2)).toEqual([["a", "b"], ["c", "d"], ["e"]]);
  });

  test("una lista más corta que el lote sale entera", () => {
    expect(enLotes(["a"], 1000)).toEqual([["a"]]);
  });

  test("una lista vacía no produce ningún lote", () => {
    expect(enLotes([], 1000)).toEqual([]);
  });
});
