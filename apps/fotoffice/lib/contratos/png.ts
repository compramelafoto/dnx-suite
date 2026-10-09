/**
 * Validación de la firma dibujada (etapa 5). Módulo PURO (usa `node:zlib`, nada más).
 *
 * El navegador manda el trazo como PNG en base64 (`canvas.toDataURL("image/png")`). El servidor NO confía:
 * - decodifica el base64 y exige PNG de verdad (firma de 8 bytes, IHDR, IDAT, IEND);
 * - tamaño ≤ 200 KB (`FIRMA_MAX_BYTES`) y dimensiones acotadas (nada de bombas de descompresión);
 * - sólo el formato que genera un canvas: 8 bits, RGBA, sin entrelazado. Otro formato se rechaza;
 * - descomprime y desfiltra los píxeles y cuenta los que son trazo (opacos y no blancos). Un lienzo en
 *   blanco, transparente, con un punto suelto o pintado entero se rechaza.
 *
 * Sin librería de imágenes: el chequeo es liviano a propósito. No prueba que el trazo "parezca una firma"
 * (eso no se puede saber); prueba que hay un trazo y que el archivo es lo que dice ser.
 */
import { inflateSync } from "node:zlib";
import { FIRMA_MAX_BYTES } from "./constantes";

export const FIRMA_ANCHO_MIN = 50;
export const FIRMA_ALTO_MIN = 20;
export const FIRMA_ANCHO_MAX = 1200;
export const FIRMA_ALTO_MAX = 600;
/** Píxeles de trazo mínimos y extensión mínima (en píxeles) del trazo. */
export const FIRMA_PIXELES_MIN = 150;
export const FIRMA_EXTENSION_MIN = 25;
/** Si más de esta parte del lienzo es "trazo", es un manchón y no una firma. */
export const FIRMA_RELLENO_MAX = 0.6;

const PREFIJO_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;
const FIRMA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export const ERROR_FIRMA_FORMATO = "La firma no es válida. Dibujala de nuevo.";
export const ERROR_FIRMA_VACIA = "Dibujá tu firma en el recuadro antes de firmar.";
export const ERROR_FIRMA_PESADA = "La firma pesa demasiado. Borrala y dibujala de nuevo.";

/** Del texto que manda el navegador (`data:image/png;base64,…`) a los bytes. null si no tiene esa forma o es enorme. */
export function bytesDeDataUrlPng(v: unknown): Uint8Array | null {
  // El base64 pesa 4/3 de los bytes: con este tope no se decodifica nada que ya sepamos que sobra.
  if (typeof v !== "string" || v.length > Math.ceil((FIRMA_MAX_BYTES * 4) / 3) + 64) return null;
  const m = PREFIJO_DATA_URL.exec(v);
  if (!m) return null;
  const bytes = Buffer.from(m[1]!, "base64");
  return bytes.byteLength > 0 ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) : null;
}

export type ResultadoPng = { ok: true; ancho: number; alto: number; pixeles: number } | { ok: false; error: string };

const no = (error: string): ResultadoPng => ({ ok: false, error });

function leerU32(b: Uint8Array, i: number): number {
  return ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
}

/** Predictor de Paeth del filtro 4 de PNG. */
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export function revisarPngFirma(bytes: Uint8Array): ResultadoPng {
  if (bytes.byteLength > FIRMA_MAX_BYTES) return no(ERROR_FIRMA_PESADA);
  if (bytes.byteLength < 60 || FIRMA_PNG.some((x, i) => bytes[i] !== x)) return no(ERROR_FIRMA_FORMATO);

  let pos = 8;
  let ihdr: { ancho: number; alto: number } | null = null;
  const datos: Uint8Array[] = [];
  let cerrado = false;
  let primero = true;
  while (pos + 12 <= bytes.byteLength && !cerrado) {
    const largo = leerU32(bytes, pos);
    const tipo = String.fromCharCode(bytes[pos + 4]!, bytes[pos + 5]!, bytes[pos + 6]!, bytes[pos + 7]!);
    const ini = pos + 8;
    if (largo > bytes.byteLength || ini + largo + 4 > bytes.byteLength) return no(ERROR_FIRMA_FORMATO);
    if (primero && tipo !== "IHDR") return no(ERROR_FIRMA_FORMATO);
    primero = false;
    if (tipo === "IHDR") {
      if (largo !== 13 || ihdr) return no(ERROR_FIRMA_FORMATO);
      const ancho = leerU32(bytes, ini);
      const alto = leerU32(bytes, ini + 4);
      const [profundidad, color, compresion, filtro, entrelazado] = [bytes[ini + 8], bytes[ini + 9], bytes[ini + 10], bytes[ini + 11], bytes[ini + 12]];
      if (profundidad !== 8 || color !== 6 || compresion !== 0 || filtro !== 0 || entrelazado !== 0) return no(ERROR_FIRMA_FORMATO);
      if (ancho < FIRMA_ANCHO_MIN || alto < FIRMA_ALTO_MIN || ancho > FIRMA_ANCHO_MAX || alto > FIRMA_ALTO_MAX) return no(ERROR_FIRMA_FORMATO);
      ihdr = { ancho, alto };
    } else if (tipo === "IDAT") {
      if (!ihdr) return no(ERROR_FIRMA_FORMATO);
      datos.push(bytes.subarray(ini, ini + largo));
    } else if (tipo === "IEND") {
      cerrado = true;
    }
    pos = ini + largo + 4;
  }
  if (!ihdr || !cerrado || datos.length === 0) return no(ERROR_FIRMA_FORMATO);

  const { ancho, alto } = ihdr;
  const paso = ancho * 4;
  const esperado = (paso + 1) * alto;
  let crudo: Buffer;
  try {
    // El tope de salida corta una bomba de descompresión: si sobra, es que no es lo que dice el encabezado.
    crudo = inflateSync(Buffer.concat(datos), { maxOutputLength: esperado });
  } catch {
    return no(ERROR_FIRMA_FORMATO);
  }
  if (crudo.byteLength !== esperado) return no(ERROR_FIRMA_FORMATO);

  // Desfiltrar fila por fila.
  const px = new Uint8Array(paso * alto);
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[y * (paso + 1)]!;
    if (filtro > 4) return no(ERROR_FIRMA_FORMATO);
    const desde = y * (paso + 1) + 1;
    const fila = y * paso;
    for (let x = 0; x < paso; x++) {
      const crudoX = crudo[desde + x]!;
      const izq = x >= 4 ? px[fila + x - 4]! : 0;
      const arr = y > 0 ? px[fila - paso + x]! : 0;
      const arrIzq = y > 0 && x >= 4 ? px[fila - paso + x - 4]! : 0;
      const pred = filtro === 0 ? 0 : filtro === 1 ? izq : filtro === 2 ? arr : filtro === 3 ? (izq + arr) >> 1 : paeth(izq, arr, arrIzq);
      px[fila + x] = (crudoX + pred) & 0xff;
    }
  }

  // Trazo = opaco (alfa ≥ 64) y no blanco (algún canal < 240).
  let pixeles = 0;
  let minX = ancho, maxX = -1, minY = alto, maxY = -1;
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      if (px[i + 3]! >= 64 && (px[i]! < 240 || px[i + 1]! < 240 || px[i + 2]! < 240)) {
        pixeles++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (pixeles < FIRMA_PIXELES_MIN) return no(ERROR_FIRMA_VACIA);
  if (Math.max(maxX - minX, maxY - minY) < FIRMA_EXTENSION_MIN) return no(ERROR_FIRMA_VACIA);
  if (pixeles > ancho * alto * FIRMA_RELLENO_MAX) return no(ERROR_FIRMA_FORMATO);
  return { ok: true, ancho, alto, pixeles };
}
