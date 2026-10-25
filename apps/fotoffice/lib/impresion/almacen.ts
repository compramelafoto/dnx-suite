import "server-only";
import { CopyObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { bucketR2Privado, clienteR2Privado } from "@/lib/ficha/adjuntos-r2";
import { borrarArchivoGuardado, tamanoDeArchivo, urlDeLecturaArchivo, urlDeSubidaArchivo } from "@/lib/carpetas/almacen";

/** Originales, vistas previas y finales de impresión, en el bucket privado de FOTOFFICE. */

export const MAX_BYTES_ORIGINAL = 60 * 1024 * 1024;
export const TIPOS_ORIGINAL = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;

const SEGURO = /^[A-Za-z0-9_-]{1,64}$/;

export function claveImpresion(workspaceId: string, preparacionId: string, tipo: "original" | "vista" | "final", id: string, ext: string): string {
  for (const parte of [workspaceId, preparacionId, id]) if (!SEGURO.test(parte)) throw new Error("Parte de clave inválida");
  if (!/^[a-z0-9]{2,5}$/.test(ext)) throw new Error("Extensión inválida");
  return `fotoffice/impresion/${workspaceId}/${preparacionId}/${tipo}/${id}.${ext}`;
}

export async function urlDeSubidaOriginal(clave: string, tipo: string, bytes: number): Promise<string> {
  if (!(TIPOS_ORIGINAL as readonly string[]).includes(tipo)) throw new Error("Tipo no permitido");
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES_ORIGINAL) throw new Error("Tamaño no permitido");
  return urlDeSubidaArchivo(clave, tipo, bytes);
}

export async function leerObjeto(clave: string): Promise<Buffer> {
  const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
  if (!r.Body) throw new Error("Objeto vacío");
  return Buffer.from(await r.Body.transformToByteArray());
}

export async function guardarObjeto(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
  await clienteR2Privado().send(new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, Body: cuerpo, ContentType: tipo, ContentLength: cuerpo.length }));
}

export async function copiarObjeto(origen: string, destino: string): Promise<void> {
  const b = bucketR2Privado();
  await clienteR2Privado().send(new CopyObjectCommand({ Bucket: b, Key: destino, CopySource: `${b}/${encodeURI(origen)}` }));
}

export { tamanoDeArchivo as tamanoDeObjeto, borrarArchivoGuardado as borrarObjetoImpresion, urlDeLecturaArchivo };
