/**
 * Lectura R2 (solo keys internas). No acepta URLs arbitrarias (anti-SSRF).
 *
 * - Keys propias Info Spot (`infospot/…`) → bucket `R2_BUCKET_NAME` (infospot-media).
 * - Keys comerciales CLF (`albums/…`, `photo-variants/…`, etc.) → bucket CLF
 *   (`CLF_R2_BUCKET_NAME`) y/o CDN público (`CLF_R2_PUBLIC_URL`).
 */
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  buildClfPublicObjectUrl,
  getClfR2BucketName,
  getClfR2PublicBaseUrl,
  isClfR2ReadConfigured,
  isInfoSpotR2EnvConfigured,
} from "./r2-clf-config";
import { assertSafeR2Key, isInfoSpotOwnedR2Key } from "./r2-key-policy";
import { urlToR2Key } from "./editorial-photo-previews/url-to-r2-key";

export { assertSafeR2Key } from "./r2-key-policy";
export {
  buildClfPublicObjectUrl,
  getClfR2BucketName,
  getClfR2PublicBaseUrl,
  isClfR2ReadConfigured,
} from "./r2-clf-config";

let infoSpotS3Client: S3Client | null = null;
let clfS3Client: S3Client | null = null;

function getInfoSpotBucketName(): string {
  const bucketName = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  if (!bucketName) throw new Error("R2_BUCKET_NAME o R2_BUCKET requerido");
  return bucketName;
}

function createS3Client(credentials: {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
}): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: credentials.endpoint,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
  });
}

function getInfoSpotS3Client(): S3Client {
  if (infoSpotS3Client) return infoSpotS3Client;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 incompleto para lectura");
  }
  infoSpotS3Client = createS3Client({ endpoint, accessKeyId, secretAccessKey });
  return infoSpotS3Client;
}

function getClfS3Client(): S3Client {
  if (clfS3Client) return clfS3Client;
  const endpoint = process.env.CLF_R2_ENDPOINT || process.env.R2_ENDPOINT;
  const accessKeyId =
    process.env.CLF_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey =
    process.env.CLF_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 incompleto para lectura CLF");
  }
  clfS3Client = createS3Client({ endpoint, accessKeyId, secretAccessKey });
  return clfS3Client;
}

async function getObjectBuffer(params: {
  client: S3Client;
  bucket: string;
  key: string;
}): Promise<Buffer> {
  const res = await params.client.send(
    new GetObjectCommand({ Bucket: params.bucket, Key: params.key }),
  );
  if (!res.Body) throw new Error("Objeto R2 vacío");
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Fetch HTTPS solo hacia el host de `CLF_R2_PUBLIC_URL` (anti-SSRF).
 */
export async function fetchClfPublicObjectBuffer(key: string): Promise<Buffer> {
  const base = getClfR2PublicBaseUrl();
  if (!base) throw new Error("CLF_R2_PUBLIC_URL no configurada");

  let allowedHost: string;
  try {
    allowedHost = new URL(base).hostname;
  } catch {
    throw new Error("CLF_R2_PUBLIC_URL inválida");
  }
  if (!allowedHost) throw new Error("CLF_R2_PUBLIC_URL sin host");

  const url = buildClfPublicObjectUrl(key);
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") {
    throw new Error("Solo se permite HTTPS para lectura pública CLF");
  }
  if (parsed.hostname !== allowedHost) {
    throw new Error("Host público CLF no permitido");
  }

  const res = await fetch(url, {
    method: "GET",
    redirect: "error",
    headers: { Accept: "image/*,*/*" },
  });
  if (!res.ok) {
    throw new Error(`CDN CLF respondió ${res.status}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error("Objeto público CLF vacío");
  return bytes;
}

async function readClfSourceObjectBuffer(safeKey: string): Promise<Buffer> {
  const clfBucket = getClfR2BucketName();
  if (clfBucket && isInfoSpotR2EnvConfigured()) {
    try {
      return await getObjectBuffer({
        client: getClfS3Client(),
        bucket: clfBucket,
        key: safeKey,
      });
    } catch {
      // Token scoped solo a infospot-media → caer a CDN público.
    }
  }

  if (getClfR2PublicBaseUrl()) {
    return fetchClfPublicObjectBuffer(safeKey);
  }

  // Legacy: bucket compartido (misma R2_BUCKET_NAME que CLF).
  if (isInfoSpotR2EnvConfigured()) {
    try {
      return await getObjectBuffer({
        client: getInfoSpotS3Client(),
        bucket: getInfoSpotBucketName(),
        key: safeKey,
      });
    } catch {
      // continuar
    }
  }

  throw new Error(
    "CLF R2 no configurado: falta CLF_R2_BUCKET_NAME o CLF_R2_PUBLIC_URL",
  );
}

/**
 * Lee un objeto R2. Enruta automáticamente al bucket Info Spot o al origen CLF.
 */
export async function readR2ObjectBuffer(key: string): Promise<Buffer> {
  const safeKey = assertSafeR2Key(key);

  if (isInfoSpotOwnedR2Key(safeKey)) {
    if (!isInfoSpotR2EnvConfigured()) {
      throw new Error("R2 no configurado: no se puede leer media Info Spot");
    }
    return getObjectBuffer({
      client: getInfoSpotS3Client(),
      bucket: getInfoSpotBucketName(),
      key: safeKey,
    });
  }

  if (!isClfR2ReadConfigured() && !isInfoSpotR2EnvConfigured()) {
    throw new Error("R2 no configurado: no se puede importar fotografía CLF");
  }
  return readClfSourceObjectBuffer(safeKey);
}

/**
 * Resuelve key interna desde campos Photo CLF.
 * Prioriza variantes watermarked/preview; si previewUrl es HTTPS pública del
 * CDN CLF, extrae la key (sin fetch externo aquí).
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
