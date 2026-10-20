import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { MAX_BYTES_PARTE } from "../constants";
import { esClaveDeParte } from "../claves";

const SEGUNDOS_SUBIDA = 15 * 60;
/** "Descargar crudo" de 3 horas puede tardar: la lectura dura 6 horas. */
const SEGUNDOS_LECTURA = 6 * 3600;

export async function urlDeSubidaParte(clave: string, tipo: string, bytes: number): Promise<string> {
  if (!esClaveDeParte(clave)) throw new Error("Clave no válida");
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES_PARTE) throw new Error("Tamaño no permitido");
  const cmd = new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ContentType: tipo, ContentLength: bytes });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_SUBIDA, signableHeaders: new Set(["content-type", "content-length"]) });
}

export async function urlDeLecturaParte(clave: string): Promise<string> {
  if (!esClaveDeParte(clave)) throw new Error("Clave no válida");
  return getSignedUrl(clienteR2Privado(), new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave }), { expiresIn: SEGUNDOS_LECTURA });
}

export async function tamanoDeParte(clave: string): Promise<number | null> {
  try {
    const r = await clienteR2Privado().send(new HeadObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch (e) {
    if (esNoEncontrado(e)) return null;
    throw e;
  }
}

/** Borra todo lo que esté bajo `digitalizacion/<ws>/<grabacion>/`, de a 1000 objetos. */
export async function borrarPrefijo(prefijo: string): Promise<void> {
  if (!/^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/$/.test(prefijo)) throw new Error("Prefijo no válido");
  const s3 = clienteR2Privado();
  let token: string | undefined;
  do {
    const lista = await s3.send(new ListObjectsV2Command({ Bucket: bucketR2Privado(), Prefix: prefijo, ContinuationToken: token }));
    const claves = (lista.Contents ?? []).map((o) => o.Key).filter((k): k is string => typeof k === "string");
    if (claves.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucketR2Privado(), Delete: { Objects: claves.map((Key) => ({ Key })), Quiet: true } }));
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
  } while (token);
}
