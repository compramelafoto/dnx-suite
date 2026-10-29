import { describe, expect, it } from "vitest";
import { carasEnLienzo, encuadreParaCaras, ubicarFoto } from "./caras";
import { generarBloques } from "./bloques";
import { leerEstadoFotolibro } from "./estado";
import { revisarLibro } from "./revision";

const lienzo = { width: 7205, height: 3602, dpi: 300 };

describe("encuadre inteligente con caras", () => {
  it("una cara a la derecha de una foto apaisada en un marco vertical: la foto se corre para centrarla", () => {
    const crop = encuadreParaCaras([{ x: 0.65, y: 0.3, w: 0.1, h: 0.15 }], 1000, 1500, 1.5)!;
    expect(crop.x).toBeGreaterThan(0.5);
    const f = ubicarFoto(1000, 1500, 1.5, crop);
    const centroCara = f.x + 0.7 * f.width;
    expect(Math.abs(centroCara - 500)).toBeLessThan(5);
  });

  it("una cara pegada al borde: la foto se corre todo lo que se puede", () => {
    expect(encuadreParaCaras([{ x: 0.9, y: 0.3, w: 0.08, h: 0.15 }], 1000, 1500, 1.5)!.x).toBe(1);
  });

  it("sin caras, o con la cara ya al centro, no toca nada", () => {
    expect(encuadreParaCaras([], 1000, 1500, 1.5)).toBeNull();
    expect(encuadreParaCaras([{ x: 0.45, y: 0.4, w: 0.1, h: 0.15 }], 1000, 1500, 1.5)).toBeNull();
  });

  it("al armar, la foto con caras se encuadra sola, pero un encuadre a mano se respeta", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [{ id: "a", url: "u", w: 3000, h: 2000, nombre: "a", caras: [{ x: 0.8, y: 0.3, w: 0.1, h: 0.15 }] }], pliegos: [{ todo: { fotos: ["a"] } }] } }, 1);
    const [b] = generarBloques(e, lienzo, []).filter((x) => x.type === "IMAGE");
    expect(b!.configJson.cropAuto).toBe(true);
    const aMano = { ...b!, configJson: { ...b!.configJson, crop: { zoom: 2, x: -1, y: 0 }, cropAuto: undefined } };
    const [c] = generarBloques(e, lienzo, [aMano]).filter((x) => x.type === "IMAGE");
    expect(c!.configJson.crop).toEqual({ zoom: 2, x: -1, y: 0 });
  });

  it("avisa cuando una cara cae en el doblez del lomo", () => {
    const e = leerEstadoFotolibro({ fotolibro: { fotos: [{ id: "a", url: "u", w: 8000, h: 4000, nombre: "a", caras: [{ x: 0.48, y: 0.3, w: 0.05, h: 0.1 }] }] } }, 1);
    e.pliegos[0]!.todo.fotos = ["a"];
    const bloques = generarBloques(e, lienzo, []);
    expect(carasEnLienzo([{ x: 0.48, y: 0.3, w: 0.05, h: 0.1 }], bloques.find((x) => x.type === "IMAGE")!.layout, 2, null)).toHaveLength(1);
    expect(revisarLibro(e, bloques, lienzo).some((p) => p.texto.includes("doblez del lomo"))).toBe(true);
  });
});
