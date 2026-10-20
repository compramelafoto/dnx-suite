import "server-only";
import sharp from "sharp";
import { aplicarAjustes } from "./ajustes";
import { cajaRotada, planDeRecorte, tamanoVistaPrevia } from "./geometria";
import { MENSAJE_HEIC } from "./mensajes";
import type { Nitidez } from "./medidas";
import type { DisposicionCarnet } from "./plancha";
import { anguloTotal, colorBordeDe, type Receta } from "./receta";

/**
 * El motor: del original al JPG que se imprime. Lo que se corrige respecto del editor de
 * CompraMeLaFoto (spec §3.1): no hay desenfoque, se achica con Lanczos desde el original y el
 * perfil de color se convierte a sRGB en vez de perderse. Los ajustes van en 16 bits.
 * De a una imagen por llamada y sin caché: la memoria de la función es limitada.
 */
sharp.cache(false);
sharp.concurrency(1);

export const MAX_PIXELES_ORIGINAL = 60_000_000;
const FORMATOS = new Set(["jpeg", "png", "webp", "heif"]);
const BLANCO = { r: 255, g: 255, b: 255 };
const SIGMA: Record<Nitidez, number> = { SUAVE: 0.5, NORMAL: 0.8, FUERTE: 1.1 };

/** "#rrggbb" → { r, g, b } (la receta ya validó el formato). */
export function rgbDe(hex: string): { r: number; g: number; b: number } {
  const n = Number.parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export class ImagenNoProcesable extends Error {
  constructor(message: string, readonly definitivo: boolean) {
    super(message);
  }
}

const esLimite = (e: unknown) => e instanceof Error && /pixel limit/i.test(e.message);

export { MENSAJE_HEIC };
const MARCAS_HEIC = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "hevm", "hevs"]);

/** HEIC con imagen HEVC: el `sharp` que viene armado sólo decodifica AVIF dentro de HEIF. */
export function esHeicSinSoporte(meta: { format?: string; compression?: string }): boolean {
  return meta.format === "heif" && meta.compression !== "av1";
}

/** Si el archivo es un HEIC por su caja `ftyp` (para dar el mensaje claro aunque `sharp` ni lo abra). */
function pareceHeic(buf: Buffer): boolean {
  if (buf.length < 16 || buf.toString("latin1", 4, 8) !== "ftyp") return false;
  const largo = Math.min(buf.readUInt32BE(0), buf.length, 256);
  const marcas: string[] = [];
  for (let i = 8; i + 4 <= largo; i += 4) if (i !== 12) marcas.push(buf.toString("latin1", i, i + 4));
  return marcas.some((m) => MARCAS_HEIC.has(m)) && !marcas.includes("avif");
}

function abrir(buf: Buffer) {
  return sharp(buf, { limitInputPixels: MAX_PIXELES_ORIGINAL, failOn: "error" });
}

export async function leerOriginal(buf: Buffer): Promise<{ ancho: number; alto: number; perfilColor: string | null; formato: string }> {
  let meta: sharp.Metadata;
  try {
    meta = await abrir(buf).metadata();
  } catch (e) {
    if (esLimite(e)) throw new ImagenNoProcesable("La foto es demasiado grande (más de 60 megapíxeles).", true);
    if (pareceHeic(buf)) throw new ImagenNoProcesable(MENSAJE_HEIC, true);
    throw new ImagenNoProcesable("El archivo no es una imagen que se pueda abrir. Probá con un JPG.", true);
  }
  if (esHeicSinSoporte(meta)) throw new ImagenNoProcesable(MENSAJE_HEIC, true);
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
  // La medida sale de `tamanoVistaPrevia` (no de lo que redondee sharp): así se puede reconstruir
  // desde el tamaño del original sin volver a abrir la vista previa.
  const original = await leerOriginal(buf);
  const destino = tamanoVistaPrevia(original.ancho, original.alto);
  try {
    const { data, info } = await abrir(buf)
      .autoOrient()
      .flatten({ background: BLANCO })
      .resize(destino.ancho, destino.alto, { fit: "fill", kernel: "lanczos3" })
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

/**
 * Qué parte de la pieza es foto después del giro (255) y cuál es esquina vacía (0). Se arma a la
 * escala de la pieza, no del original: una foto de 60 megapíxeles no se vuelve a rasterizar.
 */
async function mascaraDeFoto(
  info: { ancho: number; alto: number },
  angulo: number,
  plan: { recorte: { left: number; top: number; width: number; height: number }; colocacion: { width: number; height: number } },
): Promise<Uint8Array> {
  const k = Math.min(1, plan.colocacion.width / plan.recorte.width);
  const w = Math.max(1, Math.round(info.ancho * k));
  const h = Math.max(1, Math.round(info.alto * k));
  const { data, info: ig } = await sharp({ create: { width: w, height: h, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .rotate(angulo, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  // El recorte, llevado a la escala (y al tamaño exacto) de la máscara girada.
  const caja = cajaRotada(info.ancho, info.alto, angulo);
  const sx = ig.width / caja.ancho;
  const sy = ig.height / caja.alto;
  const left = Math.min(ig.width - 1, Math.max(0, Math.round(plan.recorte.left * sx)));
  const top = Math.min(ig.height - 1, Math.max(0, Math.round(plan.recorte.top * sy)));
  const width = Math.max(1, Math.min(ig.width - left, Math.round(plan.recorte.width * sx)));
  const height = Math.max(1, Math.min(ig.height - top, Math.round(plan.recorte.height * sy)));
  const { data: m } = await sharp(data, { raw: { width: ig.width, height: ig.height, channels: 4 } })
    .extract({ left, top, width, height })
    .resize(plan.colocacion.width, plan.colocacion.height, { fit: "fill", kernel: "linear" })
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return new Uint8Array(m);
}

export async function renderizarPieza(original: Buffer, receta: Receta, destino: { ancho: number; alto: number }, nitidez: Nitidez): Promise<PiezaRaw> {
  const info = await leerOriginal(original);
  const angulo = anguloTotal(receta);
  const caja = cajaRotada(info.ancho, info.alto, angulo);
  // RECORTAR: el encuadre entero, a toda la pieza (como en la etapa 1).
  // ENCAJAR: sólo la parte del encuadre que cae en la foto, en su lugar del papel.
  const plan = planDeRecorte(receta, caja, destino, angulo % 90 === 0 ? 0 : 2);
  const encajar = receta.modo === "ENCAJAR";
  const borde = encajar ? rgbDe(colorBordeDe(receta)) : BLANCO;
  // En ENCAJAR con enderezado, el giro deja esquinas sin foto. Se giran con el color del borde
  // (no con blanco: el borde del giro se mezcla con el fondo y, si fuera blanco, quedaría una
  // línea clara entre la foto y un borde de color), y una máscara dice cuáles son para devolverles
  // al final el color exacto, sin pasar por ajustes ni nitidez. En RECORTAR el borde es blanco:
  // igual que en la etapa 1.
  const conMascara = encajar && angulo % 90 !== 0;

  // 1-4: derecha, a sRGB (sharp usa el perfil embebido), girada, recortada y llevada a su medida.
  let p = abrir(original).autoOrient().flatten({ background: BLANCO });
  if (angulo !== 0) p = p.rotate(angulo, { background: borde });
  const { data: crudo16, info: i16 } = await p
    .extract(plan.recorte)
    .resize(plan.colocacion.width, plan.colocacion.height, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("rgb16")
    .raw({ depth: "ushort" })
    .toBuffer({ resolveWithObject: true });
  if (i16.channels !== 3) throw new ImagenNoProcesable("La foto tiene un formato de color que no se puede imprimir.", true);

  // 5: ajustes en 16 bits (la misma función que la vista previa).
  const u16 = new Uint16Array(crudo16.length / 2);
  Buffer.from(u16.buffer).set(crudo16);
  let cobertura: Uint8Array | null = null; // 255 = foto, 0 = esquina sin foto
  if (conMascara) cobertura = await mascaraDeFoto(info, angulo, plan);
  aplicarAjustes(u16, 3, receta.ajustes);

  // 6: a 8 bits y nitidez de salida.
  const { data: foto, info: i8 } = await sharp(u16, { raw: { width: i16.width, height: i16.height, channels: 3 } })
    .toColourspace("srgb")
    .sharpen({ sigma: SIGMA[receta.nitidez ?? nitidez] })
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (cobertura) {
    // Donde el giro no dejó foto, el color exacto del borde (los píxeles de la orilla, con foto
    // mezclada, ya vienen bien del giro).
    const rb = [borde.r, borde.g, borde.b];
    for (let i = 0; i < cobertura.length; i++) if (cobertura[i]! < 128) for (let c = 0; c < 3; c++) foto[i * 3 + c] = rb[c]!;
  }
  if (plan.completo) return { data: foto, ancho: i8.width, alto: i8.height };

  // 7 (ENCAJAR): la foto, ya ajustada y enfocada, sobre el papel del color del borde. El borde no
  // pasa por los ajustes ni por la nitidez: queda exactamente del color elegido.
  const { data, info: ih } = await sharp({ create: { width: destino.ancho, height: destino.alto, channels: 3, background: borde } })
    .composite([{ input: foto, raw: { width: i8.width, height: i8.height, channels: 3 }, left: plan.colocacion.left, top: plan.colocacion.top }])
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, ancho: ih.width, alto: ih.height };
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

/**
 * La hoja de una copia: la copia ocupa el papel entero. La hoja siempre va en la orientación en
 * que está guardado el papel (10x15 parada): una copia acostada se gira 90° para que todas las
 * páginas del documento de impresión tengan el mismo `@page`.
 */
export async function componerCopia(pieza: PiezaRaw, acostada: boolean, ppp: number): Promise<Buffer> {
  let p = sharp(pieza.data, { raw: { width: pieza.ancho, height: pieza.alto, channels: 3 } });
  if (acostada) p = p.rotate(90);
  return p.jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).withIccProfile("srgb").withMetadata({ density: ppp }).toBuffer();
}
