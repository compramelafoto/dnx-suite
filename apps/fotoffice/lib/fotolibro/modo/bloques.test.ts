import { describe, expect, it } from "vitest";
import type { TemplateV2Block } from "@repo/template-editor-core";
import { generarBloques, idDeBloque } from "./bloques";
import { leerEstadoFotolibro, type EstadoFotolibro } from "./estado";

const lienzo = { width: 7205, height: 3602, dpi: 300 };
const foto = (id: string, w = 3000, h = 2000) => ({ id, url: `https://x/${id}.jpg`, vista: `https://x/${id}-v.jpg`, mini: `https://x/${id}-m.jpg`, w, h, nombre: id });

function estado(): EstadoFotolibro {
  const e = leerEstadoFotolibro({ fotolibro: { fotos: [foto("a"), foto("b"), foto("c", 2000, 3000)] } }, 2);
  e.pliegos[0]!.izq.fotos = ["a", "b"];
  e.pliegos[0]!.der.fotos = ["c"];
  return e;
}

describe("de las fotos de cada página a los bloques del diseño", () => {
  it("una imagen por foto, en su página, con el original para imprimir y la vista para la pantalla", () => {
    const bloques = generarBloques(estado(), lienzo, []);
    const fotos = bloques.filter((b) => b.type === "IMAGE");
    expect(fotos).toHaveLength(3);
    const c = fotos.find((b) => b.configJson.fotoId === "c")!;
    expect(c.pageIndex).toBe(0);
    expect(c.layout.x).toBeGreaterThanOrEqual(lienzo.width / 2);
    expect(c.configJson.src).toBe("https://x/c.jpg");
    expect(c.configJson.previewSrc).toBe("https://x/c-v.jpg");
  });

  it("cada hoja lleva su fondo", () => {
    const fondos = generarBloques(estado(), lienzo, []).filter((b) => b.type === "BACKGROUND");
    expect(fondos.map((b) => b.pageIndex).sort()).toEqual([0, 1]);
  });

  it("conserva el encuadre de la foto y lo que se agregó a mano", () => {
    const primera = generarBloques(estado(), lienzo, []);
    const texto: TemplateV2Block = {
      id: "t1",
      type: "TEXT",
      pageIndex: 1,
      layout: { x: 10, y: 10, width: 100, height: 40, rotation: 0, zIndex: 50, opacity: 1, locked: false, visible: true },
      configJson: { content: "Hola" },
    };
    const conEncuadre = primera.map((b) =>
      b.id === idDeBloque(0, "izq", "a") ? { ...b, configJson: { ...b.configJson, crop: { zoom: 2, x: 0.5, y: 0 } } } : b,
    );
    const segunda = generarBloques(estado(), lienzo, [...conEncuadre, texto]);
    expect(segunda.find((b) => b.id === idDeBloque(0, "izq", "a"))!.configJson.crop).toEqual({ zoom: 2, x: 0.5, y: 0 });
    expect(segunda.find((b) => b.id === "t1")).toEqual(texto);
  });

  it("sacar una foto de la página borra su bloque", () => {
    const e = estado();
    const antes = generarBloques(e, lienzo, []);
    e.pliegos[0]!.izq.fotos = ["a"];
    const despues = generarBloques(e, lienzo, antes);
    expect(despues.some((b) => b.configJson.fotoId === "b")).toBe(false);
  });
});

describe("con un estilo aplicado", () => {
  function conEstilo(textos: Record<string, string> = {}) {
    const e = estado();
    e.estilo = {
      id: "bodas-01-jardin-acuarela",
      medida: "610×305",
      fondos: { apertura: "https://x/ap.jpg", interior: "https://x/in.jpg", "interior-alt": "https://x/alt.jpg", cierre: "https://x/ci.jpg" },
      textos,
    };
    return e;
  }

  it("cada pliego lleva el fondo de su tipo: el primero abre y el último cierra", () => {
    const fondos = generarBloques(conEstilo(), lienzo, []).filter((b) => b.type === "BACKGROUND");
    expect(fondos.find((b) => b.pageIndex === 0)!.configJson.src).toBe("https://x/ap.jpg");
    expect(fondos.find((b) => b.pageIndex === 1)!.configJson.src).toBe("https://x/ci.jpg");
  });

  it("los títulos salen sólo si se escribieron, con la tipografía del estilo", () => {
    expect(generarBloques(conEstilo(), lienzo, []).some((b) => b.type === "TEXT")).toBe(false);
    const titulo = generarBloques(conEstilo({ titulo: "Ana & Luis" }), lienzo, []).find((b) => b.type === "TEXT")!;
    expect(titulo.configJson.content).toBe("Ana & Luis");
    expect(titulo.configJson.fontFamily).toBe("Great Vibes");
    expect(titulo.pageIndex).toBe(0);
  });

  it("en la apertura, las fotos de la página izquierda van debajo del título", () => {
    const e = conEstilo();
    const fotos = generarBloques(e, lienzo, []).filter((b) => b.type === "IMAGE" && b.pageIndex === 0 && b.layout.x < lienzo.width / 2);
    for (const f of fotos) expect(f.layout.y).toBeGreaterThan(lienzo.height * 0.6);
  });

  it("sacar el estilo devuelve el papel blanco", () => {
    const con = generarBloques(conEstilo(), lienzo, []);
    const e = estado();
    const sin = generarBloques(e, lienzo, con).filter((b) => b.type === "BACKGROUND");
    expect(sin.every((b) => b.configJson.src === "")).toBe(true);
  });
});
