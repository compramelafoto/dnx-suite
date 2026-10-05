/**
 * Marca de agua de la vista previa que FotoRank le entrega a FOTOFFICE: el texto firmado
 * (`wm`, p. ej. "Muestra - Sociedad Fotográfica") repetido en diagonal, semitransparente.
 *
 * El SVG lo rasteriza sharp (librsvg). En Vercel no hay fuentes del sistema: sin una fuente
 * embebida el texto sale vacío o en cuadraditos. Por eso se embebe Roboto (`assets/fonts`,
 * la misma que usa CompraMeLaFoto) como `@font-face` en base64 y el texto se reduce a ASCII
 * imprimible (el archivo de la fuente es un subconjunto). La ruta incluye el archivo en el
 * paquete de la función con `outputFileTracingIncludes` (next.config.ts).
 *
 * Si no se encuentra la fuente se lanza un error: mejor no servir la vista previa que
 * servirla sin marca de agua.
 */
import fs from "node:fs";
import path from "node:path";

const FAMILIA = "FotorankWatermark";
const ARCHIVO = path.join("assets", "fonts", "Roboto-Regular.ttf");
/** `process.cwd()` es apps/fotorank en Next y en Vercel; los tests corren desde packages/db. */
const CANDIDATOS = [
  path.join(process.cwd(), ARCHIVO),
  path.join(process.cwd(), "apps", "fotorank", ARCHIVO),
  path.join(process.cwd(), "..", "..", "apps", "fotorank", ARCHIVO),
];

let fuenteBase64: string | null = null;

function fuente(): string {
  if (fuenteBase64) return fuenteBase64;
  for (const ruta of CANDIDATOS) {
    try {
      const buf = fs.readFileSync(ruta);
      if (buf.length > 12) {
        fuenteBase64 = buf.toString("base64");
        return fuenteBase64;
      }
    } catch {
      /* siguiente */
    }
  }
  throw new Error("Falta la fuente de la marca de agua (assets/fonts/Roboto-Regular.ttf).");
}

/** ASCII imprimible: saca tildes y cambia separadores tipográficos por "-". */
export function watermarkAscii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[•·▪►–—]/g, "-")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** SVG del tamaño de la imagen con el texto en mosaico diagonal; `null` si no hay texto. */
export function buildWatermarkSvg(text: string, width: number, height: number): string | null {
  const limpio = watermarkAscii(text);
  if (!limpio) return null;
  const tam = Math.max(14, Math.round(Math.min(width, height) / 22));
  // Ancho aproximado del texto en Roboto (~0,5 em por carácter) más un respiro.
  const ancho = Math.round(limpio.length * tam * 0.5 + tam * 2);
  const fila = Math.round(tam * 2.8);
  const t = escapeXml(limpio);
  const trazo = Math.max(1, Math.round(tam / 24));
  const texto = (x: number, y: number) =>
    `<text x="${x}" y="${y}" font-family="'${FAMILIA}', sans-serif" font-size="${tam}" fill="#ffffff" fill-opacity="0.38" stroke="#000000" stroke-opacity="0.22" stroke-width="${trazo}">${t}</text>`;
  // Celda de dos filas en ladrillo: la segunda va corrida media celda (y su mitad cortada se
  // completa con la copia de la izquierda), así no quedan franjas vacías.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<defs>
<style type="text/css"><![CDATA[
@font-face { font-family: '${FAMILIA}'; src: url('data:font/truetype;charset=utf-8;base64,${fuente()}') format('truetype'); }
]]></style>
<pattern id="wm" patternUnits="userSpaceOnUse" width="${ancho}" height="${fila * 2}" patternTransform="rotate(-30)">
${texto(0, tam)}
${texto(Math.round(ancho / 2), fila + tam)}
${texto(-Math.round(ancho / 2), fila + tam)}
</pattern>
</defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="url(#wm)"/>
</svg>`;
}
