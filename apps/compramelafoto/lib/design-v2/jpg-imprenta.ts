/**
 * Ajustes de un JPG para la imprenta sin volver a comprimirlo.
 *
 * La resolución en píxeles ya es la de 300 dpi (la cara se dibuja a la resolución del lienzo),
 * pero un JPG sin la marca de densidad se abre en Photoshop o en el RIP de la imprenta como
 * «72 dpi» y alguien lo agranda o lo achica. Escribir la marca es cambiar unos bytes del
 * encabezado (JFIF): no toca la imagen ni pierde calidad. Puro: sin sharp, para poder probarlo.
 */

const SOI = [0xff, 0xd8];

function esJpg(b: Uint8Array): boolean {
  return b.length > 4 && b[0] === SOI[0] && b[1] === SOI[1];
}

function esJfif(b: Uint8Array, at: number): boolean {
  // FF E0 · largo (2) · "JFIF\0"
  return (
    b[at] === 0xff &&
    b[at + 1] === 0xe0 &&
    b[at + 4] === 0x4a &&
    b[at + 5] === 0x46 &&
    b[at + 6] === 0x49 &&
    b[at + 7] === 0x46 &&
    b[at + 8] === 0x00
  );
}

/** Densidad que declara el JPG (en puntos por pulgada), o null si no declara ninguna en pulgadas. */
export function densidadDeJpg(bytes: Uint8Array): number | null {
  if (!esJpg(bytes) || !esJfif(bytes, 2)) return null;
  const unidades = bytes[13];
  const x = (bytes[14]! << 8) | bytes[15]!;
  if (unidades === 1) return x;
  if (unidades === 2) return Math.round(x * 2.54);
  return null;
}

/**
 * Devuelve el JPG con la marca de densidad en `dpi` (por defecto 300). Si no tiene encabezado
 * JFIF, se lo agrega al principio. Si no es un JPG, lo devuelve igual.
 */
export function jpgConDensidad(bytes: Uint8Array, dpi = 300): Uint8Array {
  if (!esJpg(bytes)) return bytes;
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  if (esJfif(bytes, 2)) {
    if (bytes[13] === 1 && ((bytes[14]! << 8) | bytes[15]!) === d && ((bytes[16]! << 8) | bytes[17]!) === d) {
      return bytes;
    }
    const out = new Uint8Array(bytes);
    out[13] = 1; // puntos por pulgada
    out[14] = d >> 8;
    out[15] = d & 0xff;
    out[16] = d >> 8;
    out[17] = d & 0xff;
    return out;
  }
  const app0 = [
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00,
    0x00,
  ];
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}
