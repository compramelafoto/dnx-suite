import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type StoredObject = { key: string; publicUrl: string | null; bytes: number; contentHash: string };

export interface StoragePort {
  put(input: { namespace: "welcome" | "profile"; extension: string; body: Buffer; contentType: string }): Promise<StoredObject>;
  get(key: string): Promise<Buffer>;
}

function safeExtension(extension: string) {
  return extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

function objectKey(namespace: "welcome" | "profile", extension: string) {
  return `clickaton/${namespace}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${safeExtension(extension)}`;
}

function stored(key: string, body: Buffer, publicUrl: string | null): StoredObject {
  return {
    key,
    publicUrl,
    bytes: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

export class MemoryStorage implements StoragePort {
  private readonly objects = new Map<string, Buffer>();
  async put(input: Parameters<StoragePort["put"]>[0]) {
    const key = objectKey(input.namespace, input.extension);
    this.objects.set(key, input.body);
    return stored(key, input.body, `/api/media/${key}`);
  }
  async get(key: string) {
    const body = this.objects.get(key);
    if (!body) throw new Error("MEDIA_NOT_FOUND");
    return body;
  }
}

export class LocalStorage implements StoragePort {
  constructor(private readonly baseDir = join(process.cwd(), "public", "uploads")) {}
  async put(input: Parameters<StoragePort["put"]>[0]) {
    const key = objectKey(input.namespace, input.extension);
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, input.body);
    return stored(key, input.body, `/${join("uploads", key).replaceAll("\\", "/")}`);
  }
  async get(key: string) {
    if (!key.startsWith("clickaton/")) throw new Error("INVALID_MEDIA_KEY");
    return readFile(join(this.baseDir, key));
  }
}

/**
 * Key-only storage for serverless (Vercel) sin R2.
 * El body durable via `metadata.inlineBase64` lo persiste `persistAsset` / lectores DB.
 */
export class KeyOnlyStorage implements StoragePort {
  async put(input: Parameters<StoragePort["put"]>[0]) {
    const key = objectKey(input.namespace, input.extension);
    return stored(key, input.body, null);
  }
  async get(_key: string): Promise<Buffer> {
    throw new Error("KEY_ONLY_STORAGE_GET_UNSUPPORTED");
  }
}

export function shouldInlineMediaInDb(): boolean {
  const hasR2 = Boolean(
    (process.env.R2_BUCKET_NAME || process.env.R2_BUCKET) &&
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
  if (hasR2) return false;
  return process.env.VERCEL === "1" || process.env.CLICKATON_MEDIA_INLINE_DB === "1";
}

export class R2Storage implements StoragePort {
  private readonly client: S3Client;
  constructor(
    private readonly config: { bucket: string; endpoint: string; accessKeyId: string; secretAccessKey: string; publicBaseUrl?: string },
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }
  async put(input: Parameters<StoragePort["put"]>[0]) {
    const key = objectKey(input.namespace, input.extension);
    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket, Key: key, Body: input.body, ContentType: input.contentType,
    }));
    const base = this.config.publicBaseUrl?.replace(/\/$/, "");
    return stored(key, input.body, base ? `${base}/${key}` : null);
  }
  async get(key: string) {
    if (!key.startsWith("clickaton/")) throw new Error("INVALID_MEDIA_KEY");
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    if (!response.Body) throw new Error("MEDIA_NOT_FOUND");
    return Buffer.from(await response.Body.transformToByteArray());
  }
}

export function getWelcomeCardStorage(): StoragePort {
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (bucket && endpoint && accessKeyId && secretAccessKey) {
    return new R2Storage({ bucket, endpoint, accessKeyId, secretAccessKey, publicBaseUrl: process.env.R2_PUBLIC_URL });
  }
  if (shouldInlineMediaInDb()) {
    return new KeyOnlyStorage();
  }
  return new LocalStorage();
}
