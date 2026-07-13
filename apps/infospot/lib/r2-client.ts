/**
 * Cliente R2 mínimo para Info Spot (mismo bucket/env que ComprameLaFoto).
 * No importamos desde apps/compramelafoto — apps no se acoplan entre sí.
 *
 * Delete: solo keys del namespace Info Spot (`assertInfoSpotDeletableR2Key`).
 * Nunca borrar originales comerciales CLF.
 */
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getPublicUrl } from "@/lib/r2-public-url";
import { assertInfoSpotDeletableR2Key } from "@/lib/r2-key-policy";

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

export type DeleteR2ObjectResult =
  | {
      ok: true;
      key: string;
      /** true si existía antes del DeleteObject (via HeadObject). */
      existedBefore: boolean;
      /** Siempre true tras DeleteObject exitoso (idempotente en S3/R2). */
      deleted: true;
    }
  | {
      ok: false;
      key: string;
      error: string;
      code: "NOT_CONFIGURED" | "FORBIDDEN_NAMESPACE" | "INVALID_KEY" | "R2_ERROR";
    };

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const code = e.name || e.Code || "";
  if (code === "NotFound" || code === "NoSuchKey" || code === "404") return true;
  return e.$metadata?.httpStatusCode === 404;
}

/**
 * HeadObject: existencia de una key del namespace Info Spot.
 * Alias canónico: `r2ObjectExists`.
 */
export async function r2ObjectExists(key: string): Promise<boolean> {
  if (!isR2Configured()) {
    throw new Error("R2 no configurado");
  }
  const safeKey = assertInfoSpotDeletableR2Key(key);
  try {
    await getS3Client().send(
      new HeadObjectCommand({
        Bucket: getBucketName(),
        Key: safeKey,
      }),
    );
    return true;
  } catch (err) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

/** @deprecated Usar `r2ObjectExists`. */
export const headInfoSpotR2Object = r2ObjectExists;

/**
 * Borra un objeto R2 del namespace Info Spot.
 * Idempotente: si la key no existe, `ok: true` con `existedBefore: false`.
 */
export async function deleteR2Object(key: string): Promise<DeleteR2ObjectResult> {
  if (!isR2Configured()) {
    return {
      ok: false,
      key,
      error: "R2 no configurado",
      code: "NOT_CONFIGURED",
    };
  }

  let safeKey: string;
  try {
    safeKey = assertInfoSpotDeletableR2Key(key);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Key R2 inválida";
    const code = message.includes("namespace") ? "FORBIDDEN_NAMESPACE" : "INVALID_KEY";
    return { ok: false, key, error: message, code };
  }

  let existedBefore = false;
  try {
    existedBefore = await r2ObjectExists(safeKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error HeadObject R2";
    return { ok: false, key: safeKey, error: message, code: "R2_ERROR" };
  }

  try {
    await getS3Client().send(
      new DeleteObjectCommand({
        Bucket: getBucketName(),
        Key: safeKey,
      }),
    );
    return { ok: true, key: safeKey, existedBefore, deleted: true };
  } catch (err) {
    // DeleteObject en S3/R2 es idempotente; NotFound no debería ocurrir, pero lo toleramos.
    if (isNotFoundError(err)) {
      return { ok: true, key: safeKey, existedBefore: false, deleted: true };
    }
    const message = err instanceof Error ? err.message : "Error DeleteObject R2";
    return { ok: false, key: safeKey, error: message, code: "R2_ERROR" };
  }
}
