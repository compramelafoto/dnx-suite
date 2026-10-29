import { describe, expect, it } from "vitest";
import { generarBloques, idDeBloque, permutarHojas } from "./bloques";
import { leerEstadoFotolibro } from "./estado";
import { duplicarPliego, moverPliego, ordenTrasMover } from "./operaciones";

const lienzo = { width: 7205, height: 3602, dpi: 300 };
const foto = (id: string) => ({ id, url: `u/${id}`, vista: "", mini: "", w: 3000, h: 2000, nombre: id });

function libro() {
  const e = leerEstadoFotolibro({ fotolibro: { fotos: ["a", "b", "c"].map(foto) } }, 3);
  e.pliegos[0]!.todo.fotos = ["a"];
  e.pliegos[1]!.todo.fotos = ["b"];
  e.pliegos[2]!.todo.fotos = ["c"];
  return e;
}

describe("vista del libro: mover y duplicar pliegos", () => {
  it("mueve un pliego y corre los demás", () => {
    const x = moverPliego(libro(), 2, 0);
    expect(x.pliegos.map((p) => p.todo.fotos[0])).toEqual(["c", "a", "b"]);
    expect(ordenTrasMover(3, 2, 0)).toEqual([2, 0, 1]);
  });

  it("el encuadre y lo agregado a mano viajan con su pliego", () => {
    const e = libro();
    const bloques = generarBloques(e, lienzo, []).map((b) =>
      b.id === idDeBloque(2, "todo", "c") ? { ...b, configJson: { ...b.configJson, crop: { zoom: 2, x: 0.3, y: 0 } } } : b,
    );
    bloques.push({ id: "texto", type: "TEXT", pageIndex: 2, layout: { x: 0, y: 0, width: 10, height: 10, rotation: 0, zIndex: 50, opacity: 1, locked: false, visible: true }, configJson: { content: "Hola" } });
    const movido = moverPliego(e, 2, 0);
    const nuevos = generarBloques(movido, lienzo, permutarHojas(bloques, ordenTrasMover(3, 2, 0)));
    expect(nuevos.find((b) => b.id === idDeBloque(0, "todo", "c"))!.configJson.crop).toEqual({ zoom: 2, x: 0.3, y: 0 });
    expect(nuevos.find((b) => b.id === "texto")!.pageIndex).toBe(0);
  });

  it("duplicar copia el pliego justo después, sin tocar el original", () => {
    const e = libro();
    const x = duplicarPliego(e, 0);
    expect(x.pliegos.map((p) => p.todo.fotos[0])).toEqual(["a", "a", "b", "c"]);
    x.pliegos[1]!.todo.fotos.push("z");
    expect(x.pliegos[0]!.todo.fotos).toEqual(["a"]);
  });
});
