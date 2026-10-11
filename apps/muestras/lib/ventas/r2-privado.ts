import "server-only";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { credencialesDeVentas } from "./config";

/**
 * Bucket R2 **privado** de la venta (etapa 8, spec D17): originales, firmas escaneadas y lo que se
 * genera por pedido. Mismas llaves R2 que el bucket público de Muestras; otro bucket
 * (`MUESTRAS_R2_PRIVATE_BUCKET`). Se lee y se escribe sólo desde el servidor y se entrega por rutas
 * que validan el permiso: nada de acá tiene URL pública.
 *
 * Claves permitidas: `originales/<userId>/<id>`, `firmas/<userId>.png`, `ventas/<orderId>/…`.
 */
export const SUBIDA_VENCE_SEG = 10 * 60;

const CLAVE_RE = /^(originales|firmas|ventas)\/[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*$/;

export function claveDelBucketPrivado(clave: string): boolean {
  return CLAVE_RE.test(clave) && !clave.split("/").some((parte) => parte === "." || parte === "..");
}

function exigirClave(clave: string): void {
  if (!claveDelBucketPrivado(clave)) throw new Error("Clave fuera del bucket privado.");
}

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucket = credencialesDeVentas().privateBucket;
  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) throw new Error("Falta configurar el bucket privado de la venta (R2).");
  // Nunca el bucket público de Muestras: sus direcciones son públicas y no vencen (D17).
  if (bucket === bucketPublico()) throw new Error("El bucket privado de la venta no puede ser el bucket público de Muestras.");
  return { accessKeyId, secretAccessKey, endpoint, bucket };
}

/** El bucket público de Muestras (`lib/imagenes/r2.ts`). */
export function bucketPublico(): string | null {
  return (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || "").trim() || null;
}

let cliente: S3Client | null = null;

function s3(c: ReturnType<typeof config>): S3Client {
  cliente ??= new S3Client({ region: "auto", endpoint: c.endpoint, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
  return cliente;
}

const noExiste = (err: unknown) => {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
};

/**
 * URL firmada para subir directo al bucket con `PUT` (Vercel no acepta cuerpos de más de 4,5 MB).
 * Quedan firmados sólo `host` y `content-length` (el tamaño exacto declarado, ya validado contra el
 * tope): un archivo de otro tamaño no entra. El tipo (`Content-Type`) NO queda firmado: por eso
 * `confirmarOriginal` vuelve a medir el archivo con sharp y rechaza lo que no sea JPEG, PNG o TIFF.
 */
export async function urlDeSubida(clave: string, contentType: string, bytes: number): Promise<string> {
  exigirClave(clave);
  if (!Number.isInteger(bytes) || bytes <= 0) throw new Error("Tamaño inválido.");
  const c = config();
  return getSignedUrl(s3(c), new PutObjectCommand({ Bucket: c.bucket, Key: clave, ContentType: contentType, ContentLength: bytes }), {
    expiresIn: SUBIDA_VENCE_SEG,
  });
}

export async function subirPrivado(clave: string, bytes: Buffer | Uint8Array, contentType: string): Promise<void> {
  exigirClave(clave);
  const c = config();
  await s3(c).send(new PutObjectCommand({ Bucket: c.bucket, Key: clave, Body: bytes, ContentType: contentType, CacheControl: "private, no-store" }));
}

/**
 * El objeto entero en memoria, o `null` si no existe (o si pesa más de `maxBytes`). Otros errores se
 * registran y también dan `null`. Para entregar archivos grandes, `streamPrivado`.
 */
export async function leerPrivado(clave: string, { maxBytes = 100 * 1024 * 1024 }: { maxBytes?: number } = {}): Promise<Buffer | null> {
  exigirClave(clave);
  const c = config();
  try {
    const r = await s3(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: clave }));
    if (!r.Body) return null;
    if (r.ContentLength != null && r.ContentLength > maxBytes) {
      console.error("[muestras] R2 privado, lectura: el objeto supera el tope para leerlo en memoria");
      return null;
    }
    return Buffer.from(await r.Body.transformToByteArray());
  } catch (err) {
    if (!noExiste(err)) console.error("[muestras] R2 privado, lectura:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * El objeto como stream (sin cargarlo en memoria), para entregar descargas grandes desde una ruta
 * que ya validó el permiso. `null` si no existe.
 */
export async function streamPrivado(clave: string): Promise<{ stream: ReadableStream; bytes: number | null; contentType: string | null } | null> {
  exigirClave(clave);
  const c = config();
  try {
    const r = await s3(c).send(new GetObjectCommand({ Bucket: c.bucket, Key: clave }));
    if (!r.Body) return null;
    return { stream: r.Body.transformToWebStream(), bytes: r.ContentLength ?? null, contentType: r.ContentType ?? null };
  } catch (err) {
    if (!noExiste(err)) console.error("[muestras] R2 privado, stream:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Tamaño y tipo del objeto, o `null` si no existe. */
export async function existePrivado(clave: string): Promise<{ bytes: number; contentType: string | null } | null> {
  exigirClave(clave);
  const c = config();
  try {
    const r = await s3(c).send(new HeadObjectCommand({ Bucket: c.bucket, Key: clave }));
    return { bytes: r.ContentLength ?? 0, contentType: r.ContentType ?? null };
  } catch (err) {
    if (noExiste(err)) return null;
    throw err;
  }
}

/** Lanza si falla: quien llama decide si es a mejor esfuerzo. */
export async function borrarPrivado(clave: string): Promise<void> {
  exigirClave(clave);
  const c = config();
  await s3(c).send(new DeleteObjectCommand({ Bucket: c.bucket, Key: clave }));
}

/**
 * Objetos bajo un prefijo (`originales/`), con su fecha, hasta `max`. Para limpiar las subidas que
 * nunca se confirmaron (la URL firmada se pidió y el autor no terminó).
 */
export async function listarPrivado(prefijo: string, max = 500): Promise<{ clave: string; modificado: Date | null }[]> {
  if (!/^(originales|firmas|ventas)\/$/.test(prefijo)) throw new Error("Prefijo fuera del bucket privado.");
  const c = config();
  const out: { clave: string; modificado: Date | null }[] = [];
  let token: string | undefined;
  do {
    const r = await s3(c).send(new ListObjectsV2Command({ Bucket: c.bucket, Prefix: prefijo, ContinuationToken: token, MaxKeys: Math.min(1000, max - out.length) }));
    for (const o of r.Contents ?? []) if (o.Key) out.push({ clave: o.Key, modificado: o.LastModified ?? null });
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token && out.length < max);
  return out;
}
