import { z } from "zod";
import type { CloudflareHttpClient } from "../client/index.js";
import { assertMutableAllowed, assertSafeBucketName } from "../helpers/guards.js";
import { parseCloudflareEnvelope, r2CorsRuleSchema, type R2CorsRule } from "../types/index.js";

const corsRulesSchema = z.array(r2CorsRuleSchema);

/**
 * Cloudflare R2 CORS API usa un shape ligeramente distinto; normalizamos.
 */
const cloudflareCorsRuleSchema = z
  .object({
    allowed: z
      .object({
        origins: z.array(z.string()).optional(),
        methods: z.array(z.string()).optional(),
        headers: z.array(z.string()).optional(),
      })
      .optional(),
    AllowedOrigins: z.array(z.string()).optional(),
    AllowedMethods: z.array(z.string()).optional(),
    AllowedHeaders: z.array(z.string()).optional(),
    ExposeHeaders: z.array(z.string()).optional(),
    exposeHeaders: z.array(z.string()).optional(),
    MaxAgeSeconds: z.number().optional(),
    maxAgeSeconds: z.number().optional(),
  })
  .passthrough();

function normalizeCorsRule(raw: z.infer<typeof cloudflareCorsRuleSchema>): R2CorsRule {
  return r2CorsRuleSchema.parse({
    allowed: {
      origins: raw.allowed?.origins ?? raw.AllowedOrigins ?? [],
      methods: raw.allowed?.methods ?? raw.AllowedMethods ?? [],
      headers: raw.allowed?.headers ?? raw.AllowedHeaders,
    },
    exposeHeaders: raw.exposeHeaders ?? raw.ExposeHeaders,
    maxAgeSeconds: raw.maxAgeSeconds ?? raw.MaxAgeSeconds,
  });
}

export class R2CorsService {
  constructor(private readonly client: CloudflareHttpClient) {}

  private corsPath(bucket: string): string {
    return `/accounts/${this.client.accountId}/r2/buckets/${encodeURIComponent(bucket)}/cors`;
  }

  async getCors(bucket: string): Promise<R2CorsRule[]> {
    assertSafeBucketName(bucket, { allowProductionRead: true });
    const body = await this.client.get<unknown>(this.corsPath(bucket));
    const result = parseCloudflareEnvelope(
      body,
      z.union([
        z.array(cloudflareCorsRuleSchema),
        z.object({ rules: z.array(cloudflareCorsRuleSchema) }),
      ]),
    );
    const rules = Array.isArray(result) ? result : result.rules;
    return rules.map(normalizeCorsRule);
  }

  async updateCors(
    bucket: string,
    rules: R2CorsRule[],
    confirm = false,
    dryRun = true,
  ): Promise<{ dryRun: boolean; updated: boolean; rules: R2CorsRule[]; wouldUpdate: boolean }> {
    assertSafeBucketName(bucket, { allowProductionRead: false });
    const parsedRules = corsRulesSchema.parse(rules);
    assertMutableAllowed("updateCors", { dryRun, confirm });

    if (dryRun) {
      return { dryRun: true, updated: false, rules: parsedRules, wouldUpdate: true };
    }

    // Cloudflare R2 Management API: PUT body = { rules: [{ allowed, exposeHeaders, maxAgeSeconds }] }
    await this.client.put<unknown>(this.corsPath(bucket), {
      body: {
        rules: parsedRules.map((rule) => ({
          allowed: {
            origins: rule.allowed.origins,
            methods: rule.allowed.methods,
            ...(rule.allowed.headers ? { headers: rule.allowed.headers } : {}),
          },
          ...(rule.exposeHeaders ? { exposeHeaders: rule.exposeHeaders } : {}),
          ...(rule.maxAgeSeconds !== undefined ? { maxAgeSeconds: rule.maxAgeSeconds } : {}),
        })),
      },
    });

    // La respuesta PUT puede no devolver rules; re-leemos para confirmar.
    const returnedRules = await this.getCors(bucket);

    return {
      dryRun: false,
      updated: true,
      rules: returnedRules.length > 0 ? returnedRules : parsedRules,
      wouldUpdate: false,
    };
  }

  isCorsReady(rules: R2CorsRule[]): boolean {
    return rules.some(
      (rule) =>
        rule.allowed.origins.length > 0 &&
        rule.allowed.methods.some((method) => ["GET", "HEAD", "PUT", "POST"].includes(method)),
    );
  }
}
