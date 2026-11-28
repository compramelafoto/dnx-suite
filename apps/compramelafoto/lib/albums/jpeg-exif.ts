/**
 * Copia los datos EXIF (fecha de captura, cámara, número de serie…) de un JPEG
 * original a un JPEG re-codificado en el navegador.
 *
 * Al dibujar una foto en un canvas y volver a guardarla, el navegador descarta
 * todos los metadatos. El servidor usa esos datos para la hora de captura y
 * para detectar equipos fotográficos, así que hay que trasplantarlos.
 *
 * Funciones puras sobre bytes: sin DOM, testeables en Node.
 */

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const ORIENTATION_TAG = 0x0112;
const TYPE_SHORT = 3;

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

/** Devuelve el segmento APP1 Exif completo (marcador incluido) o null. */
export function extractExifSegment(bytes: Uint8Array): Uint8Array | null {
  if (!isJpeg(bytes)) return null;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    if (marker === 0xff) {
      pos += 1; // relleno
      continue;
    }
    // Marcadores sin longitud
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      pos += 2;
      continue;
    }
    // Empieza la imagen o termina el archivo: no hay más cabeceras
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (length < 2 || pos + 2 + length > bytes.length) return null;
    if (marker === 0xe1 && length >= 2 + EXIF_HEADER.length) {
      const isExif = EXIF_HEADER.every((b, i) => bytes[pos + 4 + i] === b);
      if (isExif) return bytes.slice(pos, pos + 2 + length);
    }
    pos += 2 + length;
  }
  return null;
}

/**
 * Pone la orientación en "normal" (1). El navegador ya gira los píxeles al
 * dibujar la foto; si dejáramos la orientación original, se giraría dos veces.
 * Devuelve una copia; si el EXIF no se puede leer, la devuelve sin cambios.
 */
export function resetExifOrientation(segment: Uint8Array): Uint8Array {
  const out = segment.slice();
  const tiff = 4 + EXIF_HEADER.length; // FF E1 + longitud + "Exif\0\0"
  if (out.length < tiff + 8) return out;
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const order = view.getUint16(tiff);
  let little: boolean;
  if (order === 0x4949) little = true;
  else if (order === 0x4d4d) little = false;
  else return out;

  const ifd0 = tiff + view.getUint32(tiff + 4, little);
  if (ifd0 + 2 > out.length) return out;
  const count = view.getUint16(ifd0, little);
  for (let i = 0; i < count; i++) {
    const entry = ifd0 + 2 + i * 12;
    if (entry + 12 > out.length) break;
    if (view.getUint16(entry, little) !== ORIENTATION_TAG) continue;
    if (view.getUint16(entry + 2, little) === TYPE_SHORT) {
      view.setUint16(entry + 8, 1, little);
    }
    break;
  }
  return out;
}

/**
 * Inserta el segmento EXIF en un JPEG que no lo tiene, justo después del
 * inicio de archivo. Si el destino ya trae EXIF, lo deja como está.
 */
export function insertExifSegment(
  jpeg: Uint8Array,
  segment: Uint8Array
): Uint8Array {
  if (!isJpeg(jpeg) || extractExifSegment(jpeg)) return jpeg;
  const out = new Uint8Array(jpeg.length + segment.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(segment, 2);
  out.set(jpeg.subarray(2), 2 + segment.length);
  return out;
}

/** Trasplanta el EXIF del original al re-codificado, con orientación normal. */
export function transplantExif(
  original: Uint8Array,
  reencoded: Uint8Array
): Uint8Array {
  const segment = extractExifSegment(original);
  if (!segment) return reencoded;
  return insertExifSegment(reencoded, resetExifOrientation(segment));
}
