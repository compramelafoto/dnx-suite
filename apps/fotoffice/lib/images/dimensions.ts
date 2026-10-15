/**
 * Alto y ancho de una imagen, leídos de sus primeros bytes.
 *
 * ── Por qué existe ──
 *
 * En la subida normal el alto y el ancho los aporta el navegador, que ya tiene la imagen abierta.
 * Pero una migración o cualquier proceso del servidor no tiene navegador, y sin esas dos medidas la
 * galería de mampostería no puede reservar el espacio de cada foto: la grilla salta al cargar.
 *
 * ── Por qué a mano y no con una librería ──
 *
 * Leer el encabezado de PNG, JPEG y WebP son treinta líneas, y los tres formatos tienen cabeceras
 * estables desde los años noventa. Una dependencia nueva en este monorepo entra en el lockfile de
 * todas las apps; esto no le cuesta nada a nadie.
 */

export type ImageDimensions = { width: number; height: number };

/** Devuelve las medidas, o `null` si los bytes no alcanzan o el formato no es de los tres. */
export function readImageDimensionsFromBytes(bytes: Uint8Array): ImageDimensions | null {
  return leerPng(bytes) ?? leerJpeg(bytes) ?? leerWebp(bytes);
}

function u16be(b: Uint8Array, i: number): number {
  return (b[i] << 8) | b[i + 1];
}
function u32be(b: Uint8Array, i: number): number {
  return ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
}
function u16le(b: Uint8Array, i: number): number {
  return b[i] | (b[i + 1] << 8);
}
function u32le(b: Uint8Array, i: number): number {
  return (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
}

/** PNG: el bloque IHDR está siempre en la misma posición, con el alto y el ancho en big-endian. */
function leerPng(b: Uint8Array): ImageDimensions | null {
  if (b.length < 24) return null;
  const firma = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!firma.every((v, i) => b[i] === v)) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

/**
 * JPEG: hay que recorrer los segmentos hasta encontrar un SOF (start of frame).
 *
 * No alcanza con mirar una posición fija: antes del SOF vienen EXIF, perfiles de color y miniaturas,
 * y su largo cambia con cada cámara y cada programa de edición.
 */
function leerJpeg(b: Uint8Array): ImageDimensions | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;

  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marcador = b[i + 1];

    // Rellenos y marcadores sin carga útil.
    if (marcador === 0xff || marcador === 0x01 || (marcador >= 0xd0 && marcador <= 0xd9)) {
      i += 2;
      continue;
    }

    const largo = u16be(b, i + 2);
    if (largo < 2) return null;

    // SOF0..SOF15, salvo DHT (c4), DAC (cc) y los RST, que comparten el rango.
    const esSof =
      marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc;

    if (esSof) {
      // Dentro del SOF: precisión (1), alto (2), ancho (2).
      return { height: u16be(b, i + 5), width: u16be(b, i + 7) };
    }

    i += 2 + largo;
  }
  return null;
}

/** WebP: tres variantes —simple, sin pérdida y extendida— y cada una guarda las medidas distinto. */
function leerWebp(b: Uint8Array): ImageDimensions | null {
  if (b.length < 30) return null;
  const texto = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (texto(0, 4) !== "RIFF" || texto(8, 4) !== "WEBP") return null;

  const tipo = texto(12, 4);

  if (tipo === "VP8 ") {
    // Con pérdida: 14 bytes de cabecera y después el marco, con 14 bits por medida.
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }

  if (tipo === "VP8L") {
    // Sin pérdida: 14 bits de ancho y 14 de alto, empaquetados, menos uno cada uno.
    const bits = u32le(b, 21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }

  if (tipo === "VP8X") {
    // Extendida (animación, transparencia): 24 bits por medida, menos uno.
    const ancho = (b[24] | (b[25] << 8) | (b[26] << 16)) + 1;
    const alto = (b[27] | (b[28] << 8) | (b[29] << 16)) + 1;
    return { width: ancho, height: alto };
  }

  return null;
}
