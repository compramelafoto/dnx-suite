import "server-only";
import sharp from "sharp";
import { MAX_PIXELES } from "@/lib/imagenes/procesar";
import { leerBytesDeR2 } from "@/lib/imagenes/r2";

export type ImagenPdf = { jpg: Uint8Array; width: number; height: number };

/**
 * Una foto del bucket lista para `pdf.embedJpg`: pdf-lib no sabe leer WebP. Sin agrandar (D2: se
 * usa lo que guardamos), con fondo blanco por si trae transparencia. `null` si no está o no se
 * puede leer: la pieza sale igual, sin esa foto.
 */
export async function imagenParaPdf(url: string | null, ladoMax: number, calidad = 85): Promise<ImagenPdf | null> {
  if (!url) return null;
  const bytes = await leerBytesDeR2(url);
  if (!bytes) return null;
  try {
    const { data, info } = await sharp(bytes, { limitInputPixels: MAX_PIXELES })
      .rotate()
      .resize({ width: ladoMax, height: ladoMax, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: calidad })
      .toBuffer({ resolveWithObject: true });
    return { jpg: new Uint8Array(data), width: info.width, height: info.height };
  } catch (err) {
    console.error("[piezas] foto ilegible:", err instanceof Error ? err.message : String(err));
    return null;
  }
}
