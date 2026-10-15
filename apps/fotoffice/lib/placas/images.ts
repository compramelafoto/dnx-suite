/**
 * Las imágenes de una placa, listas para el módulo de diseño.
 *
 * Separado de `render.ts` para poder probarlo sin la base: es la parte que más puede fallar con
 * datos reales (fotos en WebP, de 6000 px, con la orientación en el EXIF).
 */

/** Lado mayor, en píxeles, al que se reduce cada foto antes de dibujarla. */
const LADO_MAXIMO_FOTO = 1600;

export type ImagenLista = Uint8Array;

/**
 * Trae una imagen y la deja en un formato que el módulo de diseño sabe dibujar.
 *
 * Las fotos de los socios pueden estar en WebP, que ni `pdf-lib` ni `mupdf` leen. Se pasan por
 * `sharp`: se enderezan según su EXIF, se achican (una foto de 6000 px no suma nada en una placa
 * de 1080 y vuelve lento el PDF) y salen en JPG, o en PNG si tienen transparencia —un logo—.
 *
 * Devuelve `null` si no se pudo: quien llama decide qué hacer con el hueco.
 */
export async function prepararImagen(ref: string): Promise<ImagenLista | null> {
  let bytes: Uint8Array;
  try {
    if (ref.startsWith("data:")) {
      const coma = ref.indexOf(",");
      if (coma < 0) return null;
      bytes = new Uint8Array(Buffer.from(ref.slice(coma + 1), "base64"));
    } else if (/^https?:\/\//.test(ref)) {
      const respuesta = await fetch(ref, { signal: AbortSignal.timeout(15_000) });
      if (!respuesta.ok) return null;
      bytes = new Uint8Array(await respuesta.arrayBuffer());
    } else {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const { default: sharp } = await import("sharp");
    const imagen = sharp(bytes, { failOn: "none" }).rotate().resize({
      width: LADO_MAXIMO_FOTO,
      height: LADO_MAXIMO_FOTO,
      fit: "inside",
      withoutEnlargement: true,
    });
    const { hasAlpha } = await imagen.metadata();
    const salida = hasAlpha
      ? await imagen.png().toBuffer()
      : await imagen.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
    return new Uint8Array(salida);
  } catch {
    return null;
  }
}

