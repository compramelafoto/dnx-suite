import "server-only";
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import {
  SEGUNDOS_DESCARGA_ORIGINAL, SEGUNDOS_LECTURA_FOTO, SEGUNDOS_SUBIDA_FOTO, SEGUNDOS_SUBIDA_VIDEO, medioDeTipo, tamanoMaximoDe,
} from "./constantes";
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

/**
 * PUT firmado del ORIGINAL: 15 minutos para una foto (hasta 50 MB) y 60 para un video (MP4 o MOV, hasta 5 GB, una
 * sola URL). Tipo y largo quedan dentro de la firma.
 */
export async function urlDeSubidaFoto(clave: string, tipo: string, tamano: number): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo !== "original") throw new Error("Solo se sube el original");
  const medio = medioDeTipo(tipo);
  if (!medio) throw new Error("Tipo de archivo no permitido");
  if (!Number.isInteger(tamano) || tamano <= 0 || tamano > tamanoMaximoDe(medio)) throw new Error("Tamaño de archivo no permitido");
  const cmd = new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ContentType: tipo, ContentLength: tamano });
  return getSignedUrl(clienteR2Privado(), cmd, {
    expiresIn: medio === "VIDEO" ? SEGUNDOS_SUBIDA_VIDEO : SEGUNDOS_SUBIDA_FOTO,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/** GET firmado por 1 hora, para mostrar en el navegador (inline). Nunca el original. */
export async function urlDeLecturaFoto(clave: string): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo === "original") throw new Error("El original no se muestra");
  const cmd = new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ResponseContentDisposition: "inline" });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_LECTURA_FOTO });
}

/**
 * GET firmado por 1 hora del ORIGINAL de un VIDEO, para reproducirlo en el navegador (inline). Lo llama
 * únicamente la función que ya validó token, galería de entrega y que la fila sea un video LISTA.
 */
export async function urlDeReproduccionVideo(clave: string): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo !== "original") throw new Error("Sólo se reproduce el original");
  const cmd = new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ResponseContentDisposition: "inline" });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_LECTURA_FOTO });
}

/**
 * GET firmado por 1 hora para BAJAR la vista (attachment). Sólo `vista.jpg`: nunca el original ni la
 * miniatura. `nombre` ya viene saneado (`nombreDeDescarga`).
 */
export async function urlDeDescargaFoto(clave: string, nombre: { ascii: string; utf8: string }): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo !== "vista") throw new Error("Sólo se descarga la vista");
  const cmd = new GetObjectCommand({
    Bucket: bucketR2Privado(),
    Key: clave,
    ResponseContentDisposition: `attachment; filename="${nombre.ascii}"; filename*=UTF-8''${encodeURIComponent(nombre.utf8)}`,
    ResponseContentType: "image/jpeg",
  });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_LECTURA_FOTO });
}

/** Codificación de `filename*` (RFC 5987): además de lo que escapa `encodeURIComponent`, ! ' ( ) *. */
function encodeRfc5987(v: string): string {
  return encodeURIComponent(v).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/**
 * GET firmado por 5 minutos para BAJAR el ORIGINAL (attachment, con su nombre). Sólo `original`: lo llama
 * únicamente la acción que ya validó token, foto y compra/inclusión. `nombre` ya viene saneado (`nombreDeOriginal`).
 */
export async function urlDeDescargaOriginal(clave: string, nombre: { ascii: string; utf8: string }): Promise<string> {
  if (analizarClave(claveSegura(clave))?.tipo !== "original") throw new Error("Sólo se descarga el original");
  const cmd = new GetObjectCommand({
    Bucket: bucketR2Privado(),
    Key: clave,
    ResponseContentDisposition: `attachment; filename="${nombre.ascii}"; filename*=UTF-8''${encodeRfc5987(nombre.utf8)}`,
  });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_DESCARGA_ORIGINAL });
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

/**
 * Copia un objeto de la galería a otra clave del mismo bucket (`CopyObject`, sin bajar ni subir el archivo). Origen y destino
 * tienen que ser claves válidas del MISMO workspace y del MISMO tipo de objeto (original con original, vista con vista,
 * miniatura con miniatura): así una copia nunca cruza de organización ni convierte un original en otra cosa. Devuelve false
 * si el origen no existe.
 */
export async function copiarObjeto(origen: string, destino: string): Promise<boolean> {
  const o = analizarClave(claveSegura(origen));
  const d = analizarClave(claveSegura(destino));
  if (!o || !d || o.workspaceId !== d.workspaceId || o.tipo !== d.tipo) throw new Error("Copia entre claves que no corresponden");
  try {
    await clienteR2Privado().send(new CopyObjectCommand({ Bucket: bucketR2Privado(), Key: destino, CopySource: `${bucketR2Privado()}/${origen}`, MetadataDirective: "COPY" }));
    return true;
  } catch (err) {
    if (esNoEncontrado(err)) return false;
    throw err;
  }
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
