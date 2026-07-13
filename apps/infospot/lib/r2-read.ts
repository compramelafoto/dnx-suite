/**
 * Lectura R2 (solo keys internas). No acepta URLs externas (anti-SSRF).
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isR2Configured } from "@/lib/r2-client";
import { assertSafeR2Key } from "@/lib/r2-key-policy";
import { urlToR2Key } from "@/lib/editorial-photo-previews/url-to-r2-key";

export { assertSafeR2Key } from "@/lib/r2-key-policy";

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
 * Prioriza variantes watermarked/preview; si previewUrl es HTTPS pública del
 * mismo bucket R2, extrae la key (sin fetch externo).
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
  // previewUrl relativa = key; absoluta http(s) del CDN R2 → pathname.
  if (photo.previewUrl?.trim()) {
    try {
      return assertSafeR2Key(urlToR2Key(photo.previewUrl));
    } catch {
      // continuar a originalKey
    }
  }
  if (photo.originalKey?.trim()) {
    return assertSafeR2Key(photo.originalKey);
  }
  throw new Error("La fotografía no tiene una key R2 interna utilizable");
}
