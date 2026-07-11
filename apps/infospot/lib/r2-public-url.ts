/**
 * Helpers de URL pública R2 — mismos env vars que ComprameLaFoto.
 * Bucket compartido; prefijos Info Spot: `infospot/*`.
 */

function getBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME o R2_BUCKET debe estar configurado");
  }
  return bucketName;
}

export function getPublicUrl(keyOrUrl: string): string {
  if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
    return keyOrUrl;
  }

  const key = keyOrUrl.replace(/^\//, "");

  const publicUrl = process.env.R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL;
  if (publicUrl) {
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  }

  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) {
    throw new Error("R2_ENDPOINT o R2_PUBLIC_URL requerido para URLs públicas");
  }
  return `${endpoint.replace(/\/$/, "")}/${getBucketName()}/${key}`;
}

export function getR2PublicUrl(keyOrUrl: string): string {
  return getPublicUrl(keyOrUrl);
}
