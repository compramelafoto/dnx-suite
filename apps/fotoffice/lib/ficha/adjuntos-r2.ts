import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  SEGUNDOS_ENLACE,
  SEGUNDOS_SUBIDA,
  esClaveDeAdjunto,
  esTamanoValido,
  esTipoPermitido,
  limpiarNombre,
} from "./adjuntos-reglas";

/**
 * Bucket PRIVADO de los adjuntos de la ficha. Mismas credenciales R2 que el resto de
 * FOTOFFICE, pero otro bucket (`R2_PRIVATE_BUCKET`), sin dominio público: lo único que
 * permite leer o escribir un objeto es un enlace firmado que vence.
 * Nunca se usa acá `R2_BUCKET_NAME` / `R2_BUCKET` (el bucket público de imágenes).
 */

let cliente: S3Client | null = null;

export function adjuntosR2Configurado(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      process.env.R2_PRIVATE_BUCKET,
  );
}

function bucket(): string {
  const b = process.env.R2_PRIVATE_BUCKET;
  if (!b) throw new Error("R2_PRIVATE_BUCKET no está configurado");
  return b;
}

function s3(): S3Client {
  if (cliente) return cliente;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!adjuntosR2Configurado() || !endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Adjuntos R2 incompleto");
  }
  cliente = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return cliente;
}

function claveSegura(clave: string): string {
  if (!esClaveDeAdjunto(clave)) throw new Error("Clave de adjunto inválida");
  return clave;
}

/** RFC 5987: además de lo que codifica encodeURIComponent, ' ( ) * ! no pueden ir sueltos. */
function codificarNombre(nombre: string): string {
  return encodeURIComponent(limpiarNombre(nombre)).replace(
    /['()*!]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

/**
 * PUT firmado por 600 s. Tipo y tamaño quedan dentro de la firma: si el navegador manda
 * otro Content-Type u otro Content-Length, R2 rechaza la subida.
 */
export async function urlDeSubida(clave: string, tipo: string, tamano: number): Promise<string> {
  if (!esTipoPermitido(tipo)) throw new Error("Tipo de adjunto no permitido");
  if (!esTamanoValido(tamano)) throw new Error("Tamaño de adjunto no permitido");
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: claveSegura(clave),
    ContentType: tipo,
    ContentLength: tamano,
  });
  return getSignedUrl(s3(), cmd, {
    expiresIn: SEGUNDOS_SUBIDA,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
}

/** GET firmado por 300 s; siempre como descarga, nunca para mostrar en el navegador. */
export async function urlDeDescarga(clave: string, nombre: string): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: claveSegura(clave),
    ResponseContentDisposition: `attachment; filename*=UTF-8''${codificarNombre(nombre)}`,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: SEGUNDOS_ENLACE });
}

function esNoEncontrado(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const code = e.name || e.Code || "";
  if (code === "NotFound" || code === "NoSuchKey") return true;
  return e.$metadata?.httpStatusCode === 404;
}

/** Tamaño del objeto subido, o null si no existe. */
export async function tamanoReal(clave: string): Promise<number | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: claveSegura(clave) }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch (err) {
    if (esNoEncontrado(err)) return null;
    throw err;
  }
}

/** Idempotente: borrar algo que ya no está no es un error. */
export async function borrarObjeto(clave: string): Promise<void> {
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: claveSegura(clave) }));
  } catch (err) {
    if (esNoEncontrado(err)) return;
    throw err;
  }
}
