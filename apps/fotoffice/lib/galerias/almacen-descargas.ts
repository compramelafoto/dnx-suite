import "server-only";
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand, CreateMultipartUploadCommand, DeleteObjectCommand, GetObjectCommand, UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { esClaveDeGaleria } from "./claves";
import { SEGUNDOS_DESCARGA_PARTE, esClaveDeParte } from "./descargas-reglas";

/**
 * Lo que necesita el armado del ZIP del R2 privado: leer un original en flujo, subir una parte con la subida
 * multiparte y firmar la bajada. Es una interfaz para que las pruebas usen un almacén en memoria.
 */
export interface AlmacenZip {
  /** El objeto como flujo de trozos, o null si ya no existe. */
  leer(clave: string): Promise<AsyncIterable<Uint8Array> | null>;
  iniciarMultiparte(clave: string, tipo: string): Promise<string>;
  /** Sube un bloque (numerado desde 1) y devuelve su etiqueta. */
  subirBloque(clave: string, uploadId: string, numero: number, cuerpo: Buffer): Promise<string>;
  completarMultiparte(clave: string, uploadId: string, bloques: { numero: number; etag: string }[]): Promise<void>;
  abortarMultiparte(clave: string, uploadId: string): Promise<void>;
  borrar(clave: string): Promise<void>;
}

function claveSegura(clave: string): string {
  if (!esClaveDeGaleria(clave) && !esClaveDeParte(clave)) throw new Error("Clave de galería inválida");
  return clave;
}

export const almacenZipR2: AlmacenZip = {
  async leer(clave) {
    try {
      const r = await clienteR2Privado().send(new GetObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave) }));
      return (r.Body as unknown as AsyncIterable<Uint8Array> | undefined) ?? null;
    } catch (err) {
      if (esNoEncontrado(err)) return null;
      throw err;
    }
  },
  async iniciarMultiparte(clave, tipo) {
    const r = await clienteR2Privado().send(new CreateMultipartUploadCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave), ContentType: tipo }));
    if (!r.UploadId) throw new Error("R2 no devolvió el id de la subida");
    return r.UploadId;
  },
  async subirBloque(clave, uploadId, numero, cuerpo) {
    const r = await clienteR2Privado().send(
      new UploadPartCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave), UploadId: uploadId, PartNumber: numero, Body: cuerpo, ContentLength: cuerpo.length }),
    );
    if (!r.ETag) throw new Error("R2 no devolvió la etiqueta del bloque");
    return r.ETag;
  },
  async completarMultiparte(clave, uploadId, bloques) {
    await clienteR2Privado().send(
      new CompleteMultipartUploadCommand({
        Bucket: bucketR2Privado(),
        Key: claveSegura(clave),
        UploadId: uploadId,
        MultipartUpload: { Parts: bloques.map((b) => ({ PartNumber: b.numero, ETag: b.etag })) },
      }),
    );
  },
  async abortarMultiparte(clave, uploadId) {
    try {
      await clienteR2Privado().send(new AbortMultipartUploadCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave), UploadId: uploadId }));
    } catch (err) {
      // Una subida que ya no existe (completada o abortada antes) no es un error.
      if (esNoEncontrado(err) || (err as { name?: string } | null)?.name === "NoSuchUpload") return;
      throw err;
    }
  },
  async borrar(clave) {
    try {
      await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: claveSegura(clave) }));
    } catch (err) {
      if (esNoEncontrado(err)) return;
      throw err;
    }
  },
};

/** GET firmado por 5 minutos de UNA PARTE del ZIP (attachment). Sólo claves de partes. */
export async function urlDeDescargaParte(clave: string, nombre: string): Promise<string> {
  if (!esClaveDeParte(clave)) throw new Error("Sólo se descargan partes de una descarga");
  const ascii = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\- ]/g, "_");
  const cmd = new GetObjectCommand({
    Bucket: bucketR2Privado(),
    Key: clave,
    ResponseContentDisposition: `attachment; filename="${ascii}"`,
    ResponseContentType: "application/zip",
  });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_DESCARGA_PARTE });
}
