import "server-only";
import { deleteFotofficeR2Object, getFotofficeR2PublicUrl, listFotofficeR2Keys } from "@/lib/images/r2-client";
import { FOTOFFICE_R2_PREFIXES } from "@/lib/images/r2-key-policy";
import { createFotofficeUploadUrl, verifyUploadedImage } from "@/lib/images/r2-presign";

/**
 * Las fotos del formulario de alta: el navegador sube directo a R2 con un permiso de un minuto, y
 * después el servidor mira el archivo subido (tamaño real y firma binaria) antes de aceptarlo.
 * El token del enlace es la credencial: sólo se firma dentro de la carpeta de ESE formulario.
 */

/** Tope por foto. El navegador ya achica las grandes; esto frena lo que llegue sin achicar. */
export const MAXIMO_BYTES_POR_FOTO = 15 * 1024 * 1024;

/** Tope por formulario: alcanza de sobra para 20 productos con varias fotos, y frena abusos. */
export const MAXIMO_FOTOS_POR_ALTA = 200;

const TIPOS = ["image/jpeg", "image/png", "image/webp"] as const;

export function carpetaDeAlta(altaId: string): string {
  return `${FOTOFFICE_R2_PREFIXES.altaClientePhoto}/${altaId.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export type PermisoDeSubida = { ok: true; uploadUrl: string; key: string } | { ok: false; error: string };

export async function permisoParaSubirFoto(altaId: string, tipo: string): Promise<PermisoDeSubida> {
  if (!(TIPOS as readonly string[]).includes(tipo)) {
    return { ok: false, error: "Sólo se pueden subir fotos JPG, PNG o WebP." };
  }
  const carpeta = carpetaDeAlta(altaId);
  const yaSubidas = await listFotofficeR2Keys(`${carpeta}/`);
  if (yaSubidas.length >= MAXIMO_FOTOS_POR_ALTA) {
    return { ok: false, error: "Llegaste al máximo de fotos de este formulario. Escribinos y lo ampliamos." };
  }
  const extension = tipo === "image/png" ? ".png" : tipo === "image/webp" ? ".webp" : ".jpg";
  const { uploadUrl, key } = await createFotofficeUploadUrl({
    prefix: carpeta,
    originalFilename: `foto${extension}`,
    contentType: tipo,
  });
  return { ok: true, uploadUrl, key };
}

export type FotoConfirmada = { ok: true; url: string } | { ok: false; error: string };

export async function confirmarFotoSubida(altaId: string, key: string): Promise<FotoConfirmada> {
  // Una key de otra carpeta no se toca: ni se verifica ni se borra.
  if (!key.startsWith(`${carpetaDeAlta(altaId)}/`) || key.includes("..")) {
    return { ok: false, error: "No pudimos verificar la foto. Probá de nuevo." };
  }
  const r = await verifyUploadedImage({
    key,
    maxFileSizeBytes: MAXIMO_BYTES_POR_FOTO,
    acceptedFormats: TIPOS,
  }).catch(() => ({ ok: false as const, error: "No pudimos verificar la foto. Probá de nuevo." }));
  if (!r.ok) {
    await deleteFotofficeR2Object(key).catch(() => undefined);
    return { ok: false, error: r.error };
  }
  return { ok: true, url: getFotofficeR2PublicUrl(key) };
}
