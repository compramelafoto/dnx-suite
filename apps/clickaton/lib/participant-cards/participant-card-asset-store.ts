import { createHash } from "node:crypto";
import { mkdir, readFile, unlink, writeFile, access } from "node:fs/promises";
import { constants } from "node:fs";
import { join } from "node:path";
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma as defaultPrisma } from "@/lib/admin/db";
import { shouldInlineMediaInDb } from "@/lib/welcome-card/storage";

export type ParticipantCardPutMetadata = {
  cardType: string;
  templateKey: string;
  templateVersion: number;
  renderHashPrefix: string;
  width: number;
  height: number;
  mimeType: string;
  generatedAt: string;
};

export type StoredParticipantCardObject = {
  key: string;
  publicUrl: string | null;
  bytes: number;
  contentHash: string;
};

export interface ParticipantCardAssetStore {
  exists(key: string): Promise<boolean>;
  putAtKey(
    key: string,
    body: Buffer,
    metadata?: ParticipantCardPutMetadata
  ): Promise<StoredParticipantCardObject>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  readonly backend: string;
}

function storedObject(
  key: string,
  body: Buffer,
  publicUrl: string | null
): StoredParticipantCardObject {
  return {
    key,
    publicUrl,
    bytes: body.length,
    contentHash: createHash("sha256").update(body).digest("hex"),
  };
}

function metadataToS3(metadata?: ParticipantCardPutMetadata): Record<string, string> | undefined {
  if (!metadata) return undefined;
  return {
    "card-type": metadata.cardType,
    "template-key": metadata.templateKey,
    "template-version": String(metadata.templateVersion),
    "render-hash-prefix": metadata.renderHashPrefix,
    width: String(metadata.width),
    height: String(metadata.height),
    "mime-type": metadata.mimeType,
    "generated-at": metadata.generatedAt,
  };
}

export class MemoryParticipantCardAssetStore implements ParticipantCardAssetStore {
  readonly backend = "MEMORY";
  private readonly objects = new Map<string, Buffer>();

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async putAtKey(
    key: string,
    body: Buffer,
    metadata?: ParticipantCardPutMetadata
  ): Promise<StoredParticipantCardObject> {
    void metadata;
    this.objects.set(key, body);
    return storedObject(key, body, `/api/media/${key}`);
  }

  async get(key: string): Promise<Buffer> {
    const body = this.objects.get(key);
    if (!body) throw new Error("PARTICIPANT_CARD_ASSET_NOT_FOUND");
    return body;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export class LocalParticipantCardAssetStore implements ParticipantCardAssetStore {
  readonly backend = "LOCAL";

  constructor(
    private readonly baseDir = join(process.cwd(), "public", "uploads")
  ) {}

  async exists(key: string): Promise<boolean> {
    try {
      await access(join(this.baseDir, key), constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async putAtKey(
    key: string,
    body: Buffer,
    metadata?: ParticipantCardPutMetadata
  ): Promise<StoredParticipantCardObject> {
    void metadata;
    if (!key.startsWith("clickaton/participant-cards/")) {
      throw new Error("INVALID_PARTICIPANT_CARD_KEY");
    }
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, body);
    const publicUrl = `/${join("uploads", key).replaceAll("\\", "/")}`;
    return storedObject(key, body, publicUrl);
  }

  async get(key: string): Promise<Buffer> {
    if (!key.startsWith("clickaton/")) throw new Error("INVALID_PARTICIPANT_CARD_KEY");
    return readFile(join(this.baseDir, key));
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.baseDir, key));
    } catch {
      /* ignore missing */
    }
  }
}

export class KeyOnlyParticipantCardAssetStore implements ParticipantCardAssetStore {
  readonly backend = "KEY_ONLY";

  async exists(key: string): Promise<boolean> {
    void key;
    return false;
  }

  async putAtKey(
    key: string,
    body: Buffer,
    metadata?: ParticipantCardPutMetadata
  ): Promise<StoredParticipantCardObject> {
    void metadata;
    if (!key.startsWith("clickaton/participant-cards/")) {
      throw new Error("INVALID_PARTICIPANT_CARD_KEY");
    }
    return storedObject(key, body, null);
  }

  async get(key: string): Promise<Buffer> {
    void key;
    throw new Error("KEY_ONLY_PARTICIPANT_CARD_GET_UNSUPPORTED");
  }

  async delete(key: string): Promise<void> {
    void key;
  }
}

export class R2ParticipantCardAssetStore implements ParticipantCardAssetStore {
  readonly backend = "R2";
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

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async putAtKey(
    key: string,
    body: Buffer,
    metadata?: ParticipantCardPutMetadata
  ): Promise<StoredParticipantCardObject> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: metadata?.mimeType ?? "image/png",
        Metadata: metadataToS3(metadata),
      })
    );
    const base = this.config.publicBaseUrl?.replace(/\/$/, "");
    const publicUrl = base ? `${base}/${key}` : `/api/media/${key}`;
    return storedObject(key, body, publicUrl);
  }

  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key })
    );
    if (!response.Body) throw new Error("PARTICIPANT_CARD_ASSET_NOT_FOUND");
    return Buffer.from(await response.Body.transformToByteArray());
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key })
    );
  }
}

export function createParticipantCardAssetStore(): ParticipantCardAssetStore {
  const bucket = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (bucket && endpoint && accessKeyId && secretAccessKey) {
    return new R2ParticipantCardAssetStore({
      bucket,
      endpoint,
      accessKeyId,
      secretAccessKey,
      publicBaseUrl: process.env.R2_PUBLIC_URL,
    });
  }
  if (shouldInlineMediaInDb()) {
    return new KeyOnlyParticipantCardAssetStore();
  }
  if (process.env.NODE_ENV === "test") {
    return new MemoryParticipantCardAssetStore();
  }
  return new LocalParticipantCardAssetStore();
}

export async function persistParticipantCardMediaAsset(input: {
  cardRecordId: string;
  registrationId: string;
  editionId: string;
  storageKey: string;
  publicUrl: string | null;
  png: Buffer;
  width: number;
  height: number;
  storageBackend: string;
  templateKey: string;
  templateVersion: number;
  cardType: string;
  renderHashPrefix: string;
  prisma?: typeof defaultPrisma;
}): Promise<string> {
  const db = input.prisma ?? defaultPrisma;
  const inline = input.storageBackend === "KEY_ONLY" || shouldInlineMediaInDb();
  const contentHash = createHash("sha256").update(input.png).digest("hex");

  const asset = await db.dnxMediaAsset.create({
    data: {
      platform: "CLICKATON",
      ownerType: "PARTICIPANT_CARD",
      ownerId: input.cardRecordId,
      editionId: input.editionId,
      registrationId: input.registrationId,
      kind: "PARTICIPANT_CARD_PNG",
      storageBackend: inline ? "INLINE_DB" : input.storageBackend,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl,
      mimeType: "image/png",
      width: input.width,
      height: input.height,
      bytes: input.png.length,
      contentHash,
      ...(inline
        ? {
            metadata: {
              inlineBase64: input.png.toString("base64"),
              inlineStorage: "db_metadata",
              cardType: input.cardType,
              templateKey: input.templateKey,
              templateVersion: input.templateVersion,
              renderHashPrefix: input.renderHashPrefix,
            },
          }
        : {
            metadata: {
              cardType: input.cardType,
              templateKey: input.templateKey,
              templateVersion: input.templateVersion,
              renderHashPrefix: input.renderHashPrefix,
            },
          }),
    },
  });

  return asset.id;
}

export async function loadParticipantCardPngFromAsset(assetId: string): Promise<Buffer> {
  const asset = await defaultPrisma.dnxMediaAsset.findUnique({
    where: { id: assetId },
    select: { storageKey: true, metadata: true },
  });
  if (!asset) throw new Error("PARTICIPANT_CARD_ASSET_NOT_FOUND");

  const meta = asset.metadata as { inlineBase64?: string } | null;
  if (meta?.inlineBase64) {
    return Buffer.from(meta.inlineBase64, "base64");
  }

  const store = createParticipantCardAssetStore();
  return store.get(asset.storageKey);
}
