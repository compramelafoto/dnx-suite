/**
 * Storage de assets de marca DNX Partners (logos).
 * Reutiliza el mismo stack R2/local que welcome/blog — sin storage paralelo.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type PartnerStoredObject = {
  key: string;
  publicUrl: string | null;
  bytes: number;
  contentHash: string;
};

const PARTNER_KEY_PREFIX = "clickaton/partners/";

export function isPartnerAssetKey(key: string): boolean {
  if (!key || key.includes("..")) return false;
  return /^clickaton\/partners\/[a-z0-9_-]+\/brand\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/[a-z0-9-]+\.[a-z0-9]+$/i.test(
    key,
  );
}

function safeExtension(extension: string) {
  return extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

function buildPartnerBrandKey(partnerId: string, extension: string): string {
  const safePartner = partnerId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "partner";
  return `${PARTNER_KEY_PREFIX}${safePartner}/brand/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${safeExtension(extension)}`;
}

function stored(key: string, body: Buffer, publicUrl: string | null): PartnerStoredObject {
  return {
    key,
    publicUrl,
    bytes: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

export interface PartnerAssetStoragePort {
  put(input: {
    partnerId: string;
    extension: string;
    body: Buffer;
    contentType: string;
  }): Promise<PartnerStoredObject>;
  get(key: string): Promise<Buffer>;
}

class LocalPartnerAssetStorage implements PartnerAssetStoragePort {
  constructor(private readonly baseDir = join(process.cwd(), "public", "uploads")) {}
  async put(input: Parameters<PartnerAssetStoragePort["put"]>[0]) {
    const key = buildPartnerBrandKey(input.partnerId, input.extension);
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, input.body);
    return stored(key, input.body, `/${join("uploads", key).replaceAll("\\", "/")}`);
  }
  async get(key: string) {
    if (!isPartnerAssetKey(key)) throw new Error("INVALID_PARTNER_MEDIA_KEY");
    return readFile(join(this.baseDir, key));
  }
}

class R2PartnerAssetStorage implements PartnerAssetStoragePort {
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
  async put(input: Parameters<PartnerAssetStoragePort["put"]>[0]) {
    const key = buildPartnerBrandKey(input.partnerId, input.extension);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    const base = this.config.publicBaseUrl?.replace(/\/$/, "");
    const publicUrl = base ? `${base}/${key}` : `/api/media/${key}`;
    return stored(key, input.body, publicUrl);
  }
  async get(key: string) {
    if (!isPartnerAssetKey(key)) throw new Error("INVALID_PARTNER_MEDIA_KEY");
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    if (!response.Body) throw new Error("PARTNER_MEDIA_NOT_FOUND");
    return Buffer.from(await response.Body.transformToByteArray());
  }
}

export function getPartnerAssetStorage(
  env: Record<string, string | undefined> = process.env,
): PartnerAssetStoragePort {
  const bucket = env.R2_BUCKET_NAME || env.R2_BUCKET;
  if (
    bucket &&
    env.R2_ENDPOINT &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY
  ) {
    return new R2PartnerAssetStorage({
      bucket,
      endpoint: env.R2_ENDPOINT,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      publicBaseUrl: env.R2_PUBLIC_URL,
    });
  }
  return new LocalPartnerAssetStorage();
}
