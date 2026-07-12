import { createHash } from "node:crypto";
import { z } from "zod";
import type { CloudflareHttpClient } from "../client/index.js";
import { CloudflareApiError, CloudflareAuthError } from "../errors.js";
import { parseCloudflareEnvelope } from "../types/index.js";

/** Workers R2 Storage Bucket Item Write — object R/W scoped to buckets. */
export const R2_BUCKET_ITEM_WRITE_PERMISSION_GROUP_ID = "2efd5506f9c8494dacb1fa10a3e7d5b6";

const createdTokenSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  name: z.string().optional(),
});

export interface CreateScopedR2CredentialsInput {
  accountId: string;
  bucketName: string;
  tokenName?: string;
  jurisdiction?: "default" | "eu" | "fedramp";
}

export interface ScopedR2Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  tokenName: string;
  bucketName: string;
  /** SHA-256 fingerprint of the secret (safe to log). */
  secretFingerprint: string;
}

/**
 * Crea Access Key S3-compatible vía User API Token de Cloudflare,
 * scoped a un único bucket (Object Read & Write).
 *
 * Access Key ID = token.id
 * Secret Access Key = SHA-256 hex del token.value
 *
 * @see https://developers.cloudflare.com/r2/api/tokens/
 */
export class R2CredentialsService {
  constructor(private readonly client: CloudflareHttpClient) {}

  async createScopedObjectCredentials(
    input: CreateScopedR2CredentialsInput,
  ): Promise<ScopedR2Credentials> {
    const jurisdiction = input.jurisdiction ?? "default";
    const tokenName =
      input.tokenName ?? `dnx-mcp-r2-${input.bucketName}-${Date.now().toString(36)}`;
    const resourceKey = `com.cloudflare.edge.r2.bucket.${input.accountId}_${jurisdiction}_${input.bucketName}`;

    const body = await this.client.post<unknown>("/user/tokens", {
      body: {
        name: tokenName,
        policies: [
          {
            effect: "allow",
            resources: {
              [resourceKey]: "*",
            },
            permission_groups: [
              {
                id: R2_BUCKET_ITEM_WRITE_PERMISSION_GROUP_ID,
                name: "Workers R2 Storage Bucket Item Write",
              },
            ],
          },
        ],
      },
    });

    let token: z.infer<typeof createdTokenSchema>;
    try {
      token = parseCloudflareEnvelope(body, createdTokenSchema);
    } catch (error) {
      throw new CloudflareApiError(
        400,
        undefined,
        error instanceof Error
          ? error.message
          : "No se pudo crear el API token R2 (respuesta inválida)",
        body,
      );
    }

    const secretAccessKey = createHash("sha256").update(token.value).digest("hex");

    return {
      accessKeyId: token.id,
      secretAccessKey,
      tokenName,
      bucketName: input.bucketName,
      secretFingerprint: createHash("sha256").update(secretAccessKey).digest("hex").slice(0, 12),
    };
  }
}

export function fingerprintSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function isCredentialsCreateUnauthorized(error: unknown): boolean {
  return (
    error instanceof CloudflareAuthError ||
    (error instanceof CloudflareApiError && (error.status === 401 || error.status === 403))
  );
}
