import { randomUUID } from "node:crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Archivos privados del portal (comprobantes de compra y fotos de equipos) en Cloudflare R2.
 * Adaptado de `apps/compramelafoto/lib/r2-client.ts` y `lib/stolen-gear/files.ts`.
 * Nada se publica: sólo se muestran con URL firmada y de corta vida, generada para el dueño.
 */

/** Vercel corta los cuerpos de más de 4,5 MB: dejamos margen (igual que CLF). */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTOS_PER_ITEM = 6;
export const KEY_PREFIX = "equipos/";

const PROOF_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const PHOTO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type FileKind = "proof" | "photo";

/** Devuelve el mensaje de error (en español) o null si el archivo es válido. */
export function validateFile(file: { type: string; size: number }, kind: FileKind): string | null {
  const table = kind === "proof" ? PROOF_EXT : PHOTO_EXT;
  if (!(file.type in table)) {
    return kind === "proof"
      ? "Formato no permitido. Usá JPG, PNG, WEBP o PDF."
      : "Formato no permitido. Usá JPG, PNG o WEBP.";
  }
  if (file.size > MAX_FILE_BYTES) return "El archivo pesa más de 4 MB.";
  if (file.size === 0) return "El archivo está vacío.";
  return null;
}

let s3: S3Client | null = null;

function bucketName(): string {
  const b = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!b) throw new Error("R2_BUCKET_NAME o R2_BUCKET debe estar configurado");
  return b;
}

function getClient(): S3Client {
  if (s3) return s3;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "Falta configurar R2: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT",
    );
  }
  s3 = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return s3;
}

/** Valida y sube el archivo con un nombre aleatorio (sin datos de la persona). */
export async function uploadPrivateFile(
  file: File,
  kind: FileKind,
): Promise<{ key: string; mime: string }> {
  const error = validateFile(file, kind);
  if (error) throw new Error(error);
  const ext = (kind === "proof" ? PROOF_EXT : PHOTO_EXT)[file.type];
  const key = `${KEY_PREFIX}${randomUUID()}.${ext}`;
  const body = Buffer.from(await file.arrayBuffer());
  await getClient().send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: body, ContentType: file.type }),
  );
  return { key, mime: file.type };
}

/** URL firmada de lectura (15 minutos por defecto). Sólo para claves propias del portal. */
export async function getSignedFileUrl(key: string, expiresIn = 900): Promise<string> {
  if (!key.startsWith(KEY_PREFIX)) throw new Error("Clave de archivo inválida");
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: bucketName(), Key: key }), {
    expiresIn,
  });
}
