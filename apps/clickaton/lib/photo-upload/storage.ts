/**
 * Storage privado de obras Clickatón.
 * Nunca expone URL pública permanente del original.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { presignPutUrl } from "./presign";

export type PrivateStoredObject = {
  key: string;
  bytes: number;
  contentHash: string;
  contentType: string;
};

/** Permiso temporal para que el navegador deposite el archivo sin pasar por el servidor. */
export type DirectUploadTicket = {
  url: string;
  key: string;
  expiresInSeconds: number;
};

export interface PrivateEntryStorage {
  put(input: {
    editionId: string;
    submissionId: string;
    kind: "original" | "preview" | "thumbnail";
    extension: string;
    body: Buffer;
    contentType: string;
  }): Promise<PrivateStoredObject>;
  get(key: string): Promise<Buffer>;
  /**
   * URL firmada para subir directo al bucket.
   *
   * `null` cuando el almacenamiento no lo soporta (disco local, memoria): el
   * llamador cae al envío por el servidor, que sigue funcionando.
   */
  presignInbox?(input: {
    editionId: string;
    registrationId: string;
    extension: string;
    contentType: string;
  }): Promise<DirectUploadTicket | null>;
  remove?(key: string): Promise<void>;
  isPrivate: boolean;
}

function safeExt(extension: string) {
  return extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
}

function buildKey(input: {
  editionId: string;
  submissionId: string;
  kind: string;
  extension: string;
}) {
  return `clickaton/private/entries/${input.editionId}/${input.submissionId}/${input.kind}/${randomUUID()}.${safeExt(input.extension)}`;
}

/**
 * Buzón de entrada: dónde deposita el navegador antes de que el servidor valide.
 *
 * Vive bajo el mismo prefijo privado que el resto, así que nunca es público, y
 * lleva la inscripción en la ruta para que una persona no pueda pedir permiso
 * para escribir en el espacio de otra.
 */
function buildInboxKey(input: {
  editionId: string;
  registrationId: string;
  extension: string;
}) {
  return `clickaton/private/entries/${input.editionId}/inbox/${input.registrationId}/${randomUUID()}.${safeExt(input.extension)}`;
}

function assertPrivateKey(key: string) {
  if (!key.startsWith("clickaton/private/entries/")) throw new Error("INVALID_PRIVATE_KEY");
}

/** El buzón es lo único que acepta una key traída por el cliente. */
export function isInboxKey(key: string, input: { editionId: string; registrationId: string }) {
  return key.startsWith(
    `clickaton/private/entries/${input.editionId}/inbox/${input.registrationId}/`,
  );
}

export class LocalPrivateEntryStorage implements PrivateEntryStorage {
  readonly isPrivate = true;
  constructor(private readonly baseDir = join(process.cwd(), ".data", "private-entries")) {}

  async put(input: Parameters<PrivateEntryStorage["put"]>[0]): Promise<PrivateStoredObject> {
    const key = buildKey(input);
    const file = join(this.baseDir, key);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(file, input.body);
    return {
      key,
      bytes: input.body.length,
      contentHash: createHash("sha256").update(input.body).digest("hex"),
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    assertPrivateKey(key);
    return readFile(join(this.baseDir, key));
  }
}

export class MemoryPrivateEntryStorage implements PrivateEntryStorage {
  readonly isPrivate = true;
  private readonly objects = new Map<string, Buffer>();

  async put(input: Parameters<PrivateEntryStorage["put"]>[0]): Promise<PrivateStoredObject> {
    const key = buildKey(input);
    this.objects.set(key, input.body);
    return {
      key,
      bytes: input.body.length,
      contentHash: createHash("sha256").update(input.body).digest("hex"),
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    assertPrivateKey(key);
    const body = this.objects.get(key);
    if (!body) throw new Error("MEDIA_NOT_FOUND");
    return body;
  }

  async delete(key: string) {
    this.objects.delete(key);
  }
}

export class R2PrivateEntryStorage implements PrivateEntryStorage {
  readonly isPrivate = true;
  private readonly client: S3Client;

  constructor(
    private readonly config: {
      bucket: string;
      endpoint: string;
      accessKeyId: string;
      secretAccessKey: string;
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

  async put(input: Parameters<PrivateEntryStorage["put"]>[0]): Promise<PrivateStoredObject> {
    const key = buildKey(input);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
    return {
      key,
      bytes: input.body.length,
      contentHash: createHash("sha256").update(input.body).digest("hex"),
      contentType: input.contentType,
    };
  }

  async get(key: string): Promise<Buffer> {
    assertPrivateKey(key);
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error("MEDIA_NOT_FOUND");
    return Buffer.from(bytes);
  }

  async presignInbox(input: {
    editionId: string;
    registrationId: string;
    extension: string;
    contentType: string;
  }): Promise<DirectUploadTicket> {
    const key = buildInboxKey(input);
    const expiresInSeconds = 900; // 15 minutos: alcanza para una foto con mala señal.
    const url = presignPutUrl({
      endpoint: this.config.endpoint,
      bucket: this.config.bucket,
      key,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      expiresInSeconds,
    });
    return { url, key, expiresInSeconds };
  }

  async remove(key: string): Promise<void> {
    assertPrivateKey(key);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
  }
}

export function getPrivateEntryStorage(): PrivateEntryStorage {
  if (process.env.CLICKATON_PHOTO_UPLOAD_MEMORY === "1") {
    return new MemoryPrivateEntryStorage();
  }
  const bucket = process.env.R2_BUCKET || process.env.R2_BUCKET_NAME;
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (bucket && endpoint && accessKeyId && secretAccessKey) {
    return new R2PrivateEntryStorage({ bucket, endpoint, accessKeyId, secretAccessKey });
  }
  return new LocalPrivateEntryStorage();
}

/** Cleanup best-effort (local only). */
export async function tryDeleteLocalPrivateKey(key: string): Promise<void> {
  try {
    assertPrivateKey(key);
    await unlink(join(process.cwd(), ".data", "private-entries", key));
  } catch {
    /* ignore */
  }
}
