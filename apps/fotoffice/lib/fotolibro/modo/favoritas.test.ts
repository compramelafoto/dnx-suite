import { describe, expect, it } from "vitest";
import { generarBloques, marcosEnProporcion } from "./bloques";
import { leerEstadoFotolibro } from "./estado";
import { aplicarFavorita, cambiarVariante } from "./operaciones";
import { leerFavorita } from "../favoritas-tipos";

const lienzo = { width: 7205, height: 3602, dpi: 300 };
const foto = (id: string) => ({ id, url: `u/${id}`, vista: "", mini: "", w: 3000, h: 2000, nombre: id });

function libro() {
  const e = leerEstadoFotolibro({ fotolibro: { fotos: ["a", "b", "c"].map(foto) } }, 2);
  e.pliegos[0]!.todo.fotos = ["a", "b", "c"];
  e.pliegos[1]!.todo.fotos = ["c", "a", "b"];
  return e;
}

describe("distribuciones favoritas", () => {
  it("se guarda la de un pliego y se aplica igual en otro", () => {
    const e = libro();
    e.pliegos[0]!.todo.variante = 5;
    const bloques = generarBloques(e, lienzo, []);
    const marcos = marcosEnProporcion(bloques, 0, lienzo);
    expect(marcos).toHaveLength(3);
    const x = aplicarFavorita(e, 1, marcos);
    const otros = marcosEnProporcion(generarBloques(x, lienzo, []), 1, lienzo);
    otros.forEach((m, i) => expect(m.x).toBeCloseTo(marcos[i]!.x, 5));
  });

  it("no se aplica si la cantidad de fotos no coincide, y A/Q vuelve a las del sistema", () => {
    const e = libro();
    expect(aplicarFavorita(e, 0, [{ x: 0, y: 0, w: 1, h: 1 }])).toBe(e);
    const x = aplicarFavorita(e, 0, [{ x: 0, y: 0, w: 0.3, h: 1 }, { x: 0.35, y: 0, w: 0.3, h: 1 }, { x: 0.7, y: 0, w: 0.3, h: 1 }]);
    expect(x.pliegos[0]!.todo.marcos).toHaveLength(3);
    expect(cambiarVariante(x, 0, "todo", 1).pliegos[0]!.todo.marcos).toBeUndefined();
  });

  it("valida lo que llega: marcos dentro del pliego", () => {
    expect(leerFavorita({ id: "1", nombre: "x", marcos: [{ x: 0, y: 0, w: 1, h: 1 }] })).not.toBeNull();
    expect(leerFavorita({ id: "1", marcos: [{ x: 0.5, y: 0, w: 0.9, h: 1 }] })).toBeNull();
    expect(leerFavorita({ id: "1", marcos: [] })).toBeNull();
  });
});
