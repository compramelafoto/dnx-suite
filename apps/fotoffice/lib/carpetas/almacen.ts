import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { MAX_BYTES_ARCHIVO } from "./reglas";

/** La subida de un archivo grande (un VHS de 4 GB) tarda: la firma dura una hora. */
const SEGUNDOS_SUBIDA = 3600;
/** Una descarga o un video que se mira: la firma dura dos horas. */
const SEGUNDOS_LECTURA = 7200;

export async function urlDeSubidaArchivo(clave: string, tipo: string, bytes: number): Promise<string> {
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES_ARCHIVO) throw new Error("Tamaño no permitido");
  const cmd = new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ContentType: tipo, ContentLength: bytes });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_SUBIDA, signableHeaders: new Set(["content-type", "content-length"]) });
}

function nombreParaCabecera(nombre: string): string {
  return encodeURIComponent(nombre).replace(/['()]/g, escape).replace(/\*/g, "%2A");
}

/** Para descargar (attachment) o para mirar en la página (inline, los videos). */
export async function urlDeLecturaArchivo(clave: string, nombre: string, modo: "descargar" | "ver"): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucketR2Privado(),
    Key: clave,
    ResponseContentDisposition: `${modo === "descargar" ? "attachment" : "inline"}; filename*=UTF-8''${nombreParaCabecera(nombre)}`,
  });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_LECTURA });
}

export async function tamanoDeArchivo(clave: string): Promise<number | null> {
  try {
    const r = await clienteR2Privado().send(new HeadObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch (e) {
    if (esNoEncontrado(e)) return null;
    throw e;
  }
}

export async function borrarArchivoGuardado(clave: string): Promise<void> {
  try {
    await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
  } catch (e) {
    if (!esNoEncontrado(e)) throw e;
  }
}
