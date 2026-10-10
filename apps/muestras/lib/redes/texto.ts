import "server-only";
import sharp from "sharp";
import { FAMILIA, rutaDeFuente } from "./fuentes";

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
/** Menos que esto es una capa vacía o casi: la pieza no sale. */
const MIN_VISIBLES = 20;

export type Capa = { input: Buffer; width: number; height: number };

/**
 * Una capa RGBA con el texto, dibujada por Pango con el archivo de fuente (`fontfile`). No se usa
 * `<text>` en SVG: librsvg ignora @font-face y en Vercel no hay fuentes del sistema. Falla cerrada:
 * sin píxeles visibles, error (nunca una pieza sin texto).
 */
export async function capaDeTexto(o: {
  texto: string; tamano: number; peso: "normal" | "negrita"; color: string; ancho: number; interlineado?: number;
}): Promise<Capa> {
  const t = o.texto.trim();
  if (!t) throw new Error("Texto vacío.");
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${o.color}">${escapar(t)}</span>`,
      font: `${FAMILIA}${o.peso === "negrita" ? " Bold" : ""} ${o.tamano}px`,
      fontfile: rutaDeFuente(o.peso),
      width: o.ancho,
      wrap: "word",
      rgba: true,
      dpi: 72,
      spacing: Math.round(o.tamano * ((o.interlineado ?? 1.15) - 1)),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  const crudo = await sharp(data).ensureAlpha().raw().toBuffer();
  let n = 0;
  for (let i = 3; i < crudo.length && n < MIN_VISIBLES; i += 4) if (crudo[i]! > 32) n++;
  if (n < MIN_VISIBLES) throw new Error("El texto no se dibujó.");
  return { input: data, width: info.width, height: info.height };
}

const capaDeTitulo = (texto: string, tamano: number, ancho: number, color: string) =>
  capaDeTexto({ texto, tamano, peso: "negrita", color, ancho, interlineado: 1.05 });

/** Prueba los tamaños de mayor a menor; con el menor, recorta palabras y suma "…" hasta entrar. */
export async function tituloQueEntra(
  texto: string, tamanos: readonly number[], ancho: number, altoMax: number, color: string,
): Promise<{ capa: Capa; tamano: number }> {
  for (const tamano of tamanos) {
    const capa = await capaDeTitulo(texto, tamano, ancho, color);
    if (capa.height <= altoMax) return { capa, tamano };
  }
  const menor = tamanos.at(-1)!;
  let palabras = texto.trim().split(/\s+/);
  while (palabras.length > 1) {
    palabras = palabras.slice(0, Math.max(1, Math.floor(palabras.length * 0.8)));
    const capa = await capaDeTitulo(`${palabras.join(" ")}…`, menor, ancho, color);
    if (capa.height <= altoMax) return { capa, tamano: menor };
  }
  return { capa: await capaDeTitulo(`${palabras[0]!.slice(0, 20)}…`, menor, ancho, color), tamano: menor };
}
