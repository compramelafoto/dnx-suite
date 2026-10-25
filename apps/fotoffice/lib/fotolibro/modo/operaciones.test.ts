import { describe, expect, it } from "vitest";
import { leerEstadoFotolibro } from "./estado";
import { agregarAPagina, agregarPliego, armarPliego, cambiarModo, cambiarVariante, intercambiar, moverAPagina, quitarDePagina, quitarPliego, reemplazar } from "./operaciones";

const foto = (id: string) => ({ id, url: `https://x/${id}`, w: 3, h: 2 });
// Las pruebas de siempre son de pliegos armados por páginas.
const base = () => leerEstadoFotolibro({ fotolibro: { fotos: ["a", "b", "c", "d", "e"].map(foto), pliegos: [{ modo: "paginas" }, { modo: "paginas" }] } }, 2);
const entero = () => leerEstadoFotolibro({ fotolibro: { fotos: ["a", "b", "c", "d", "e"].map(foto) } }, 2);

describe("operaciones del Modo Fotolibro", () => {
  it("arma el pliego repartiendo la selección entre las dos páginas", () => {
    const e = armarPliego(base(), 0, ["a", "b", "c"]);
    expect(e.pliegos[0]!.izq.fotos).toEqual(["a", "b"]);
    expect(e.pliegos[0]!.der.fotos).toEqual(["c"]);
  });

  it("una sola foto va a la página vacía", () => {
    const e = armarPliego(agregarAPagina(base(), 0, "izq", ["a"]), 0, ["b"]);
    expect(e.pliegos[0]!.der.fotos).toEqual(["b"]);
  });

  it("no repite una foto dentro de la misma página y no toca el estado anterior", () => {
    const antes = base();
    const e = agregarAPagina(antes, 0, "izq", ["a", "a", "b"]);
    expect(e.pliegos[0]!.izq.fotos).toEqual(["a", "b"]);
    expect(antes.pliegos[0]!.izq.fotos).toEqual([]);
  });

  it("intercambia dos fotos entre páginas", () => {
    const e = armarPliego(base(), 0, ["a", "b"]);
    const x = intercambiar(e, { pliego: 0, lado: "izq", fotoId: "a" }, { pliego: 0, lado: "der", fotoId: "b" });
    expect(x.pliegos[0]!.izq.fotos).toEqual(["b"]);
    expect(x.pliegos[0]!.der.fotos).toEqual(["a"]);
  });

  it("mueve, quita y cambia el acomodo", () => {
    let e = agregarAPagina(base(), 0, "izq", ["a", "b"]);
    e = moverAPagina(e, { pliego: 0, lado: "izq", fotoId: "b" }, 1, "der");
    expect(e.pliegos[1]!.der.fotos).toEqual(["b"]);
    e = cambiarVariante(e, 0, "izq", 1);
    expect(e.pliegos[0]!.izq.variante).toBe(1);
    e = quitarDePagina(e, { pliego: 0, lado: "izq", fotoId: "a" });
    expect(e.pliegos[0]!.izq.fotos).toEqual([]);
  });

  it("suma y saca pliegos, pero nunca deja el libro vacío", () => {
    let e = agregarPliego(base(), 0);
    expect(e.pliegos).toHaveLength(3);
    e = quitarPliego(quitarPliego(e, 0), 0);
    expect(e.pliegos).toHaveLength(1);
    expect(quitarPliego(e, 0).pliegos).toHaveLength(1);
  });
});

describe("reemplazar una foto puesta", () => {
  it("pone la nueva en el mismo lugar, salvo que ya esté en esa página", () => {
    const e = agregarAPagina(base(), 0, "izq", ["a", "b"]);
    expect(reemplazar(e, { pliego: 0, lado: "izq", fotoId: "a" }, "c").pliegos[0]!.izq.fotos).toEqual(["c", "b"]);
    expect(reemplazar(e, { pliego: 0, lado: "izq", fotoId: "a" }, "b")).toBe(e);
  });

  it("un libro nuevo se arma por pliego entero: las fotos van juntas", () => {
    const e = armarPliego(entero(), 0, ["a", "b", "c", "d"]);
    expect(e.pliegos[0]!.modo).toBe("pliego");
    expect(e.pliegos[0]!.todo.fotos).toEqual(["a", "b", "c", "d"]);
    expect(e.pliegos[0]!.izq.fotos).toEqual([]);
  });

  it("pasar a páginas y volver no pierde fotos", () => {
    const e = armarPliego(entero(), 0, ["a", "b", "c"]);
    const paginas = cambiarModo(e, 0, "paginas");
    expect(paginas.pliegos[0]!.izq.fotos).toEqual(["a", "b"]);
    expect(paginas.pliegos[0]!.der.fotos).toEqual(["c"]);
    expect(cambiarModo(paginas, 0, "pliego").pliegos[0]!.todo.fotos).toEqual(["a", "b", "c"]);
  });

  it("los libros de antes con fotos por página siguen por páginas", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a")], pliegos: [{ izq: { fotos: ["a"] } }, {}] } }, 2);
    expect(e.pliegos[0]!.modo).toBe("paginas");
    expect(e.pliegos[1]!.modo).toBe("pliego");
  });
});
