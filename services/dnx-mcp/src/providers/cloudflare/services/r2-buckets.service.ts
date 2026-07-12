import { z } from "zod";
import type { CloudflareHttpClient } from "../client/index.js";
import {
  CloudflareGuardError,
  CloudflareNotFoundError,
  CloudflareValidationError,
} from "../errors.js";
import {
  bucketValidationSchema,
  createBucketOptionsSchema,
  parseCloudflareEnvelope,
  r2BucketSchema,
  r2BucketUsageSchema,
  type BucketValidation,
  type CreateBucketOptions,
  type R2Bucket,
  type R2BucketUsage,
} from "../types/index.js";
import {
  assertMutableAllowed,
  assertSafeBucketName,
  isProductionBucketName,
  isStagingBucketName,
} from "../helpers/guards.js";

const listBucketsResultSchema = z.object({
  buckets: z.array(
    z.object({
      name: z.string(),
      creation_date: z.string().optional().nullable(),
      location: z.string().optional().nullable(),
      storage_class: z.string().optional().nullable(),
    }),
  ),
});

const bucketResultSchema = z.object({
  name: z.string(),
  creation_date: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  storage_class: z.string().optional().nullable(),
});

const usageResultSchema = z
  .object({
    payloadSize: z.number().optional().nullable(),
    metadataSize: z.number().optional().nullable(),
    objectCount: z.number().optional().nullable(),
    uploadCount: z.number().optional().nullable(),
    end: z.string().optional().nullable(),
  })
  .passthrough();

function toR2Bucket(raw: z.infer<typeof bucketResultSchema>): R2Bucket {
  return r2BucketSchema.parse({
    name: raw.name,
    creationDate: raw.creation_date ?? null,
    location: raw.location ?? null,
    storageClass: raw.storage_class ?? null,
  });
}

export class R2BucketsService {
  constructor(private readonly client: CloudflareHttpClient) {}

  private bucketsPath(): string {
    return `/accounts/${this.client.accountId}/r2/buckets`;
  }

  async listBuckets(): Promise<R2Bucket[]> {
    const body = await this.client.get<unknown>(this.bucketsPath());
    const result = parseCloudflareEnvelope(body, listBucketsResultSchema);
    return result.buckets.map((bucket) => toR2Bucket(bucket));
  }

  async getBucket(name: string): Promise<R2Bucket> {
    assertSafeBucketName(name, { allowProductionRead: true });
    const body = await this.client.get<unknown>(
      `${this.bucketsPath()}/${encodeURIComponent(name)}`,
    );
    try {
      const result = parseCloudflareEnvelope(body, bucketResultSchema);
      return toR2Bucket(result);
    } catch {
      throw new CloudflareNotFoundError("R2 bucket", name);
    }
  }

  async bucketExists(name: string): Promise<boolean> {
    try {
      await this.getBucket(name);
      return true;
    } catch (error) {
      if (error instanceof CloudflareNotFoundError) {
        return false;
      }
      // Algunos tenants responden 404 genérico vía ApiError
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (message.includes("not found") || message.includes("does not exist")) {
        return false;
      }
      throw error;
    }
  }

  async createBucket(
    name: string,
    options: Partial<CreateBucketOptions> = {},
  ): Promise<{
    dryRun: boolean;
    created: boolean;
    bucket: R2Bucket | null;
    wouldCreate: boolean;
  }> {
    const parsed = createBucketOptionsSchema.parse(options);
    assertSafeBucketName(name, { allowProductionRead: false });

    if (isProductionBucketName(name)) {
      throw new CloudflareGuardError(
        `Bucket "${name}" parece de producción — creación bloqueada desde DNX-MCP`,
      );
    }

    assertMutableAllowed("createBucket", parsed);

    if (parsed.dryRun) {
      return { dryRun: true, created: false, bucket: null, wouldCreate: true };
    }

    const body = await this.client.post<unknown>(this.bucketsPath(), {
      body: {
        name,
        ...(parsed.locationHint ? { locationHint: parsed.locationHint } : {}),
        ...(parsed.storageClass ? { storageClass: parsed.storageClass } : {}),
      },
    });

    const result = parseCloudflareEnvelope(body, bucketResultSchema);
    return {
      dryRun: false,
      created: true,
      bucket: toR2Bucket(result),
      wouldCreate: false,
    };
  }

  async deleteBucket(
    name: string,
    confirm = false,
    dryRun = true,
  ): Promise<{ dryRun: boolean; deleted: boolean; wouldDelete: boolean }> {
    assertSafeBucketName(name, { allowProductionRead: false });

    if (isProductionBucketName(name)) {
      throw new CloudflareGuardError(
        `Bucket de producción "${name}" — eliminación bloqueada (NO TOCAR)`,
      );
    }

    assertMutableAllowed("deleteBucket", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, deleted: false, wouldDelete: true };
    }

    await this.client.delete<unknown>(`${this.bucketsPath()}/${encodeURIComponent(name)}`);
    return { dryRun: false, deleted: true, wouldDelete: false };
  }

  async getBucketUsage(name: string): Promise<R2BucketUsage> {
    assertSafeBucketName(name, { allowProductionRead: true });
    const body = await this.client.get<unknown>(
      `${this.bucketsPath()}/${encodeURIComponent(name)}/usage`,
    );
    const result = parseCloudflareEnvelope(body, usageResultSchema);
    return r2BucketUsageSchema.parse({
      payloadSize: result.payloadSize ?? null,
      metadataSize: result.metadataSize ?? null,
      objectCount: result.objectCount ?? null,
      uploadCount: result.uploadCount ?? null,
    });
  }

  async validateBucket(name: string): Promise<BucketValidation> {
    if (!name || name.trim().length === 0) {
      throw new CloudflareValidationError("Nombre de bucket vacío");
    }

    const isStagingName = isStagingBucketName(name);
    const isProductionName = isProductionBucketName(name);
    const productionProtected = isProductionName;
    const blockers: string[] = [];
    const warnings: string[] = [];

    let exists = false;
    const corsConfigured: boolean | null = null;
    const publicDomainEnabled: boolean | null = null;
    let usage: R2BucketUsage | null = null;

    try {
      exists = await this.bucketExists(name);
    } catch {
      blockers.push(`No se pudo verificar existencia del bucket "${name}"`);
    }

    if (!exists) {
      blockers.push(`Bucket "${name}" no existe`);
    } else {
      try {
        usage = await this.getBucketUsage(name);
      } catch {
        warnings.push("No se pudo obtener usage del bucket");
      }
    }

    if (isProductionName) {
      warnings.push("Bucket de producción — solo lectura / NO TOCAR desde flujos staging");
    }

    if (!isStagingName && !isProductionName) {
      warnings.push('Nombre no termina en "-staging" ni parece producción');
    }

    return bucketValidationSchema.parse({
      name,
      exists,
      isStagingName,
      isProductionName,
      productionProtected,
      corsConfigured,
      publicDomainEnabled,
      usage,
      blockers,
      warnings,
      valid: blockers.length === 0,
    });
  }
}
