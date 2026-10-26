import "server-only";
import { randomUUID } from "node:crypto";
import { deleteFotofficeR2Object, isFotofficeR2Configured, uploadToFotofficeR2 } from "@/lib/images/r2-client";
import { sniffImageFormat } from "@/lib/images/validation";
import { nombreParaKey } from "@/lib/trabajos/reglas";
import { FORMATOS_FOTO_AUTOR, MAX_BYTES_FOTO_AUTOR, MENSAJE_FOTO_PESADA, prefijoFotoAutor } from "./dominio";

/**
 * Foto del autor de un testimonio: llega DENTRO del envío del formulario (el navegador ya la achicó
 * a 800 px) y el servidor la sube a R2. No hay subida directa del navegador: el formulario vive
 * también en los dominios propios de cada estudio y el CORS del bucket sólo admite FOTOFFICE.
 *
 * Orden: tipo y peso, firma binaria (lo que dice el navegador no alcanza) y recién entonces se sube,
 * con una key que arma el servidor (`fotoffice/site-testimonios/<workspaceId>/<uuid>.<ext>`). Cada
 * envío tiene su propia key: si después el testimonio no se crea, se borra sólo esa.
 */

const MENSAJE_FOTO_TIPO = "La foto tiene que ser JPG, PNG o WebP.";
const MENSAJE_FOTO_INVALIDA = "El archivo no es una imagen JPG, PNG o WebP válida.";
const MENSAJE_SIN_R2 = "Ahora no se pueden subir fotos. Podés enviar el testimonio sin foto.";
const MENSAJE_NO_SUBIDA = "No pudimos guardar la foto. Probá de nuevo o enviá el testimonio sin foto.";

export type FotoRevisada = { bytes: Buffer; tipo: string };
export type ResultadoFoto = { ok: true; valor: { key: string; url: string } } | { ok: false; error: string };

/** Lo que vino en el campo `foto`: un archivo con algo adentro, o null (sin foto). */
export function archivoDeFoto(v: FormDataEntryValue | null): File | null {
  if (typeof v !== "object" || v === null) return null;
  const f = v as File;
  return typeof f.arrayBuffer === "function" && f.size > 0 ? f : null;
}

/** Revisa la foto sin subirla: tipo declarado, peso y firma binaria. Devuelve los bytes y el tipo real. */
export async function revisarFotoAutor(archivo: File): Promise<({ ok: true } & FotoRevisada) | { ok: false; error: string }> {
  if (!(FORMATOS_FOTO_AUTOR as readonly string[]).includes(archivo.type)) return { ok: false, error: MENSAJE_FOTO_TIPO };
  if (archivo.size > MAX_BYTES_FOTO_AUTOR) return { ok: false, error: MENSAJE_FOTO_PESADA };
  const bytes = Buffer.from(await archivo.arrayBuffer());
  if (bytes.length > MAX_BYTES_FOTO_AUTOR) return { ok: false, error: MENSAJE_FOTO_PESADA };
  const tipo = sniffImageFormat(bytes.subarray(0, 16));
  if (!tipo || !(FORMATOS_FOTO_AUTOR as readonly string[]).includes(tipo)) return { ok: false, error: MENSAJE_FOTO_INVALIDA };
  return { ok: true, bytes, tipo };
}

/** Sube una foto ya revisada. La extensión y el Content-Type salen de la firma, no del navegador. */
export async function subirFotoAutor(workspaceId: string, revisada: FotoRevisada): Promise<ResultadoFoto> {
  if (!isFotofficeR2Configured()) return { ok: false, error: MENSAJE_SIN_R2 };
  const key = `${prefijoFotoAutor(workspaceId)}${randomUUID()}${nombreParaKey(revisada.tipo).replace(/^foto/, "")}`;
  try {
    const r = await uploadToFotofficeR2(revisada.bytes, key, revisada.tipo);
    return { ok: true, valor: { key: r.key, url: r.url } };
  } catch (err) {
    console.error("[testimonios] no se pudo subir la foto del autor", { error: (err as { name?: string })?.name ?? "desconocido" });
    return { ok: false, error: MENSAJE_NO_SUBIDA };
  }
}

/** Borra la foto de un envío que al final no creó testimonio. Nunca lanza. */
export async function borrarFotoAutor(key: string | null): Promise<void> {
  if (!key) return;
  try {
    const r = await deleteFotofficeR2Object(key);
    if (!r.ok) console.error("[testimonios] no se pudo borrar una foto sin testimonio", { codigo: r.code });
  } catch (err) {
    console.error("[testimonios] no se pudo borrar una foto sin testimonio", { error: (err as { name?: string })?.name ?? "desconocido" });
  }
}
