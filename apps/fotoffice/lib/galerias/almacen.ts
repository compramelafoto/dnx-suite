import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { SEGUNDOS_LECTURA_FOTO, SEGUNDOS_SUBIDA_FOTO, TAMANO_MAXIMO_ORIGINAL, esTipoFotoPermitido } from "./constantes";
import { analizarClave, esClaveDeGaleria } from "./claves";

/**
 * Objetos de las galerías en el bucket PRIVADO de los adjuntos (mismo cliente S3 y credenciales,
 * ver `lib/ficha/adjuntos-r2.ts`). Toda clave se valida con la regex de `claves.ts` antes de
 * tocar el bucket. Nada es público: solo enlaces firmados que vencen.
 */

function claveSegura(clave: string): string {
  if (!esClaveDeGaleria(clave)) throw new Error("Clave de galería inválida");
  return clave;
}

/** PUT firmado por 15 minutos. Tipo y largo quedan dentro de la firma. Solo para el original. */
export async function urlDeSubidaFoto(clave: string, tipo: string, tamano: number): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo !== "original") throw new Error("Solo se sube el original");
  if (!esTipoFotoPermitido(tipo)) throw new Error("Tipo de foto no permitido");
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > TAMANO_MAXIMO_ORIGINAL) throw new Error("Tamaño de foto no permitido");
  const cmd = new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ContentType: tipo, ContentLength: tamano });
  return getSignedUrl(clienteR2Privado(), cmd, {
    expiresIn: SEGUNDOS_SUBIDA_FOTO,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/** GET firmado por 1 hora, para mostrar en el navegador (inline). Nunca el original. */
export async function urlDeLecturaFoto(clave: string): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo === "original") throw new Error("El original no se muestra");
  const cmd = new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ResponseContentDisposition: "inline" });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_LECTURA_FOTO });
}

export type FotoConClaves = { id: string; viewKey: string | null; thumbKey: string | null };
export type UrlsDeFoto = { thumbUrl: string | null; viewUrl: string | null };

/**
 * URLs firmadas de miniatura y vista de un lote de fotos (por ejemplo, las de una página). Una
 * clave que falla en firmarse deja esa URL en null: la foto se ve rota, pero la página no se cae.
 */
export async function urlsDeLecturaPorLote(fotos: readonly FotoConClaves[]): Promise<Map<string, UrlsDeFoto>> {
  const firmar = async (clave: string | null): Promise<string | null> => {
    if (!clave) return null;
    try {
      return await urlDeLecturaFoto(clave);
    } catch {
      return null;
    }
  };
  const pares = await Promise.all(
    fotos.map(async (f) => [f.id, { thumbUrl: await firmar(f.thumbKey), viewUrl: await firmar(f.viewKey) }] as const),
  );
  return new Map(pares);
}

/** Tamaño real del objeto, o null si no existe. */
export async function tamanoDeObjeto(clave: string): Promise<number | null> {
  try {
    const r = await clienteR2Privado().send(new HeadObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave) }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch (err) {
    if (esNoEncontrado(err)) return null;
    throw err;
  }
}

/** Lee el objeto entero en memoria (el original pesa 50 MB como máximo). */
export async function leerObjeto(clave: string): Promise<Buffer> {
  const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave) }));
  if (!r.Body) throw new Error("El objeto vino vacío");
  return Buffer.from(await r.Body.transformToByteArray());
}

export async function guardarObjeto(clave: string, cuerpo: Buffer, tipo: string): Promise<void> {
  await clienteR2Privado().send(
    new PutObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave), Body: cuerpo, ContentType: tipo, ContentLength: cuerpo.length }),
  );
}

/** Idempotente: borrar algo que ya no está no es un error. */
export async function borrarObjetoFoto(clave: string): Promise<void> {
  try {
    await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave) }));
  } catch (err) {
    if (esNoEncontrado(err)) return;
    throw err;
  }
}
