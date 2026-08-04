/**
 * Almacenamiento de imágenes del blog Clickatón.
 *
 * Namespace propio (`clickaton/blog/hero|media`) para no interferir con el
 * storage de welcome-card / participant-cards. Reutiliza las mismas variables
 * de entorno de R2 y, sin R2 configurado, cae a disco local (`public/uploads`).
 *
 * El bucket es privado a propósito: sin `R2_PUBLIC_URL` las URLs públicas se
 * sirven same-origin por el proxy `/api/media/<key>`.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export type ClickatonBlogNamespace = "hero" | "media";

export const CLICKATON_BLOG_KEY_ROOT = "clickaton/blog";

export const BLOG_IMAGE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const BLOG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Claves válidas del blog: `clickaton/blog/<hero|media>/YYYY-MM-DD/<uuid>.<ext>`.
 * Debe mantenerse alineada con `PUBLIC_KEY` en `app/api/media/[...key]/route.ts`.
 */
export const CLICKATON_BLOG_KEY_PATTERN =
  /^clickaton\/blog\/(hero|media)\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i;

export function isClickatonBlogKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return CLICKATON_BLOG_KEY_PATTERN.test(key);
}

export function blogKeyPrefix(namespace: ClickatonBlogNamespace): string {
  return `${CLICKATON_BLOG_KEY_ROOT}/${namespace}`;
}

export function buildBlogObjectKey(
  namespace: ClickatonBlogNamespace,
  extension: string,
  now: Date = new Date(),
): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  const day = now.toISOString().slice(0, 10);
  return `${blogKeyPrefix(namespace)}/${day}/${randomUUID()}.${safeExtension}`;
}

export function extensionForMimeType(mimeType: string, filename?: string): string {
  const fromMime = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "jpg";
}

export function validateBlogImageFile(input: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  const type = (input.type || "").toLowerCase();
  if (!(BLOG_IMAGE_ALLOWED_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP" };
  }
  if (input.size > BLOG_IMAGE_MAX_BYTES) {
    return { ok: false, error: "La imagen no puede superar 5 MB" };
  }
  if (input.size <= 0) {
    return { ok: false, error: "El archivo está vacío" };
  }
  return { ok: true };
}

export type StoredBlogObject = {
  key: string;
  url: string;
  bytes: number;
  contentHash: string;
};

export type BlogStoragePort = {
  put(input: {
    namespace: ClickatonBlogNamespace;
    extension: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredBlogObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
};

function stored(key: string, body: Buffer, url: string): StoredBlogObject {
  return {
    key,
    url,
    bytes: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

function assertBlogKey(key: string): void {
  if (!isClickatonBlogKey(key)) {
    throw new Error("INVALID_BLOG_MEDIA_KEY");
  }
}

export class LocalBlogStorage implements BlogStoragePort {
  constructor(private readonly baseDir = join(process.cwd(), "public", "uploads")) {}

  async put(input: Parameters<BlogStoragePort["put"]>[0]) {
    const key = buildBlogObjectKey(input.namespace, input.extension);
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, input.body);
    return stored(key, input.body, `/uploads/${key}`);
  }

  async get(key: string) {
    assertBlogKey(key);
    return readFile(join(this.baseDir, key));
  }

  async delete(key: string) {
    assertBlogKey(key);
    await unlink(join(this.baseDir, key)).catch(() => undefined);
  }
}

export class R2BlogStorage implements BlogStoragePort {
  readonly backend = "R2" as const;
  private readonly client: S3Client;

  constructor(
    private readonly config: {
      bucket: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    },
  ) {
    this.client = new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async put(input: Parameters<BlogStoragePort["put"]>[0]) {
    const key = buildBlogObjectKey(input.namespace, input.extension);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    const base = this.config.publicBaseUrl?.replace(/\/$/, "");
    return stored(key, input.body, base ? `${base}/${key}` : `/api/media/${key}`);
  }

  async get(key: string) {
    assertBlogKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!response.Body) throw new Error("BLOG_MEDIA_NOT_FOUND");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string) {
    assertBlogKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}

export type BlogStorageEnv = Record<string, string | undefined>;

export function hasR2BlogStorage(env: BlogStorageEnv = process.env): boolean {
  return Boolean(
    (env.R2_BUCKET_NAME || env.R2_BUCKET) &&
      env.R2_ENDPOINT &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY,
  );
}

export function getClickatonBlogStorage(env: BlogStorageEnv = process.env): BlogStoragePort {
  const bucket = env.R2_BUCKET_NAME || env.R2_BUCKET;
  if (bucket && hasR2BlogStorage(env)) {
    return new R2BlogStorage({
      bucket,
      endpoint: env.R2_ENDPOINT as string,
      accessKeyId: env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
      publicBaseUrl: env.R2_PUBLIC_URL,
    });
  }
  return new LocalBlogStorage();
}

export type UploadedBlogImage = {
  url: string;
  r2Key: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
};

/** Sube una imagen del blog validando mime y tamaño antes de tocar storage. */
export async function uploadBlogImage(
  file: File,
  namespace: ClickatonBlogNamespace,
): Promise<UploadedBlogImage> {
  const validation = validateBlogImageFile({ type: file.type, size: file.size });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const mimeType = file.type.toLowerCase();
  const filename = file.name?.trim() || `imagen.${extensionForMimeType(mimeType)}`;
  const body = Buffer.from(await file.arrayBuffer());
  const uploaded = await getClickatonBlogStorage().put({
    namespace,
    extension: extensionForMimeType(mimeType, filename),
    body,
    contentType: mimeType,
  });

  return {
    url: uploaded.url,
    r2Key: uploaded.key,
    mimeType,
    sizeBytes: uploaded.bytes,
    filename: filename.slice(0, 255),
  };
}

/** Borra el objeto solo si la key pertenece al namespace del blog. */
export async function deleteBlogImage(key: string | null | undefined): Promise<void> {
  const value = key?.trim();
  if (!value || !isClickatonBlogKey(value)) return;
  await getClickatonBlogStorage().delete(value);
}
