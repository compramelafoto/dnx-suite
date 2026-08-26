/**
 * Cliente R2 de FotoOffice. Mismo bucket/env que otras apps del monorepo
 * (ver `apps/infospot/lib/r2-client.ts`) — no se crea storage nuevo, se
 * reutiliza el existente con namespace propio (`fotoffice/*`, ver
 * `r2-key-policy.ts`). Apps no se acoplan entre sí: este archivo es una
 * copia local intencional, no un import cruzado a InfoSpot.
 */
import { randomUUID } from "node:crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { assertFotofficeDeletableR2Key } from "./r2-key-policy";

let s3Client: S3Client | null = null;

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) throw new Error("R2_BUCKET_NAME o R2_BUCKET debe estar configurado");
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
  s3Client = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
  return s3Client;
}

export function isFotofficeR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET),
  );
}

export function getFotofficeR2PublicUrl(keyOrUrl: string): string {
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) return keyOrUrl;
  const key = keyOrUrl.replace(/^\//, "");
  const publicUrl = process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL;
  if (publicUrl) return `${publicUrl.replace(/\/$/, "")}/${key}`;
  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) throw new Error("R2_ENDPOINT o R2_PUBLIC_URL requerido para URLs públicas");
  return `${endpoint.replace(/\/$/, "")}/${getBucketName()}/${key}`;
}

export function generateFotofficeR2Key(originalName: string, prefix: string): string {
  const hasExtension = originalName.includes(".");
  const ext = hasExtension ? originalName.slice(originalName.lastIndexOf(".")) : "";
  return `${prefix.replace(/\/+$/, "")}/${randomUUID()}${ext}`;
}

export async function uploadToFotofficeR2(
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
  return { key, url: getFotofficeR2PublicUrl(key) };
}

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const code = e.name || e.Code || "";
  if (code === "NotFound" || code === "NoSuchKey" || code === "404") return true;
  return e.$metadata?.httpStatusCode === 404;
}

export async function fotofficeR2ObjectExists(key: string): Promise<boolean> {
  if (!isFotofficeR2Configured()) throw new Error("R2 no configurado");
  const safeKey = assertFotofficeDeletableR2Key(key);
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: getBucketName(), Key: safeKey }));
    return true;
  } catch (err) {
    if (isNotFoundError(err)) return false;
    throw err;
  }
}

export type DeleteFotofficeR2Result =
  | { ok: true; key: string; existedBefore: boolean; deleted: true }
  | { ok: false; key: string; error: string; code: "NOT_CONFIGURED" | "FORBIDDEN_NAMESPACE" | "INVALID_KEY" | "R2_ERROR" };

/** Idempotente: borrar una key que no existe también es `ok: true`. */
export async function deleteFotofficeR2Object(key: string): Promise<DeleteFotofficeR2Result> {
  if (!isFotofficeR2Configured()) {
    return { ok: false, key, error: "R2 no configurado", code: "NOT_CONFIGURED" };
  }
  let safeKey: string;
  try {
    safeKey = assertFotofficeDeletableR2Key(key);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Key R2 inválida";
    return { ok: false, key, error: message, code: "FORBIDDEN_NAMESPACE" };
  }
  let existedBefore = false;
  try {
    existedBefore = await fotofficeR2ObjectExists(safeKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error HeadObject R2";
    return { ok: false, key: safeKey, error: message, code: "R2_ERROR" };
  }
  try {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: safeKey }));
    return { ok: true, key: safeKey, existedBefore, deleted: true };
  } catch (err) {
    if (isNotFoundError(err)) return { ok: true, key: safeKey, existedBefore: false, deleted: true };
    const message = err instanceof Error ? err.message : "Error DeleteObject R2";
    return { ok: false, key: safeKey, error: message, code: "R2_ERROR" };
  }
}
