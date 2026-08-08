/**
 * Listado/borrado por prefix R2 (ops fixtures). Solo uso interno controlado.
 */
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
  type _Object,
} from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { readR2PrivateStorageConfig } from "./r2-private-storage";

export type ListedR2Object = {
  key: string;
  size: number;
  etag: string | null;
  lastModified: string | null;
};

function clientFromConfig() {
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
  return { client, cfg };
}

export async function listR2ObjectsByPrefix(prefix: string): Promise<{
  bucket: string;
  prefix: string;
  objects: ListedR2Object[];
}> {
  const ctx = clientFromConfig();
  if (!ctx) throw new Error("R2_NOT_CONFIGURED");
  const objects: ListedR2Object[] = [];
  let token: string | undefined;
  do {
    const res = await ctx.client.send(
      new ListObjectsV2Command({
        Bucket: ctx.cfg.bucket,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: 1000,
      }),
    );
    for (const o of (res.Contents ?? []) as _Object[]) {
      if (!o.Key) continue;
      objects.push({
        key: o.Key,
        size: o.Size ?? 0,
        etag: o.ETag ?? null,
        lastModified: o.LastModified ? o.LastModified.toISOString() : null,
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return { bucket: ctx.cfg.bucket, prefix, objects };
}

export async function deleteR2ObjectsByKeys(keys: string[]): Promise<{
  deleted: string[];
  errors: Array<{ key: string; error: string }>;
}> {
  const ctx = clientFromConfig();
  if (!ctx) throw new Error("R2_NOT_CONFIGURED");
  const deleted: string[] = [];
  const errors: Array<{ key: string; error: string }> = [];
  for (const key of keys) {
    try {
      await ctx.client.send(
        new DeleteObjectCommand({ Bucket: ctx.cfg.bucket, Key: key }),
      );
      deleted.push(key);
    } catch (e) {
      errors.push({ key, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { deleted, errors };
}

export function hashObjectList(objects: ListedR2Object[]): string {
  const h = createHash("sha256");
  for (const o of objects.slice().sort((a, b) => a.key.localeCompare(b.key))) {
    h.update(`${o.key}|${o.size}|${o.etag ?? ""}\n`);
  }
  return h.digest("hex");
}
