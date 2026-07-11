/**
 * Lectura R2 (solo keys internas). No acepta URLs externas (anti-SSRF).
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isR2Configured } from "@/lib/r2-client";

let s3Client: S3Client | null = null;

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) throw new Error("R2_BUCKET_NAME o R2_BUCKET requerido");
  return bucketName;
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 incompleto para lectura");
  }
  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

/** Solo keys relativas del bucket (sin http/https, sin ..). */
export function assertSafeR2Key(key: string): string {
  const trimmed = key.trim().replace(/^\/+/, "");
  if (!trimmed) throw new Error("Key R2 vacía");
  if (/^https?:\/\//i.test(trimmed)) {
    throw new Error("No se permiten URLs externas como origen de importación");
  }
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    throw new Error("Key R2 inválida");
  }
  return trimmed;
}

export async function readR2ObjectBuffer(key: string): Promise<Buffer> {
  if (!isR2Configured()) {
    throw new Error("R2 no configurado: no se puede importar fotografía CLF");
  }
  const safeKey = assertSafeR2Key(key);
  const res = await getS3Client().send(
    new GetObjectCommand({ Bucket: getBucketName(), Key: safeKey }),
  );
  if (!res.Body) throw new Error("Objeto R2 vacío");
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Resuelve key interna desde campos Photo CLF.
 * Prioriza variantes watermarked/preview; nunca usa URL http arbitraria del cliente.
 */
export function resolveClfPhotoSourceKey(photo: {
  originalKey: string;
  previewUrl: string;
  previewWatermarkedKey: string | null;
  thumbWatermarkedKey: string | null;
}): string {
  if (photo.previewWatermarkedKey?.trim()) {
    return assertSafeR2Key(photo.previewWatermarkedKey);
  }
  if (photo.thumbWatermarkedKey?.trim()) {
    return assertSafeR2Key(photo.thumbWatermarkedKey);
  }
  if (photo.originalKey?.trim()) {
    return assertSafeR2Key(photo.originalKey);
  }
  // previewUrl a veces es key relativa; si es URL absoluta, rechazar (no fetch externo).
  if (photo.previewUrl?.trim() && !/^https?:\/\//i.test(photo.previewUrl)) {
    return assertSafeR2Key(photo.previewUrl);
  }
  throw new Error("La fotografía no tiene una key R2 interna utilizable");
}
