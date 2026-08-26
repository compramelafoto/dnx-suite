/**
 * Almacenamiento de logos de partners (sponsors) en R2.
 *
 * Namespace propio (`clickaton/partners/logos`) para no mezclarse con blog,
 * welcome-card ni participant-cards. Reutiliza las mismas variables de entorno
 * de R2 y, en desarrollo sin R2, cae a disco local (`public/uploads`).
 *
 * El bucket es privado a propósito: sin `R2_PUBLIC_URL` las URLs se sirven
 * same-origin por el proxy `/api/media/<key>`.
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
import sharp from "sharp";

export const PARTNER_LOGO_KEY_ROOT = "clickaton/partners/logos";

export const PARTNER_LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Los logos entran a placas 1080×1920; 5 MB sobra y evita descargas lentas. */
export const PARTNER_LOGO_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Claves válidas: `clickaton/partners/logos/YYYY-MM-DD/<uuid>.<ext>`.
 * Debe mantenerse alineada con el allowlist de `lib/content/public-media-keys.ts`.
 */
export const PARTNER_LOGO_KEY_PATTERN =
  /^clickaton\/partners\/logos\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i;

export function isPartnerLogoKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return PARTNER_LOGO_KEY_PATTERN.test(key);
}

export function buildPartnerLogoKey(extension: string, now: Date = new Date()): string {
  const safeExtension = extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `${PARTNER_LOGO_KEY_ROOT}/${now.toISOString().slice(0, 10)}/${randomUUID()}.${safeExtension}`;
}

export function extensionForPartnerLogoMime(mimeType: string, filename?: string): string {
  const fromMime = EXTENSION_BY_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  const fromName = filename?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName;
  return "png";
}

export function validatePartnerLogoFile(input: {
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  const type = (input.type || "").toLowerCase();
  if (!(PARTNER_LOGO_ALLOWED_TYPES as readonly string[]).includes(type)) {
    // SVG queda fuera a propósito: es ejecutable y el renderer no lo acepta.
    return { ok: false, error: "Solo se permiten logos PNG, JPG o WebP" };
  }
  if (input.size <= 0) {
    return { ok: false, error: "El archivo está vacío" };
  }
  if (input.size > PARTNER_LOGO_MAX_BYTES) {
    return { ok: false, error: "El logo no puede superar 5 MB" };
  }
  return { ok: true };
}

export type StoredPartnerLogo = {
  key: string;
  /** URL usable desde la app; `/api/media/<key>` si el bucket es privado. */
  url: string;
  bytes: number;
  contentHash: string;
};

export type PartnerLogoStoragePort = {
  put(input: {
    extension: string;
    body: Buffer;
    contentType: string;
  }): Promise<StoredPartnerLogo>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
};

function stored(key: string, body: Buffer, url: string): StoredPartnerLogo {
  return {
    key,
    url,
    bytes: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

function assertPartnerLogoKey(key: string): void {
  if (!isPartnerLogoKey(key)) {
    throw new Error("INVALID_PARTNER_LOGO_KEY");
  }
}

export class LocalPartnerLogoStorage implements PartnerLogoStoragePort {
  constructor(private readonly baseDir = join(process.cwd(), "public", "uploads")) {}

  async put(input: Parameters<PartnerLogoStoragePort["put"]>[0]) {
    const key = buildPartnerLogoKey(input.extension);
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, input.body);
    return stored(key, input.body, `/uploads/${key}`);
  }

  async get(key: string) {
    assertPartnerLogoKey(key);
    return readFile(join(this.baseDir, key));
  }

  async delete(key: string) {
    assertPartnerLogoKey(key);
    await unlink(join(this.baseDir, key)).catch(() => undefined);
  }
}

export class R2PartnerLogoStorage implements PartnerLogoStoragePort {
  readonly backend = "R2" as const;
  private readonly client: S3Client;

  constructor(
    private readonly config: {
      bucket: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
      publicBaseUrl?: string;
    }
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

  async put(input: Parameters<PartnerLogoStoragePort["put"]>[0]) {
    const key = buildPartnerLogoKey(input.extension);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      })
    );
    const base = this.config.publicBaseUrl?.replace(/\/$/, "");
    return stored(key, input.body, base ? `${base}/${key}` : `/api/media/${key}`);
  }

  async get(key: string) {
    assertPartnerLogoKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
    );
    if (!response.Body) throw new Error("PARTNER_LOGO_NOT_FOUND");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string) {
    assertPartnerLogoKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key })
    );
  }
}

export type PartnerLogoStorageEnv = Record<string, string | undefined>;

export type PartnerLogoStorageResolution =
  | { kind: "r2"; storage: R2PartnerLogoStorage }
  | { kind: "local"; storage: LocalPartnerLogoStorage }
  | { kind: "unavailable"; code: "PARTNER_LOGO_STORAGE_NOT_CONFIGURED" };

/**
 * - R2 completo → R2
 * - development sin R2 → disco local
 * - preview/production sin R2 → unavailable (el filesystem de Vercel es efímero
 *   y el logo desaparecería en el siguiente deploy)
 */
export function resolvePartnerLogoStorage(
  env: PartnerLogoStorageEnv = process.env
): PartnerLogoStorageResolution {
  const bucket = env.R2_BUCKET_NAME || env.R2_BUCKET;
  const hasR2 = Boolean(
    bucket && env.R2_ENDPOINT && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY
  );

  if (bucket && hasR2) {
    return {
      kind: "r2",
      storage: new R2PartnerLogoStorage({
        bucket,
        endpoint: env.R2_ENDPOINT as string,
        accessKeyId: env.R2_ACCESS_KEY_ID as string,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
        publicBaseUrl: env.R2_PUBLIC_URL,
      }),
    };
  }

  const nodeEnv = (env.NODE_ENV || "").toLowerCase();
  const vercelEnv = (env.VERCEL_ENV || "").toLowerCase();
  const allowLocalFallback =
    nodeEnv === "development" &&
    vercelEnv !== "preview" &&
    vercelEnv !== "production" &&
    env.VERCEL !== "1";

  if (allowLocalFallback) {
    return { kind: "local", storage: new LocalPartnerLogoStorage() };
  }

  return { kind: "unavailable", code: "PARTNER_LOGO_STORAGE_NOT_CONFIGURED" };
}

export function getPartnerLogoStorage(
  env: PartnerLogoStorageEnv = process.env
): PartnerLogoStoragePort {
  const resolved = resolvePartnerLogoStorage(env);
  if (resolved.kind === "unavailable") {
    throw new Error(resolved.code);
  }
  return resolved.storage;
}

export type UploadedPartnerLogo = {
  url: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
  contentHash: string;
  width: number | null;
  height: number | null;
  /** Backend que efectivamente guardó el archivo. */
  backend: "r2" | "local";
};

/** Dimensiones reales del archivo; si no se pueden leer, el asset queda sin medidas. */
async function readImageDimensions(
  body: Buffer
): Promise<{ width: number | null; height: number | null }> {
  try {
    const metadata = await sharp(body).metadata();
    return { width: metadata.width ?? null, height: metadata.height ?? null };
  } catch {
    return { width: null, height: null };
  }
}

/** Sube el logo validando mime y tamaño antes de tocar storage. */
export async function uploadPartnerLogo(file: File): Promise<UploadedPartnerLogo> {
  const validation = validatePartnerLogoFile({ type: file.type, size: file.size });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const mimeType = file.type.toLowerCase();
  const filename = file.name?.trim() || `logo.${extensionForPartnerLogoMime(mimeType)}`;
  const body = Buffer.from(await file.arrayBuffer());
  const dimensions = await readImageDimensions(body);

  const resolved = resolvePartnerLogoStorage();
  if (resolved.kind === "unavailable") {
    throw new Error(resolved.code);
  }

  const uploaded = await resolved.storage.put({
    extension: extensionForPartnerLogoMime(mimeType, filename),
    body,
    contentType: mimeType,
  });

  return {
    url: uploaded.url,
    storageKey: uploaded.key,
    mimeType,
    sizeBytes: uploaded.bytes,
    filename: filename.slice(0, 255),
    contentHash: uploaded.contentHash,
    backend: resolved.kind,
    ...dimensions,
  };
}

/** Borra el objeto solo si la key pertenece al namespace de logos. */
export async function deletePartnerLogo(key: string | null | undefined): Promise<void> {
  const value = key?.trim();
  if (!value || !isPartnerLogoKey(value)) return;
  const resolved = resolvePartnerLogoStorage();
  if (resolved.kind === "unavailable") return;
  await resolved.storage.delete(value);
}
