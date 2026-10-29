import type { TemplateV2Block } from "@repo/template-editor-core";
import type { Lienzo } from "./bloques";

/**
 * Textos que se agregan a mano en el Modo Fotolibro (un epígrafe, una fecha, una frase), sin ir al
 * diseño libre. Son bloques comunes del editor y **no** automáticos: el armado no los toca, viajan
 * con su pliego y se imprimen con su tipografía.
 */

export const esTextoLibre = (b: TemplateV2Block) => b.type === "TEXT" && b.configJson.fotolibroAuto !== true;

/** Cuerpo del texto en puntos tipográficos, a partir del tamaño guardado (px del lienzo). */
export const puntosDe = (b: TemplateV2Block, dpi: number) => Math.round((Number(b.configJson.fontSize ?? 0) * 72) / dpi);
export const tamanoDePuntos = (pt: number, dpi: number) => (pt * dpi) / 72;

export function nuevoTexto(pliego: number, lienzo: Lienzo, id: string): TemplateV2Block {
  const dpi = lienzo.dpi ?? 300;
  const w = lienzo.width * 0.3;
  const h = (40 * dpi) / 72;
  return {
    id,
    type: "TEXT",
    pageIndex: pliego,
    name: "Texto",
    layout: { x: (lienzo.width - w) / 2, y: (lienzo.height - h) / 2, width: w, height: h, rotation: 0, zIndex: 60, opacity: 1, locked: false, visible: true },
    configJson: {
      content: "Escribí acá",
      fontFamily: "Playfair Display",
      fontSize: tamanoDePuntos(24, dpi),
      fontWeight: 400,
      fontItalic: false,
      color: "#222222",
      textAlign: "center",
      lineHeight: 1.2,
    },
  };
}

/** Lleva el texto a (x, y) sin que se salga del pliego. */
export function moverTexto(b: TemplateV2Block, x: number, y: number, lienzo: Lienzo): TemplateV2Block {
  const nx = Math.min(Math.max(0, x), lienzo.width - b.layout.width);
  const ny = Math.min(Math.max(0, y), lienzo.height - b.layout.height);
  return { ...b, layout: { ...b.layout, x: nx, y: ny } };
}

/**
 * Cambia el cuerpo y ajusta el alto de la caja para que la letra entre (una línea por renglón
 * escrito, con su interlineado).
 */
export function conCuerpo(b: TemplateV2Block, pt: number, dpi: number): TemplateV2Block {
  const fontSize = tamanoDePuntos(pt, dpi);
  const renglones = Math.max(1, String(b.configJson.content ?? "").split("\n").length);
  const height = fontSize * Number(b.configJson.lineHeight ?? 1.2) * renglones * 1.15;
  return { ...b, layout: { ...b.layout, height }, configJson: { ...b.configJson, fontSize } };
}
