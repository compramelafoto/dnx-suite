import "server-only";
import { urlDeDemo } from "./demo-de-plantilla";

/**
 * Los archivos de la demo (`template-v2/demo/` en R2), leídos por su dirección pública: la misma
 * que usa el navegador en la vista 3D. Si un archivo no está (todavía no se subió), se responde
 * "no está" y quien lo usa pone la foto de muestra; nunca rompe.
 *
 * Que un archivo exista se recuerda unos minutos para no preguntar en cada miniatura.
 */

const RECORDAR_MS = 5 * 60_000;
const existencia = new Map<string, { hay: boolean; hasta: number }>();

function basePublica(): string | null {
  return (
    // Sólo para probar en local con otras fotos; en producción no se configura.
    process.env.DEMO_PLANTILLAS_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.trim() ||
    process.env.R2_PUBLIC_URL?.trim() ||
    process.env.R2_PUBLIC_BASE_URL?.trim() ||
    null
  );
}

export function urlPublicaDeDemo(archivo: string): string | null {
  return urlDeDemo(basePublica(), archivo);
}

/** ¿Está subido el archivo? Ante cualquier error de red, "no". */
export async function hayArchivoDeDemo(archivo: string): Promise<boolean> {
  const url = urlPublicaDeDemo(archivo);
  if (!url) return false;
  const guardado = existencia.get(url);
  if (guardado && guardado.hasta > Date.now()) return guardado.hay;
  let hay = false;
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5_000), cache: "no-store" });
    hay = res.ok && (res.headers.get("content-type") ?? "").startsWith("image/");
  } catch {
    hay = false;
  }
  existencia.set(url, { hay, hasta: Date.now() + RECORDAR_MS });
  return hay;
}

/** El contenido del archivo, o null si no está. */
export async function leerArchivoDeDemo(archivo: string): Promise<Uint8Array | null> {
  const url = urlPublicaDeDemo(archivo);
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), cache: "no-store" });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}
