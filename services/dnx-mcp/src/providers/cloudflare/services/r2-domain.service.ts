import { z } from "zod";
import type { CloudflareHttpClient } from "../client/index.js";
import { assertMutableAllowed, assertSafeBucketName } from "../helpers/guards.js";
import {
  parseCloudflareEnvelope,
  r2PublicDomainSchema,
  type R2PublicDomain,
} from "../types/index.js";

const managedDomainSchema = z
  .object({
    enabled: z.boolean().optional(),
    bucketId: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
  })
  .passthrough();

export class R2DomainService {
  constructor(private readonly client: CloudflareHttpClient) {}

  private managedPath(bucket: string): string {
    return `/accounts/${this.client.accountId}/r2/buckets/${encodeURIComponent(bucket)}/domains/managed`;
  }

  async getPublicDomain(bucket: string): Promise<R2PublicDomain> {
    assertSafeBucketName(bucket, { allowProductionRead: true });
    const body = await this.client.get<unknown>(this.managedPath(bucket));
    const result = parseCloudflareEnvelope(body, managedDomainSchema);
    return r2PublicDomainSchema.parse({
      enabled: result.enabled === true,
      bucketId: result.bucketId ?? null,
      domain: result.domain ?? null,
    });
  }

  async enablePublicDomain(
    bucket: string,
    confirm = false,
    dryRun = true,
  ): Promise<{
    dryRun: boolean;
    enabled: boolean;
    domain: R2PublicDomain | null;
    wouldEnable: boolean;
  }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    assertMutableAllowed("enablePublicDomain", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, enabled: false, domain: null, wouldEnable: true };
    }

    const body = await this.client.put<unknown>(this.managedPath(bucket), {
      body: { enabled: true },
    });
    const result = parseCloudflareEnvelope(body, managedDomainSchema);
    return {
      dryRun: false,
      enabled: true,
      domain: r2PublicDomainSchema.parse({
        enabled: result.enabled === true,
        bucketId: result.bucketId ?? null,
        domain: result.domain ?? null,
      }),
      wouldEnable: false,
    };
  }

  async disablePublicDomain(
    bucket: string,
    confirm = false,
    dryRun = true,
  ): Promise<{ dryRun: boolean; disabled: boolean; wouldDisable: boolean }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    assertMutableAllowed("disablePublicDomain", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, disabled: false, wouldDisable: true };
    }

    await this.client.put<unknown>(this.managedPath(bucket), {
      body: { enabled: false },
    });
    return { dryRun: false, disabled: true, wouldDisable: false };
  }
}
