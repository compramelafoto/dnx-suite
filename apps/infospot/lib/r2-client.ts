/**
 * Cliente R2 mínimo para Info Spot (mismo bucket/env que ComprameLaFoto).
 * No importamos desde apps/compramelafoto — apps no se acoplan entre sí.
 */
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getPublicUrl } from "@/lib/r2-public-url";

let s3Client: S3Client | null = null;

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME o R2_BUCKET debe estar configurado");
  }
  return bucketName;
}

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;

  if (!accountId || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "R2 incompleto. Requiere: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME",
    );
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3Client;
}

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET),
  );
}

export function generateR2Key(originalName: string, prefix: string): string {
  const hasExtension = originalName.includes(".");
  const ext = hasExtension ? originalName.substring(originalName.lastIndexOf(".")) : "";
  const nameWithoutExt = hasExtension
    ? originalName.substring(0, originalName.lastIndexOf("."))
    : originalName;
  const sanitizedName = nameWithoutExt
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 100);
  const cleanPrefix = prefix.replace(/\/+$/, "");
  return `${cleanPrefix}/${randomUUID()}-${sanitizedName}${ext}`;
}

export async function uploadToR2(
  buffer: Buffer,
  key: string,
  contentType: string,
  metadata?: Record<string, string>,
): Promise<{ key: string; url: string }> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
    }),
  );
  return { key, url: getPublicUrl(key) };
}
