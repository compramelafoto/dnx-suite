import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Bucket R2 de FOTOFFICE, bajo el prefijo `muestras/`. Mismas variables que
 * `apps/fotoffice/lib/images/r2-client.ts`.
 */
function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const publicUrl = (process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  const endpoint = process.env.R2_ENDPOINT || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) {
    throw new Error("Falta configurar el almacenamiento de imágenes (R2).");
  }
  return { accessKeyId, secretAccessKey, bucket, publicUrl, endpoint };
}

let cliente: S3Client | null = null;

export async function subirAR2(bytes: Buffer, clave: string, contentType: string): Promise<string> {
  const c = config();
  cliente ??= new S3Client({
    region: "auto",
    endpoint: c.endpoint,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
  await cliente.send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: clave,
      Body: bytes,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${c.publicUrl}/${clave}`;
}
