import fontkit from "@pdf-lib/fontkit";
import type { FontId, FontSlot } from "./catalog";
import { readFontBytes } from "./load";

/**
 * Texto convertido en trazos SVG, para dibujar con sharp sin tipografías.
 *
 * librsvg —lo que usa sharp para pasar un SVG a imagen— ignora el
 * `@font-face` con la fuente incrustada: busca la familia en el sistema y, si
 * no la encuentra, usa la que haya. En una computadora sale con Helvetica; en
 * un servidor sin fuentes, sin texto. Un `<path>` no depende de nada de eso:
 * las letras viajan ya dibujadas.
 */

type FuenteDeFontkit = {
  unitsPerEm: number;
  layout(texto: string): {
    glyphs: { path: { toSVG(): string } }[];
    positions: { xAdvance: number; xOffset: number; yOffset: number }[];
  };
};

const fuentes = new Map<string, FuenteDeFontkit>();

async function fuente(id: FontId, slot: FontSlot): Promise<FuenteDeFontkit> {
  const clave = `${id}:${slot}`;
  const enCache = fuentes.get(clave);
  if (enCache) return enCache;
  const creada = fontkit.create(Buffer.from(await readFontBytes(id, slot))) as unknown as FuenteDeFontkit;
  fuentes.set(clave, creada);
  return creada;
}

export type TextoEnTrazos = {
  /** Un `<path>` listo para insertar, con la línea de base en `y`. */
  svg: string;
  /** Ancho ocupado, en píxeles. */
  ancho: number;
};

export async function textoATrazos(input: {
  texto: string;
  fontId: FontId;
  slot: FontSlot;
  /** Tamaño en píxeles. */
  tamano: number;
  x: number;
  /** Línea de base. */
  y: number;
  color: string;
  /** Espacio extra entre letras, en píxeles. */
  espaciado?: number;
}): Promise<TextoEnTrazos> {
  const f = await fuente(input.fontId, input.slot);
  const escala = input.tamano / f.unitsPerEm;
  const espaciado = input.espaciado ?? 0;
  const { glyphs, positions } = f.layout(input.texto);

  const partes: string[] = [];
  let cursor = 0;
  glyphs.forEach((glifo, i) => {
    const pos = positions[i]!;
    const d = glifo.path.toSVG();
    if (d) {
      const gx = input.x + (cursor + pos.xOffset) * escala;
      const gy = input.y - pos.yOffset * escala;
      // Las coordenadas de la fuente crecen hacia arriba; las del SVG, hacia abajo.
      partes.push(
        `<path transform="translate(${gx.toFixed(2)} ${gy.toFixed(2)}) scale(${escala.toFixed(5)} ${(-escala).toFixed(5)})" d="${d}"/>`,
      );
    }
    cursor += pos.xAdvance + (i < glyphs.length - 1 ? espaciado / escala : 0);
  });

  const color = input.color.replace(/[^#a-zA-Z0-9(),.\s]/g, "");
  return { svg: `<g fill="${color}">${partes.join("")}</g>`, ancho: cursor * escala };
}

/** Lo que mide un texto sin dibujarlo, para achicarlo hasta que entre. */
export async function medirTexto(input: {
  texto: string;
  fontId: FontId;
  slot: FontSlot;
  tamano: number;
  espaciado?: number;
}): Promise<number> {
  const f = await fuente(input.fontId, input.slot);
  const { positions } = f.layout(input.texto);
  const unidades = positions.reduce((s, p) => s + p.xAdvance, 0);
  return (unidades * input.tamano) / f.unitsPerEm + Math.max(0, positions.length - 1) * (input.espaciado ?? 0);
}
