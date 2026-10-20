import "server-only";
import sharp from "sharp";
import { aplicarAjustes } from "./ajustes";
import { cajaRotada, rectanguloEnPixeles } from "./geometria";
import type { Nitidez } from "./medidas";
import type { DisposicionCarnet } from "./plancha";
import { anguloTotal, type Receta } from "./receta";

/**
 * El motor: del original al JPG que se imprime. Lo que se corrige respecto del editor de
 * CompraMeLaFoto (spec §3.1): no hay desenfoque, se achica con Lanczos desde el original y el
 * perfil de color se convierte a sRGB en vez de perderse. Los ajustes van en 16 bits.
 * De a una imagen por llamada y sin caché: la memoria de la función es limitada.
 */
sharp.cache(false);
sharp.concurrency(1);

export const MAX_PIXELES_ORIGINAL = 60_000_000;
export const LADO_VISTA_PREVIA = 1600;
const FORMATOS = new Set(["jpeg", "png", "webp", "heif"]);
const BLANCO = { r: 255, g: 255, b: 255 };
const SIGMA: Record<Nitidez, number> = { SUAVE: 0.5, NORMAL: 0.8, FUERTE: 1.1 };

export class ImagenNoProcesable extends Error {
  constructor(message: string, readonly definitivo: boolean) {
    super(message);
  }
}

const esLimite = (e: unknown) => e instanceof Error && /pixel limit/i.test(e.message);

function abrir(buf: Buffer) {
  return sharp(buf, { limitInputPixels: MAX_PIXELES_ORIGINAL, failOn: "error" });
}

export async function leerOriginal(buf: Buffer): Promise<{ ancho: number; alto: number; perfilColor: string | null; formato: string }> {
  let meta: sharp.Metadata;
  try {
    meta = await abrir(buf).metadata();
  } catch (e) {
    if (esLimite(e)) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
    throw new ImagenNoProcesable("El archivo no es una imagen que se pueda abrir. Probá con un JPG.", true);
  }
  if (!meta.format || !FORMATOS.has(meta.format)) throw new ImagenNoProcesable("La foto tiene que ser JPG, PNG o WebP. Convertí la foto a JPG.", true);
  if (!meta.width || !meta.height) throw new ImagenNoProcesable("No se pudo leer el tamaño de la foto.", true);
  if (meta.width * meta.height > MAX_PIXELES_ORIGINAL) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
  const girada = (meta.orientation ?? 1) >= 5;
  return {
    ancho: girada ? meta.height : meta.width,
    alto: girada ? meta.width : meta.height,
    perfilColor: meta.icc ? describirPerfil(meta.icc) : null,
    formato: meta.format,
  };
}

/** El nombre del perfil está en la etiqueta 'desc' del ICC; si no se entiende, "Embebido". */
function describirPerfil(icc: Buffer): string {
  const i = icc.indexOf("desc");
  if (i < 0) return "Embebido";
  const texto = icc.subarray(i + 12, i + 80).toString("latin1").replace(/[^\x20-\x7e]/g, "").trim();
  return texto.slice(0, 40) || "Embebido";
}

export async function generarVistaPrevia(buf: Buffer): Promise<{ jpg: Buffer; ancho: number; alto: number }> {
  try {
    const { data, info } = await abrir(buf)
      .autoOrient()
      .flatten({ background: BLANCO })
      .resize({ width: LADO_VISTA_PREVIA, height: LADO_VISTA_PREVIA, fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
      .toColourspace("srgb")
      .jpeg({ quality: 88 })
      .withIccProfile("srgb")
      .toBuffer({ resolveWithObject: true });
    return { jpg: data, ancho: info.width, alto: info.height };
  } catch (e) {
    if (esLimite(e)) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
    throw new ImagenNoProcesable("No se pudo preparar la vista previa.", false);
  }
}

export type PiezaRaw = { data: Buffer; ancho: number; alto: number };

export async function renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw> {
  const info = await leerOriginal(original);
  const angulo = anguloTotal(receta);
  const caja = cajaRotada(info.ancho, info.alto, angulo);
  const rect = rectanguloEnPixeles(receta.encuadre, caja, angulo % 90 === 0 ? 0 : 2);

  // 1-4: derecha, a sRGB (sharp usa el perfil embebido), girada, recortada y llevada a la medida exacta.
  let p = abrir(original).autoOrient().flatten({ background: BLANCO });
  if (angulo !== 0) p = p.rotate(angulo, { background: BLANCO });
  const { data: crudo16, info: i16 } = await p
    .extract(rect)
    .resize(destino.ancho, destino.alto, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  if (i16.channels !== 3) throw new ImagenNoProcesable("La foto tiene un formato de color que no se puede imprimir.", true);

  // 5: ajustes en 16 bits (la misma función que la vista previa).
  const u16 = new Uint16Array(crudo16.length / 2);
  Buffer.from(u16.buffer).set(crudo16);
  aplicarAjustes(u16, 3, receta.ajustes);

  // 6: a 8 bits y nitidez de salida.
  const { data, info: i8 } = await sharp(u16, { raw: { width: i16.width, height: i16.height, channels: 3 } })
    .toColourspace("srgb")
    .sharpen({ sigma: SIGMA[receta.nitidez ?? nitidez] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, ancho: i8.width, alto: i8.height };
}

function franja(ancho: number, alto: number): Buffer {
  return Buffer.alloc(ancho * alto * 3, 0xc8);
}

export async function componerHoja(
  hoja: { ancho: number; alto: number },
  pieza: PiezaRaw,
  disp: Pick<DisposicionCarnet, "posiciones" | "lineas">,
  ppp: number,
  conLineas: boolean,
): Promise<Buffer> {
  const capas: sharp.OverlayOptions[] = [];
  if (conLineas) {
    for (const x of disp.lineas.xs) capas.push({ input: franja(1, hoja.alto), raw: { width: 1, height: hoja.alto, channels: 3 }, left: x, top: 0 });
    for (const y of disp.lineas.ys) capas.push({ input: franja(hoja.ancho, 1), raw: { width: hoja.ancho, height: 1, channels: 3 }, left: 0, top: y });
  }
  for (const pos of disp.posiciones) {
    capas.push({ input: pieza.data, raw: { width: pieza.ancho, height: pieza.alto, channels: 3 }, left: pos.left, top: pos.top });
  }
  return sharp({ create: { width: hoja.ancho, height: hoja.alto, channels: 3, background: BLANCO } })
    .composite(capas)
    .jpeg({ quality: 95, chromaSubsampling: "4:4:4" })
    .withIccProfile("srgb")
    .withMetadata({ density: ppp })
    .toBuffer();
}
