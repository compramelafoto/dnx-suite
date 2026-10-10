import { describe, expect, it } from "vitest";
import { comentariosPorFoto, filtrarFotos, fotosConComentarios, idsParaPrecargar, nombreDeDescarga } from "./publico-tipos";

const fotos = ["a", "b", "c", "d"].map((id) => ({ id }));

describe("filtros", () => {
  const sel = new Set(["b", "d"]);
  const com = fotosConComentarios([{ fotoId: "c" }, { fotoId: "c" }, { fotoId: "d" }]);
  it("Todas conserva todo y el orden", () => {
    expect(filtrarFotos(fotos, "TODAS", sel, com).map((f) => f.id)).toEqual(["a", "b", "c", "d"]);
  });
  it("Seleccionadas y Con comentarios", () => {
    expect(filtrarFotos(fotos, "SELECCIONADAS", sel, com).map((f) => f.id)).toEqual(["b", "d"]);
    expect(filtrarFotos(fotos, "CON_COMENTARIOS", sel, com).map((f) => f.id)).toEqual(["c", "d"]);
  });
  it("agrupa los comentarios por foto sin cambiar el orden", () => {
    const m = comentariosPorFoto([{ fotoId: "x", n: 1 }, { fotoId: "y", n: 2 }, { fotoId: "x", n: 3 }]);
    expect(m.get("x")!.map((c) => c.n)).toEqual([1, 3]);
    expect(m.get("y")!.map((c) => c.n)).toEqual([2]);
  });
});

describe("precarga del visor", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `f${i}`);
  it("la actual primero, después las que siguen y al final las anteriores", () => {
    expect(idsParaPrecargar(ids, 5)).toEqual(["f5", "f6", "f7", "f8", "f9", "f4", "f3"]);
  });
  it("en los bordes no se sale de la lista", () => {
    expect(idsParaPrecargar(ids, 0)).toEqual(["f0", "f1", "f2", "f3", "f4"]);
    expect(idsParaPrecargar(ids, 19)).toEqual(["f19", "f18", "f17"]);
    expect(idsParaPrecargar([], 0)).toEqual([]);
  });
});

describe("nombre de descarga", () => {
  it("sin extensión original, con .jpg y sin caracteres que rompan el encabezado", () => {
    expect(nombreDeDescarga("IMG_0012.JPG")).toEqual({ ascii: "IMG_0012.jpg", utf8: "IMG_0012.jpg" });
    expect(nombreDeDescarga('bo"da\r\n;x/y.png').ascii).toBe("bo_da___x_y.jpg");
  });
  it("con tildes: la versión ASCII las pierde y la UTF-8 las conserva", () => {
    expect(nombreDeDescarga("Niña ñandú.jpeg")).toEqual({ ascii: "Nina nandu.jpg", utf8: "Niña ñandú.jpg" });
  });
  it("nombre vacío o larguísimo", () => {
    expect(nombreDeDescarga("").ascii).toBe("foto.jpg");
    expect(nombreDeDescarga("a".repeat(500) + ".jpg").utf8.length).toBeLessThanOrEqual(124);
  });
});
