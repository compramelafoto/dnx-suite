import "server-only";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl, isFotofficeR2Configured } from "@/lib/images/r2-client";
import { createFotofficeUploadUrl, verifyUploadedImage } from "@/lib/images/r2-presign";
import { nombreParaKey } from "@/lib/trabajos/reglas";
import { esKeyFotoAutor, FORMATOS_FOTO_AUTOR, MAX_BYTES_FOTO_AUTOR, prefijoFotoAutor } from "./dominio";

/**
 * Foto del autor de un testimonio, subida directo del navegador a R2 (mismo camino que las fotos de
 * Trabajos, pero de a una y sin sesión: la pide el formulario público).
 *
 * 1. `prepararFotoAutor`: revisa tipo y peso DECLARADOS y firma una URL bajo el prefijo del
 *    workspace (`fotoffice/site-testimonios/<workspaceId>/`), que arma el servidor.
 * 2. El navegador sube con PUT.
 * 3. `confirmarFotoAutor` (al enviar el formulario): mira el objeto ya subido (peso real y firma
 *    binaria). Si no pasa, se borra de R2. La dirección pública se arma SIEMPRE de la key: nunca se
 *    guarda una URL que mandó el navegador.
 */

const MB = 1024 * 1024;

export type ResultadoFoto<T> = { ok: true; valor: T } | { ok: false; error: string; sinR2?: boolean };

export async function prepararFotoAutor(
  workspaceId: string,
  archivo: { tipo: string; bytes: number },
): Promise<ResultadoFoto<{ uploadUrl: string; key: string }>> {
  if (!(FORMATOS_FOTO_AUTOR as readonly string[]).includes(archivo.tipo)) {
    return { ok: false, error: "La foto tiene que ser JPG, PNG o WebP." };
  }
  if (!Number.isFinite(archivo.bytes) || archivo.bytes <= 0) return { ok: false, error: "La foto está vacía." };
  if (archivo.bytes > MAX_BYTES_FOTO_AUTOR) return { ok: false, error: `La foto pesa más de ${MAX_BYTES_FOTO_AUTOR / MB} MB.` };
  if (!isFotofficeR2Configured()) return { ok: false, error: "Ahora no se pueden subir fotos. Podés enviar el testimonio sin foto.", sinR2: true };
  // La extensión de la key sale del tipo, no del nombre que manda el navegador.
  const { uploadUrl, key } = await createFotofficeUploadUrl({
    prefix: prefijoFotoAutor(workspaceId),
    originalFilename: nombreParaKey(archivo.tipo),
    contentType: archivo.tipo,
  });
  return { ok: true, valor: { uploadUrl, key } };
}

const NO_VERIFICADA = "No pudimos usar la foto. Probá con otra o enviá el testimonio sin foto.";

/** La foto ya subida, verificada; devuelve la key y su dirección pública (armada de la key). */
export async function confirmarFotoAutor(workspaceId: string, key: unknown): Promise<ResultadoFoto<{ key: string; url: string }>> {
  // Una key de otro workspace u otro prefijo no se verifica ni se borra: no es de este formulario.
  if (!esKeyFotoAutor(workspaceId, key)) return { ok: false, error: NO_VERIFICADA };
  let verificacion: Awaited<ReturnType<typeof verifyUploadedImage>>;
  try {
    verificacion = await verifyUploadedImage({ key, maxFileSizeBytes: MAX_BYTES_FOTO_AUTOR, acceptedFormats: FORMATOS_FOTO_AUTOR });
  } catch (err) {
    // Típicamente: el objeto no está (la subida no terminó).
    console.error("[fotoffice][testimonios] no se pudo verificar la foto del autor", { error: (err as { name?: string })?.name ?? "desconocido" });
    return { ok: false, error: NO_VERIFICADA };
  }
  if (!verificacion.ok) {
    const r = await deleteFotofficeR2Object(key);
    if (!r.ok) console.error("[fotoffice][testimonios] no se pudo borrar una foto inválida", key);
    return { ok: false, error: verificacion.error };
  }
  return { ok: true, valor: { key, url: getFotofficeR2PublicUrl(key) } };
}
