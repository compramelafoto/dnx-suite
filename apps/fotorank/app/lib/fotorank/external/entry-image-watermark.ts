/**
 * Marca de agua de la vista previa que FotoRank le entrega a FOTOFFICE: el texto firmado
 * (`wm`, p. ej. "Muestra · Sociedad Fotográfica") repetido en diagonal, semitransparente.
 *
 * El texto lo dibuja sharp con Pango (`sharp({ text })`) usando **el archivo de fuente del
 * repo** (`assets/fonts/Roboto-Regular.ttf`, vía `fontfile`): en Vercel no hay fuentes del
 * sistema, y librsvg ignora `@font-face` dentro de un SVG, así que un `<text>` en SVG puede
 * salir vacío. La ruta incluye el archivo en el paquete de la función con
 * `outputFileTracingIncludes` (next.config.ts).
 *
 * **Falla cerrada:** si no hay texto utilizable, no se encuentra la fuente o el texto
 * dibujado no tiene píxeles visibles, se lanza un error (la ruta responde 404). Nunca se
 * sirve una vista previa sin marca.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ARCHIVO = path.join("assets", "fonts", "Roboto-Regular.ttf");
/** `process.cwd()` es apps/fotorank en Next y en Vercel; los tests corren desde packages/db. */
const CANDIDATOS = [
  path.join(process.cwd(), ARCHIVO),
  path.join(process.cwd(), "apps", "fotorank", ARCHIVO),
  path.join(process.cwd(), "..", "..", "apps", "fotorank", ARCHIVO),
];

let rutaFuente: string | null = null;

export function watermarkFontPath(): string {
  if (rutaFuente) return rutaFuente;
  for (const ruta of CANDIDATOS) {
    if (fs.existsSync(ruta)) {
      rutaFuente = ruta;
      return ruta;
    }
  }
  throw new Error("Falta la fuente de la marca de agua (assets/fonts/Roboto-Regular.ttf).");
}

/**
 * Texto apto para la marca: NFC, sólo ASCII imprimible, Latin-1 (tildes, ñ, ·) y guiones
 * tipográficos; espacios colapsados; hasta 80 caracteres. Vacío = no hay marca posible.
 */
function esDibujable(c: string): boolean {
  const n = c.codePointAt(0) ?? 0;
  return (n >= 0x20 && n <= 0x7e) || (n >= 0xa0 && n <= 0xff) || n === 0x2013 || n === 0x2014;
}

export function watermarkText(text: string): string {
  return Array.from(text.normalize("NFC"))
    .filter(esDibujable)
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** Escapa para el markup de Pango (mismas entidades que XML). */
export function escapeMarkup(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const OPACIDAD_TEXTO = 0.42;
const OPACIDAD_SOMBRA = 0.25;
/** Mínimo de píxeles con alfa para dar por dibujado el texto. */
const MIN_PIXELES_VISIBLES = 20;

/**
 * Capa RGBA de exactamente `width`×`height`: el texto (blanco con sombra oscura) en filas
 * corridas en ladrillo, giradas −30°, que cubren toda la imagen.
 */
export async function buildWatermarkOverlay(text: string, width: number, height: number): Promise<Buffer> {
  const limpio = watermarkText(text);
  if (!limpio) throw new Error("Marca de agua vacía.");
  const tam = Math.max(14, Math.round(Math.min(width, height) / 22));

  const glifos = await sharp({
    text: {
      text: escapeMarkup(limpio),
      font: `Roboto ${tam}px`,
      fontfile: watermarkFontPath(),
      rgba: true,
      dpi: 72,
    },
  })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width: tw, height: th } = glifos.info;
  const alfa = new Uint8Array(tw * th);
  let visibles = 0;
  for (let i = 0; i < tw * th; i++) {
    const a = glifos.data[i * 4 + 3]!;
    alfa[i] = a;
    if (a > 32) visibles++;
  }
  if (visibles < MIN_PIXELES_VISIBLES) throw new Error("La marca de agua no se dibujó.");

  // Texto blanco y sombra negra a partir del mismo alfa, con su opacidad ya aplicada.
  const capa = (rgb: number, opacidad: number) => {
    const out = Buffer.alloc(tw * th * 4);
    for (let i = 0; i < tw * th; i++) {
      out[i * 4] = rgb;
      out[i * 4 + 1] = rgb;
      out[i * 4 + 2] = rgb;
      out[i * 4 + 3] = Math.round(alfa[i]! * opacidad);
    }
    return { input: out, raw: { width: tw, height: th, channels: 4 as const } };
  };
  const sombra = capa(0, OPACIDAD_SOMBRA);
  const blanco = capa(255, OPACIDAD_TEXTO);
  const desplazamiento = Math.max(1, Math.round(tam / 16));

  // Lienzo cuadrado del tamaño de la diagonal (más una celda), así al girarlo y recortar
  // el centro no quedan esquinas vacías.
  const paso = tw + tam * 3;
  const fila = Math.round(th * 2.6);
  const lado = Math.ceil(Math.hypot(width, height)) + paso;
  const capas: sharp.OverlayOptions[] = [];
  for (let y = 0, n = 0; y + th + desplazamiento <= lado; y += fila, n++) {
    for (let x = n % 2 === 0 ? 0 : Math.round(paso / 2); x + tw + desplazamiento <= lado; x += paso) {
      capas.push({ ...sombra, left: x + desplazamiento, top: y + desplazamiento });
      capas.push({ ...blanco, left: x, top: y });
    }
  }
  const lienzo = await sharp({
    create: { width: lado, height: lado, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(capas)
    .png()
    .toBuffer();

  const girado = await sharp(lienzo)
    .rotate(-30, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const gw = girado.info.width;
  const gh = girado.info.height;
  return sharp(girado.data, { raw: { width: gw, height: gh, channels: 4 } })
    .extract({
      left: Math.floor((gw - width) / 2),
      top: Math.floor((gh - height) / 2),
      width,
      height,
    })
    .png()
    .toBuffer();
}
