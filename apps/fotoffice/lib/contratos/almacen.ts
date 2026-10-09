import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Bucket PRIVADO de los contratos (`R2_PRIVATE_BUCKET`, el mismo de los adjuntos de la ficha, con otro
 * prefijo: `contratos/…`). Sin dominio público: lo único que lee un objeto es un enlace firmado que
 * vence. Nunca se usa acá el bucket público de imágenes.
 */
const CLAVE_VALIDA = /^contratos\/[A-Za-z0-9_-]{1,100}\/[A-Za-z0-9_.\-/]{1,200}$/;
export const SEGUNDOS_ENLACE_CONTRATO = 300;

let cliente: S3Client | null = null;

export function almacenContratosConfigurado(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT && process.env.R2_PRIVATE_BUCKET,
  );
}

export function esClaveDeContrato(clave: unknown): clave is string {
  return typeof clave === "string" && CLAVE_VALIDA.test(clave) && !clave.includes("..") && !clave.includes("//");
}

function claveSegura(clave: string): string {
  if (!esClaveDeContrato(clave)) throw new Error("Clave de contrato inválida");
  return clave;
}

function s3(): { c: S3Client; bucket: string } {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_PRIVATE_BUCKET;
  if (!almacenContratosConfigurado() || !endpoint || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Almacén de contratos incompleto");
  cliente ??= new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return { c: cliente, bucket };
}

/** Sube un objeto al bucket privado. */
export async function subirObjetoContrato(clave: string, cuerpo: Uint8Array, tipo: string): Promise<void> {
  const { c, bucket } = s3();
  await c.send(new PutObjectCommand({ Bucket: bucket, Key: claveSegura(clave), Body: cuerpo, ContentType: tipo, ContentLength: cuerpo.byteLength }));
}

/** Lee un objeto del bucket privado y devuelve sus bytes (la firma dibujada, el PDF). Lanza si no está. */
export async function leerObjetoContrato(clave: string): Promise<Uint8Array> {
  const { c, bucket } = s3();
  const r = await c.send(new GetObjectCommand({ Bucket: bucket, Key: claveSegura(clave) }));
  if (!r.Body) throw new Error("Objeto vacío");
  return r.Body.transformToByteArray();
}

/** GET firmado de corta vida, para mostrar una imagen o bajar un archivo desde el servidor. */
export async function urlDeLecturaContrato(clave: string): Promise<string> {
  const { c, bucket } = s3();
  return getSignedUrl(c, new GetObjectCommand({ Bucket: bucket, Key: claveSegura(clave) }), { expiresIn: SEGUNDOS_ENLACE_CONTRATO });
}

/** Idempotente: borrar algo que ya no está no es un error. */
export async function borrarObjetoContrato(clave: string): Promise<void> {
  const { c, bucket } = s3();
  try {
    await c.send(new DeleteObjectCommand({ Bucket: bucket, Key: claveSegura(clave) }));
  } catch (err) {
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
    if (e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404) return;
    throw err;
  }
}
