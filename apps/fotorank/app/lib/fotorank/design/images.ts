import "server-only";
import { readPrivateObject } from "../storage/provider";
import { loadEntryImageRecord } from "../external/entry-image-db";
import { designAssetKeyFromRef } from "./asset-storage";

/**
 * Las imágenes de un diploma o de una imagen de ganador, listas para el módulo de diseño.
 *
 * El módulo de diseño sólo dibuja PNG y JPG. Las obras pueden llegar en TIFF, en WebP o a
 * 6000 px, y los logos en WebP: todo pasa por `sharp`, se endereza según el EXIF, se achica y
 * sale en JPG (o en PNG si tiene transparencia, como un logo).
 *
 * Cualquier falla devuelve `null`: quien llama decide qué hacer con el hueco. Una imagen que no
 * se puede leer no debe tumbar el diploma entero.
 */

/** Lado mayor al que se reduce cada imagen. Una obra en un diploma A4 a 300 dpi no necesita más. */
const LADO_MAXIMO = 2400;

/** Prefijo de las referencias a la obra de un concurso: se leen del almacenamiento privado. */
export const ENTRY_IMAGE_REF_PREFIX = "fotorank-entry:";

export function entryImageRef(entryId: string): string {
  return `${ENTRY_IMAGE_REF_PREFIX}${entryId}`;
}

async function normalizar(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { default: sharp } = await import("sharp");
    const imagen = sharp(bytes, { failOn: "none" }).rotate().resize({
      width: LADO_MAXIMO,
      height: LADO_MAXIMO,
      fit: "inside",
      withoutEnlargement: true,
    });
    const { hasAlpha } = await imagen.metadata();
    const salida = hasAlpha
      ? await imagen.png().toBuffer()
      : await imagen.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
    return new Uint8Array(salida);
  } catch {
    return null;
  }
}

/** La obra de un concurso: la vista del jurado si existe (ya liviana), si no el original. */
async function leerObra(entryId: string): Promise<Uint8Array | null> {
  const registro = await loadEntryImageRecord(entryId);
  if (!registro || !registro.original) return null;
  for (const key of [registro.juryPreview?.storageKey, registro.original.storageKey]) {
    if (!key) continue;
    try {
      return await readPrivateObject(key);
    } catch {
      // Sigue con el original.
    }
  }
  return null;
}

function baseUrlPublica(): string {
  const explicit =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_FOTORANK_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

async function leerBytes(ref: string): Promise<Uint8Array | null> {
  try {
    if (ref.startsWith(ENTRY_IMAGE_REF_PREFIX)) {
      return await leerObra(ref.slice(ENTRY_IMAGE_REF_PREFIX.length));
    }
    const claveDeDiseno = designAssetKeyFromRef(ref);
    if (claveDeDiseno) {
      return await readPrivateObject(claveDeDiseno);
    }
    if (ref.startsWith("data:")) {
      const coma = ref.indexOf(",");
      if (coma < 0) return null;
      const cabecera = ref.slice(0, coma);
      const cuerpo = ref.slice(coma + 1);
      return new Uint8Array(
        cabecera.includes(";base64")
          ? Buffer.from(cuerpo, "base64")
          : Buffer.from(decodeURIComponent(cuerpo), "utf8"),
      );
    }
    const url = /^https?:\/\//i.test(ref) ? ref : ref.startsWith("/") ? `${baseUrlPublica()}${ref}` : null;
    if (!url) return null;
    const respuesta = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!respuesta.ok) return null;
    return new Uint8Array(await respuesta.arrayBuffer());
  } catch {
    return null;
  }
}

/** Trae una imagen (de la obra, del diseño, de una URL) y la deja en PNG o JPG. */
export async function prepararImagen(ref: string): Promise<Uint8Array | null> {
  const bytes = await leerBytes(ref);
  if (!bytes) return null;
  return normalizar(bytes);
}
