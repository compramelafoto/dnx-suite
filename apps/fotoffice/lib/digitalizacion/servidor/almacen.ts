import "server-only";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
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
  await borrarTodoBajo(prefijo);
}

async function borrarTodoBajo(prefijo: string): Promise<void> {
  const s3 = clienteR2Privado();
  let token: string | undefined;
  do {
    const lista = await s3.send(new ListObjectsV2Command({ Bucket: bucketR2Privado(), Prefix: prefijo, ContinuationToken: token }));
    const claves = (lista.Contents ?? []).map((o) => o.Key).filter((k): k is string => typeof k === "string");
    if (claves.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucketR2Privado(), Delete: { Objects: claves.map((Key) => ({ Key })), Quiet: true } }));
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
  } while (token);
}

/** Cintas largas se miran y retoman durante horas: la URL dura 24 h. */
const SEGUNDOS_VIDEO = 24 * 3600;
const REGEX_CLAVE_VIDEO = /^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/final\.mp4$/;

/** Para mirar desde la página pública de videos: firma corta, que no cuenta como descarga. */
export const SEGUNDOS_VER_PUBLICO = 3 * 3600;

/**
 * URL firmada del MP4 final, para mirarlo en la página (inline) o bajarlo (attachment). Por omisión
 * dura 24 h; la página pública de videos pide firmas más cortas para mirar.
 */
export async function urlDeVideo(clave: string, nombre: string, modo: "ver" | "descargar", segundos: number = SEGUNDOS_VIDEO): Promise<string> {
  if (!REGEX_CLAVE_VIDEO.test(clave)) throw new Error("Clave no válida");
  const seguro = encodeURIComponent(nombre).replace(/['()]/g, escape).replace(/\*/g, "%2A");
  const cmd = new GetObjectCommand({
    Bucket: bucketR2Privado(),
    Key: clave,
    ResponseContentType: "video/mp4",
    ResponseContentDisposition: `${modo === "descargar" ? "attachment" : "inline"}; filename*=UTF-8''${seguro}`,
  });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: Math.min(Math.max(60, Math.trunc(segundos)), SEGUNDOS_VIDEO) });
}

/**
 * HLS: `hlsKey` es un PREFIJO de carpeta sin barra final (`digitalizacion/<ws>/<grabacion>/hls`),
 * siempre dentro de la carpeta de la grabación; adentro van `index.m3u8` y los segmentos. Se borra
 * todo lo que hay bajo `<hlsKey>/`.
 */
const REGEX_PREFIJO_HLS = /^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/?$/;

/**
 * Al vencer la entrega (E8): borra el MP4 final y, si hay, la versión HLS. Lanza si R2 falla, así
 * quien llama no marca nada como borrado y lo reintenta en la próxima corrida. Borrar algo que ya
 * no está no es un error.
 */
export async function borrarVideoFinal(prefijoGrabacion: string, videoKey: string | null, hlsKey: string | null): Promise<void> {
  if (!/^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/$/.test(prefijoGrabacion)) throw new Error("Prefijo no válido");
  if (videoKey) {
    if (!REGEX_CLAVE_VIDEO.test(videoKey) || !videoKey.startsWith(prefijoGrabacion)) throw new Error("Clave no válida");
    await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: videoKey }));
  }
  if (hlsKey) {
    if (!REGEX_PREFIJO_HLS.test(hlsKey) || !hlsKey.startsWith(prefijoGrabacion)) throw new Error("Prefijo HLS no válido");
    await borrarTodoBajo(hlsKey.endsWith("/") ? hlsKey : `${hlsKey}/`);
  }
}
