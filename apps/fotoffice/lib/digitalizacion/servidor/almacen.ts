import "server-only";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { MAX_BYTES_PARTE } from "../constants";
import { esClaveDeParte } from "../claves";
import { NOMBRE_PLAYLIST, reescribirPlaylist } from "../hls";

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

/** Las firmas de los segmentos HLS: una sesión larga de mirar, pero no un enlace para guardar. */
export const SEGUNDOS_HLS = 4 * 3600;

/**
 * La playlist de la versión para mirar, con cada segmento como URL firmada (GET, `segundos`, sin
 * pasar de 4 h). Se guarda 5 min en una caché por carpeta (ver abajo). null si no existe o no
 * es una VOD terminada con sólo segmentos nuestros. Quien llama ya validó que `hlsKey` es de la
 * grabación (`esPrefijoHlsDe`).
 */
export async function playlistHlsFirmada(hlsKey: string, segundos: number = SEGUNDOS_HLS): Promise<string | null> {
  if (!REGEX_PREFIJO_HLS.test(hlsKey) || hlsKey.endsWith("/")) throw new Error("Prefijo HLS no válido");
  const expiresIn = Math.min(Math.max(60, Math.trunc(segundos)), SEGUNDOS_HLS);
  const creada = Date.now();
  const enCache = deCache(hlsKey, creada, expiresIn);
  if (enCache) return enCache;
  const s3 = clienteR2Privado();
  const Bucket = bucketR2Privado();
  let texto: string;
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket, Key: `${hlsKey}/${NOMBRE_PLAYLIST}` }));
    if (!r.Body) return null;
    texto = await r.Body.transformToString("utf-8");
  } catch (e) {
    if (esNoEncontrado(e)) return null;
    throw e;
  }
  // La firma es local (HMAC): se arma cada URL sin ir a R2. Primero se valida todo y después se firma.
  const segmentos: string[] = [];
  if (reescribirPlaylist(texto, (seg) => (segmentos.push(seg), seg)) === null) return null;
  const firmadas = new Map<string, string>();
  await Promise.all(
    segmentos.map(async (seg) => {
      firmadas.set(seg, await getSignedUrl(s3, new GetObjectCommand({ Bucket, Key: `${hlsKey}/${seg}` }), { expiresIn }));
    }),
  );
  const firmada = reescribirPlaylist(texto, (seg) => firmadas.get(seg)!);
  if (firmada) guardarEnCache(hlsKey, firmada, creada, expiresIn);
  return firmada;
}

/*
 * Caché corta de playlists firmadas: un reproductor pide la playlist al abrir, al recargar y al
 * reintentar; una cinta de 4 h son 2400 firmas. Es por carpeta del intento (`hlsKey`) y sólo se
 * reusa si las firmas guardadas vencen dentro de lo pedido (nunca después) y no más de 5 min
 * antes. La autorización se chequea siempre antes de llamar: la caché no la reemplaza.
 */
const CACHE_HLS_MS = 5 * 60_000;
const CACHE_HLS_MAX = 200;
const cacheHls = new Map<string, { texto: string; creada: number; vence: number }>();

function deCache(hlsKey: string, ahora: number, expiresIn: number): string | null {
  const c = cacheHls.get(hlsKey);
  if (!c) return null;
  if (ahora - c.creada >= CACHE_HLS_MS) {
    cacheHls.delete(hlsKey);
    return null;
  }
  const queda = c.vence - ahora;
  const pedido = expiresIn * 1000;
  return queda <= pedido && queda >= pedido - CACHE_HLS_MS ? c.texto : null;
}

function guardarEnCache(hlsKey: string, texto: string, creada: number, expiresIn: number): void {
  cacheHls.delete(hlsKey);
  cacheHls.set(hlsKey, { texto, creada, vence: creada + expiresIn * 1000 });
  // Se descarta la más vieja (Map conserva el orden de inserción).
  while (cacheHls.size > CACHE_HLS_MAX) cacheHls.delete(cacheHls.keys().next().value!);
}

/** Sólo para pruebas. */
export function limpiarCacheHls(): void {
  cacheHls.clear();
}

/**
 * Al vencer la entrega (E8): borra el MP4 final y SIEMPRE todas las carpetas `hls*` de la
 * grabación (`hls`, `hls-<intento>`…), haya `hlsKey` o no: un relleno cortado puede haber dejado
 * restos. Lanza si R2 falla, así quien llama no marca nada como borrado y lo reintenta en la
 * próxima corrida. Borrar algo que ya no está no falla.
 */
export async function borrarVideoFinal(prefijoGrabacion: string, videoKey: string | null): Promise<void> {
  if (!/^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/$/.test(prefijoGrabacion)) throw new Error("Prefijo no válido");
  if (videoKey) {
    if (!REGEX_CLAVE_VIDEO.test(videoKey) || !videoKey.startsWith(prefijoGrabacion)) throw new Error("Clave no válida");
    await clienteR2Privado().send(new DeleteObjectCommand({ Bucket: bucketR2Privado(), Key: videoKey }));
  }
  await borrarTodoBajo(`${prefijoGrabacion}hls`);
}
