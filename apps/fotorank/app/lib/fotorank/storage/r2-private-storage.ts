/**
 * Provider R2 (S3-compatible) para originales/derivados privados.
 * No se activa sin credenciales. No loguea secrets.
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PrivateContestStorageProvider } from "./contest-entry-storage";

export type R2PrivateStorageConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
  keyPrefix: string;
  signedUrlTtlSeconds: number;
};

export function readR2PrivateStorageConfig(): R2PrivateStorageConfig | null {
  const accountId = process.env.FOTORANK_R2_ACCOUNT_ID?.trim() || process.env.R2_ACCOUNT_ID?.trim() || "";
  const accessKeyId =
    process.env.FOTORANK_R2_ACCESS_KEY_ID?.trim() || process.env.R2_ACCESS_KEY_ID?.trim() || "";
  const secretAccessKey =
    process.env.FOTORANK_R2_SECRET_ACCESS_KEY?.trim() || process.env.R2_SECRET_ACCESS_KEY?.trim() || "";
  const bucket =
    process.env.FOTORANK_R2_BUCKET?.trim() ||
    process.env.FOTORANK_PRIVATE_BUCKET?.trim() ||
    process.env.R2_BUCKET_NAME?.trim() ||
    "";
  const endpoint =
    process.env.FOTORANK_R2_ENDPOINT?.trim() ||
    process.env.R2_ENDPOINT?.trim() ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) return null;

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region: process.env.FOTORANK_R2_REGION?.trim() || "auto",
    keyPrefix: (process.env.FOTORANK_R2_KEY_PREFIX?.trim() || "fotorank").replace(/\/+$/, ""),
    signedUrlTtlSeconds: Math.max(
      60,
      Number(process.env.FOTORANK_R2_SIGNED_URL_TTL_SECONDS ?? 600) || 600,
    ),
  };
}

export function isR2PrivateStorageConfigured(): boolean {
  return readR2PrivateStorageConfig() != null;
}

export function createR2PrivateContestStorageProvider(): PrivateContestStorageProvider | null {
  const cfg = readR2PrivateStorageConfig();
  if (!cfg) return null;

  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: true,
  });

  const withTimeout = async <T>(fn: () => Promise<T>, ms = 15_000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        fn(),
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error("R2 timeout")), ms);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  return {
    providerName: "r2",
    bucket: cfg.bucket,
    isPrivate: true,
    async putObject(key, body, contentType) {
      await withTimeout(() =>
        client.send(
          new PutObjectCommand({
            Bucket: cfg.bucket,
            Key: key,
            Body: Buffer.from(body),
            ContentType: contentType,
          }),
        ),
      );
    },
    async getSignedUrl(key, purpose, expiresInSeconds) {
      const exp = Math.min(Math.max(1, expiresInSeconds), cfg.signedUrlTtlSeconds);
      if (purpose === "write") {
        return getSignedUrl(
          client,
          new PutObjectCommand({ Bucket: cfg.bucket, Key: key }),
          { expiresIn: exp },
        );
      }
      // Lectura: preferimos proxy app firmado local (auth por rol). Fallback: signed GET R2.
      if (process.env.FOTORANK_R2_DIRECT_SIGNED_READ === "1") {
        return getSignedUrl(
          client,
          new GetObjectCommand({
            Bucket: cfg.bucket,
            Key: key,
            ResponseCacheControl: "private, no-store",
            ResponseContentDisposition: "inline",
          }),
          { expiresIn: exp },
        );
      }
      // Proxy vía route handler (mismo contrato que local).
      const { createHmac, randomBytes } = await import("node:crypto");
      const secret =
        process.env.FOTORANK_STORAGE_SIGNING_SECRET?.trim() ||
        process.env.AUTH_SECRET?.trim() ||
        "dev-only-fotorank-storage";
      const e = Math.floor(Date.now() / 1000) + exp;
      const nonce = randomBytes(8).toString("hex");
      const payload = `read:${key}:${e}:${nonce}`;
      const sig = createHmac("sha256", secret).update(payload).digest("hex");
      return `/api/fotorank/private-asset?k=${encodeURIComponent(key)}&p=read&e=${e}&n=${nonce}&s=${sig}`;
    },
    async deleteObject(key) {
      await withTimeout(() =>
        client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key })),
      );
    },
    async headObject(key) {
      try {
        const res = await withTimeout(() =>
          client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key })),
        );
        return {
          exists: true,
          contentType: res.ContentType,
          contentLength: res.ContentLength,
        };
      } catch {
        return { exists: false };
      }
    },
    async objectExists(key) {
      const head = await this.headObject!(key);
      return head.exists;
    },
    async createUploadIntent(input) {
      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: input.key,
          ContentType: input.contentType,
        }),
        { expiresIn: Math.max(60, input.expiresInSeconds) },
      );
      return { uploadUrl: url, method: "PUT", headers: { "Content-Type": input.contentType } };
    },
    async readObject(key) {
      const res = await withTimeout(() =>
        client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key })),
      );
      const bytes = await res.Body?.transformToByteArray();
      if (!bytes) throw new Error("Empty R2 object");
      return bytes;
    },
  };
}

/** Selfcheck de configuración (sin subir objetos). */
export function r2PrivateStorageConfigSelfcheck(): {
  ok: boolean;
  configured: boolean;
  missing: string[];
  bucket?: string;
  endpointHost?: string;
} {
  const missing: string[] = [];
  if (!(process.env.FOTORANK_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID)) missing.push("FOTORANK_R2_ACCOUNT_ID");
  if (!(process.env.FOTORANK_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID)) missing.push("FOTORANK_R2_ACCESS_KEY_ID");
  if (!(process.env.FOTORANK_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY)) {
    missing.push("FOTORANK_R2_SECRET_ACCESS_KEY");
  }
  if (!(process.env.FOTORANK_R2_BUCKET || process.env.FOTORANK_PRIVATE_BUCKET || process.env.R2_BUCKET_NAME)) {
    missing.push("FOTORANK_R2_BUCKET");
  }
  const cfg = readR2PrivateStorageConfig();
  return {
    ok: missing.length === 0,
    configured: cfg != null,
    missing,
    bucket: cfg?.bucket,
    endpointHost: cfg ? new URL(cfg.endpoint).host : undefined,
  };
}
