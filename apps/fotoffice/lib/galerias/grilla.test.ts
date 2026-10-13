import { describe, expect, it } from "vitest";
import { fusionarFotos, moverAntesDe, moverFoto, moverUnLugar, reasignarOrden, type FotoDeGrilla } from "./grilla";

const foto = (id: string, fileName: string, order: number, status: FotoDeGrilla["status"] = "LISTA"): FotoDeGrilla => ({ id, fileName, order, status });

describe("fusionarFotos", () => {
  it("por nombre: reemplaza las que ya estaban, agrega las nuevas y ordena natural (IMG_2 antes que IMG_10)", () => {
    const actuales = [foto("a", "IMG_10.jpg", 0), foto("b", "IMG_2.jpg", 1, "PENDIENTE")];
    const r = fusionarFotos(actuales, [foto("b", "IMG_2.jpg", 1, "LISTA"), foto("c", "IMG_1.jpg", 2)], "NOMBRE");
    expect(r.map((f) => f.id)).toEqual(["c", "b", "a"]);
    expect(r.find((f) => f.id === "b")!.status).toBe("LISTA");
  });
  it("manual: respeta `order` y las nuevas quedan al final", () => {
    const r = fusionarFotos([foto("a", "z.jpg", 0), foto("b", "a.jpg", 1)], [foto("c", "m.jpg", 2)], "MANUAL");
    expect(r.map((f) => f.id)).toEqual(["a", "b", "c"]);
  });
});

describe("mover", () => {
  const lista = [foto("a", "a", 0), foto("b", "b", 1), foto("c", "c", 2), foto("d", "d", 3)];
  it("a una posición, con tope en los extremos", () => {
    expect(moverFoto(lista, "d", 0).map((f) => f.id)).toEqual(["d", "a", "b", "c"]);
    expect(moverFoto(lista, "a", 99).map((f) => f.id)).toEqual(["b", "c", "d", "a"]);
    expect(moverFoto(lista, "a", -5).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
    expect(moverFoto(lista, "x", 1).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("un lugar antes o después, y no se sale de la lista", () => {
    expect(moverUnLugar(lista, "c", -1).map((f) => f.id)).toEqual(["a", "c", "b", "d"]);
    expect(moverUnLugar(lista, "c", 1).map((f) => f.id)).toEqual(["a", "b", "d", "c"]);
    expect(moverUnLugar(lista, "a", -1).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
    expect(moverUnLugar(lista, "d", 1).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("soltar una foto sobre otra la deja en el lugar de esa", () => {
    expect(moverAntesDe(lista, "d", "b").map((f) => f.id)).toEqual(["a", "d", "b", "c"]);
    expect(moverAntesDe(lista, "a", "c").map((f) => f.id)).toEqual(["b", "c", "a", "d"]);
    expect(moverAntesDe(lista, "a", "a").map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("no modifica la lista original y reasignarOrden numera de 0", () => {
    const antes = lista.map((f) => f.id).join();
    const movida = reasignarOrden(moverFoto(lista, "d", 0));
    expect(lista.map((f) => f.id).join()).toBe(antes);
    expect(movida.map((f) => f.order)).toEqual([0, 1, 2, 3]);
    expect(movida[0]!.id).toBe("d");
  });
});
