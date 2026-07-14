/**
 * Config y helpers de lectura del bucket/CDN comercial CLF.
 * Sin dependencias de S3 ni aliases Next (testeable con tsx).
 */
import { assertSafeR2Key } from "./r2-key-policy";

export function getClfR2BucketName(): string | null {
  const bucket = process.env.CLF_R2_BUCKET_NAME || process.env.CLF_R2_BUCKET;
  return bucket?.trim() || null;
}

export function getClfR2PublicBaseUrl(): string | null {
  const raw =
    process.env.CLF_R2_PUBLIC_URL ||
    process.env.CLF_R2_PUBLIC_BASE_URL ||
    process.env.COMPRAMELAFOTO_R2_PUBLIC_URL;
  const trimmed = raw?.trim().replace(/\/+$/, "") || "";
  return trimmed || null;
}

export function isClfR2ReadConfigured(): boolean {
  return Boolean(getClfR2BucketName() || getClfR2PublicBaseUrl());
}

/** Construye URL pública allowlisted para una key CLF (sin fetch). */
export function buildClfPublicObjectUrl(key: string): string {
  const base = getClfR2PublicBaseUrl();
  if (!base) throw new Error("CLF_R2_PUBLIC_URL no configurada");
  const safeKey = assertSafeR2Key(key);
  return `${base}/${safeKey}`;
}

export function isInfoSpotR2EnvConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_ENDPOINT &&
      (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET),
  );
}
