import { describe, expect, it } from "vitest";
import { generarBloques } from "./bloques";
import { leerEstadoFotolibro } from "./estado";
import { cambiarFondo } from "./operaciones";

const lienzo = { width: 7205, height: 3602, dpi: 300 };
const foto = (id: string) => ({ id, url: `u/${id}`, vista: "", mini: "", w: 6000, h: 4000, nombre: id });

describe("fondo por pliego y borde de fotos", () => {
  it("el color propio del pliego va al fondo, y sacarlo vuelve al papel", () => {
    const e = cambiarFondo(leerEstadoFotolibro({ fotolibro: { fotos: [] } }, 2), 1, "#112233");
    const fondo = (x: typeof e, i: number) => generarBloques(x, lienzo, []).find((b) => b.type === "BACKGROUND" && b.pageIndex === i)!;
    expect(fondo(e, 1).configJson.backgroundColor).toBe("#112233");
    expect(fondo(e, 0).configJson.backgroundColor).toBe("#ffffff");
    const sin = cambiarFondo(e, 1, null);
    expect(fondo(sin, 1).configJson.backgroundColor).toBe("#ffffff");
  });

  it("con borde, cada foto lleva un rectángulo detrás y se achica hacia adentro", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a")], bordeMm: 3, bordeColor: "#000000" } }, 1);
    e.pliegos[0]!.todo.fotos = ["a"];
    const b = generarBloques(e, lienzo, []);
    const borde = b.find((x) => x.type === "SHAPE")!;
    const img = b.find((x) => x.type === "IMAGE")!;
    const px = (3 * 300) / 25.4;
    expect(borde.configJson.fill).toBe("#000000");
    expect(img.layout.x - borde.layout.x).toBeCloseTo(px, 1);
    expect(borde.layout.width - img.layout.width).toBeCloseTo(2 * px, 1);
    expect(borde.layout.zIndex).toBeLessThan(img.layout.zIndex);
  });
});
