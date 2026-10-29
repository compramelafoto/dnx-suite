import { describe, expect, it } from "vitest";
import { generarBloques } from "./bloques";
import { leerEstadoFotolibro } from "./estado";
import { revisarLibro } from "./revision";

const lienzo = { width: 7205, height: 3602, dpi: 300 };
const foto = (id: string, w = 6000, h = 4000, extra = {}) => ({ id, url: `u/${id}`, vista: "", mini: "", w, h, nombre: id, ...extra });

describe("revisión antes de exportar", () => {
  it("un libro bien armado no tiene problemas", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a"), foto("b")] } }, 1);
    e.pliegos[0]!.todo.fotos = ["a", "b"];
    e.pliegos[0]!.todo.variante = 0;
    const p = revisarLibro(e, generarBloques(e, lienzo, []), lienzo).filter((x) => !x.texto.includes("lomo"));
    expect(p).toEqual([]);
  });

  it("avisa pliegos vacíos y frena con una foto que se va a ver pixelada", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("chica", 600, 400)] } }, 2);
    e.pliegos[0]!.todo.fotos = ["chica"];
    const p = revisarLibro(e, generarBloques(e, lienzo, []), lienzo);
    expect(p[0]).toMatchObject({ nivel: "error", pliego: 0 });
    expect(p.some((x) => x.pliego === 1 && x.texto.includes("vacío"))).toBe(true);
  });

  it("frena si falta un original y avisa fotos repetidas", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a", 6000, 4000, { claveOriginal: "k", faltaOriginal: true })] } }, 2);
    e.pliegos[0]!.todo.fotos = ["a"];
    e.pliegos[1]!.todo.fotos = ["a"];
    const p = revisarLibro(e, generarBloques(e, lienzo, []), lienzo);
    expect(p[0]!.nivel).toBe("error");
    expect(p.some((x) => x.texto.includes("más de una vez"))).toBe(true);
  });

  it("avisa un texto pegado al borde de corte", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a")] } }, 1);
    e.pliegos[0]!.todo.fotos = ["a"];
    const bloques = [
      ...generarBloques(e, lienzo, []),
      { id: "t", type: "TEXT" as const, pageIndex: 0, layout: { x: 10, y: 1000, width: 500, height: 100, rotation: 0, zIndex: 50, opacity: 1, locked: false, visible: true }, configJson: { content: "Hola" } },
    ];
    expect(revisarLibro(e, bloques, lienzo).some((x) => x.texto.includes("borde"))).toBe(true);
  });
});
