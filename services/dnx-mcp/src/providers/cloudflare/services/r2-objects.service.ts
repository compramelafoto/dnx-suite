import { XMLParser } from "./xml-lite.js";
import type { R2S3Client } from "../client/index.js";
import { assertMutableAllowed, assertSafeBucketName } from "../helpers/guards.js";
import {
  r2ObjectHeadSchema,
  r2ObjectSummarySchema,
  type R2ObjectHead,
  type R2ObjectSummary,
} from "../types/index.js";
import { CloudflareApiError, CloudflareNotFoundError } from "../errors.js";

export class R2ObjectsService {
  constructor(private readonly s3: R2S3Client) {}

  async listObjects(bucket: string, prefix?: string): Promise<R2ObjectSummary[]> {
    assertSafeBucketName(bucket, { allowProductionRead: true });
    this.s3.assertConfigured();

    const response = await this.s3.request("GET", {
      bucket,
      query: {
        "list-type": "2",
        ...(prefix ? { prefix } : {}),
      },
    });

    if (!response.ok) {
      throw new CloudflareApiError(
        response.status,
        undefined,
        `listObjects falló (${String(response.status)})`,
      );
    }

    const xml = await response.text();
    const parsed = XMLParser.parseListBucketResult(xml);
    return parsed.map((item) => r2ObjectSummarySchema.parse(item));
  }

  async objectExists(bucket: string, key: string): Promise<boolean> {
    const head = await this.headObject(bucket, key);
    return head.exists;
  }

  async headObject(bucket: string, key: string): Promise<R2ObjectHead> {
    assertSafeBucketName(bucket, { allowProductionRead: true });
    this.s3.assertConfigured();

    const response = await this.s3.request("HEAD", { bucket, key });

    if (response.status === 404) {
      return r2ObjectHeadSchema.parse({
        key,
        exists: false,
        contentType: null,
        contentLength: null,
        etag: null,
        lastModified: null,
      });
    }

    if (!response.ok) {
      throw new CloudflareApiError(
        response.status,
        undefined,
        `headObject falló (${String(response.status)})`,
      );
    }

    return r2ObjectHeadSchema.parse({
      key,
      exists: true,
      contentType: response.headers.get("content-type"),
      contentLength: Number(response.headers.get("content-length") ?? NaN) || null,
      etag: response.headers.get("etag"),
      lastModified: response.headers.get("last-modified"),
    });
  }

  async uploadObject(
    bucket: string,
    key: string,
    body: string | Buffer | Uint8Array,
    contentType = "application/octet-stream",
    confirm = false,
    dryRun = true,
  ): Promise<{ dryRun: boolean; uploaded: boolean; key: string; wouldUpload: boolean }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    if (!key) {
      throw new CloudflareNotFoundError("R2 object key", "(vacío)");
    }

    assertMutableAllowed("uploadObject", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, uploaded: false, key, wouldUpload: true };
    }

    this.s3.assertConfigured();
    const response = await this.s3.request("PUT", {
      bucket,
      key,
      body,
      headers: { "content-type": contentType },
    });

    if (!response.ok) {
      throw new CloudflareApiError(
        response.status,
        undefined,
        `uploadObject falló (${String(response.status)})`,
      );
    }

    return { dryRun: false, uploaded: true, key, wouldUpload: false };
  }

  /**
   * Descarga el cuerpo de un objeto (solo buckets no-prod).
   * Usado por smoke tests de prepare application — no es mutación.
   */
  async downloadObject(
    bucket: string,
    key: string,
  ): Promise<{ ok: boolean; body: Buffer | null; status: number; contentType: string | null }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    if (!key) {
      throw new CloudflareNotFoundError("R2 object key", "(vacío)");
    }

    this.s3.assertConfigured();
    const response = await this.s3.request("GET", { bucket, key });

    if (response.status === 404) {
      return { ok: false, body: null, status: 404, contentType: null };
    }

    if (!response.ok) {
      throw new CloudflareApiError(
        response.status,
        undefined,
        `downloadObject falló (${String(response.status)})`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      ok: true,
      body: Buffer.from(arrayBuffer),
      status: response.status,
      contentType: response.headers.get("content-type"),
    };
  }

  async deleteObject(
    bucket: string,
    key: string,
    confirm = false,
    dryRun = true,
  ): Promise<{ dryRun: boolean; deleted: boolean; key: string; wouldDelete: boolean }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    assertMutableAllowed("deleteObject", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, deleted: false, key, wouldDelete: true };
    }

    this.s3.assertConfigured();
    const response = await this.s3.request("DELETE", { bucket, key });

    if (!response.ok && response.status !== 204) {
      throw new CloudflareApiError(
        response.status,
        undefined,
        `deleteObject falló (${String(response.status)})`,
      );
    }

    return { dryRun: false, deleted: true, key, wouldDelete: false };
  }
}
