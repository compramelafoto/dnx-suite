import { describe, expect, it } from "vitest";
import { compararNombres, ordenarPorNombre } from "./orden";

const nombres = (xs: { fileName: string }[]) => xs.map((x) => x.fileName);
const f = (...ns: string[]) => ns.map((fileName) => ({ fileName }));

describe("orden natural por nombre", () => {
  it("IMG_2 va antes que IMG_10", () => {
    expect(nombres(ordenarPorNombre(f("IMG_10.jpg", "IMG_2.jpg", "IMG_1.jpg")))).toEqual(["IMG_1.jpg", "IMG_2.jpg", "IMG_10.jpg"]);
  });

  it("no distingue mayúsculas", () => {
    expect(nombres(ordenarPorNombre(f("b.jpg", "A.jpg", "c.JPG")))).toEqual(["A.jpg", "b.jpg", "c.JPG"]);
    expect(compararNombres("IMG_1", "img_1")).toBe(0);
  });

  it("es estable: los iguales conservan el orden de entrada", () => {
    const entrada = [{ fileName: "IMG_1.jpg", id: "a" }, { fileName: "img_1.JPG", id: "b" }, { fileName: "IMG_1.jpg", id: "c" }];
    expect(ordenarPorNombre(entrada).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("maneja números muy grandes y ceros a la izquierda", () => {
    expect(compararNombres("a99999999999999999999", "a100000000000000000000")).toBeLessThan(0);
    expect(compararNombres("IMG_002", "IMG_10")).toBeLessThan(0);
    expect(compararNombres("IMG_010", "IMG_9")).toBeGreaterThan(0);
  });

  it("compara por tramos: los números separados no se mezclan", () => {
    expect(nombres(ordenarPorNombre(f("a10b2", "a2b10", "a2b2", "a10b10")))).toEqual(["a2b2", "a2b10", "a10b2", "a10b10"]);
  });

  it("un nombre que es prefijo de otro va primero; número antes que texto", () => {
    expect(nombres(ordenarPorNombre(f("foto-b", "foto", "foto-1")))).toEqual(["foto", "foto-1", "foto-b"]);
    expect(nombres(ordenarPorNombre(f("a", "1")))).toEqual(["1", "a"]);
  });

  it("no modifica la lista de entrada", () => {
    const entrada = f("b", "a");
    ordenarPorNombre(entrada);
    expect(nombres(entrada)).toEqual(["b", "a"]);
  });

  it("lista vacía y de uno", () => {
    expect(ordenarPorNombre([])).toEqual([]);
    expect(ordenarPorNombre(f("x"))).toEqual(f("x"));
  });
});

describe("ordenarFotosDeGaleria", () => {
  const f = (id: string, fileName: string, order: number) => ({ id, fileName, order });
  it("NOMBRE ignora order y usa orden natural", async () => {
    const { ordenarFotosDeGaleria } = await import("./orden");
    expect(ordenarFotosDeGaleria([f("a", "IMG_10.jpg", 0), f("b", "IMG_2.jpg", 1)], "NOMBRE").map((x) => x.id)).toEqual(["b", "a"]);
  });
  it("MANUAL usa order y desempata por nombre natural e id", async () => {
    const { ordenarFotosDeGaleria } = await import("./orden");
    expect(ordenarFotosDeGaleria([f("a", "B.jpg", 3), f("b", "IMG_10.jpg", 3), f("c", "IMG_2.jpg", 3), f("d", "Z.jpg", 1)], "MANUAL").map((x) => x.id)).toEqual(["d", "a", "c", "b"]);
  });
});
