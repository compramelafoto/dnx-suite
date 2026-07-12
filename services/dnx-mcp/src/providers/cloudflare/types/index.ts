import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const stagingBucketStatusSchema = z.enum(["READY", "BLOCKED", "ACTION_REQUIRED"]);
export type StagingBucketStatus = z.infer<typeof stagingBucketStatusSchema>;

export const cloudflareTokenVerifySchema = z.object({
  id: z.string(),
  status: z.string(),
});
export type CloudflareTokenVerify = z.infer<typeof cloudflareTokenVerifySchema>;

export const cloudflareAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string().optional(),
});
export type CloudflareAccount = z.infer<typeof cloudflareAccountSchema>;

export const cloudflareAccountHealthSchema = z.object({
  configured: z.boolean(),
  tokenActive: z.boolean(),
  accountAccessible: z.boolean(),
  accountId: z.string().nullable(),
  accountName: z.string().nullable(),
  riskLevel: riskLevelSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type CloudflareAccountHealth = z.infer<typeof cloudflareAccountHealthSchema>;

export const r2BucketSchema = z.object({
  name: z.string(),
  creationDate: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  storageClass: z.string().nullable().optional(),
});
export type R2Bucket = z.infer<typeof r2BucketSchema>;

export const r2BucketUsageSchema = z.object({
  payloadSize: z.number().nullable(),
  metadataSize: z.number().nullable(),
  objectCount: z.number().nullable(),
  uploadCount: z.number().nullable(),
});
export type R2BucketUsage = z.infer<typeof r2BucketUsageSchema>;

export const r2CorsRuleSchema = z.object({
  allowed: z.object({
    origins: z.array(z.string()).default([]),
    methods: z.array(z.string()).default([]),
    headers: z.array(z.string()).optional(),
  }),
  exposeHeaders: z.array(z.string()).optional(),
  maxAgeSeconds: z.number().int().optional(),
});
export type R2CorsRule = z.infer<typeof r2CorsRuleSchema>;

export const r2PublicDomainSchema = z.object({
  enabled: z.boolean(),
  bucketId: z.string().nullable().optional(),
  domain: z.string().nullable().optional(),
});
export type R2PublicDomain = z.infer<typeof r2PublicDomainSchema>;

export const r2ObjectSummarySchema = z.object({
  key: z.string(),
  size: z.number().nullable().optional(),
  etag: z.string().nullable().optional(),
  lastModified: z.string().nullable().optional(),
  storageClass: z.string().nullable().optional(),
});
export type R2ObjectSummary = z.infer<typeof r2ObjectSummarySchema>;

export const r2ObjectHeadSchema = z.object({
  key: z.string(),
  exists: z.boolean(),
  contentType: z.string().nullable().optional(),
  contentLength: z.number().nullable().optional(),
  etag: z.string().nullable().optional(),
  lastModified: z.string().nullable().optional(),
});
export type R2ObjectHead = z.infer<typeof r2ObjectHeadSchema>;

export const createBucketOptionsSchema = z.object({
  locationHint: z.string().optional(),
  storageClass: z.enum(["Standard", "InfrequentAccess"]).optional(),
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false),
});
export type CreateBucketOptions = z.infer<typeof createBucketOptionsSchema>;

export const bucketValidationSchema = z.object({
  name: z.string(),
  exists: z.boolean(),
  isStagingName: z.boolean(),
  isProductionName: z.boolean(),
  productionProtected: z.boolean(),
  corsConfigured: z.boolean().nullable(),
  publicDomainEnabled: z.boolean().nullable(),
  usage: r2BucketUsageSchema.nullable(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  valid: z.boolean(),
});
export type BucketValidation = z.infer<typeof bucketValidationSchema>;

export const prepareStagingBucketInputSchema = z.object({
  platformId: z.string().min(1),
  bucketName: z.string().min(1),
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false),
});
export type PrepareStagingBucketInput = z.infer<typeof prepareStagingBucketInputSchema>;

export const prepareStagingBucketResultSchema = z.object({
  status: stagingBucketStatusSchema,
  platformId: z.string(),
  bucketName: z.string(),
  dryRun: z.boolean(),
  confirm: z.boolean(),
  exists: z.boolean(),
  created: z.boolean(),
  wouldCreate: z.boolean(),
  corsReady: z.boolean().nullable(),
  publicDomainReady: z.boolean().nullable(),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  actions: z.array(z.string()),
  recommendation: z.string(),
});
export type PrepareStagingBucketResult = z.infer<typeof prepareStagingBucketResultSchema>;

export const prepareApplicationInputSchema = z.object({
  platformId: z.string().min(1),
  dryRun: z.boolean().default(true),
  confirm: z.boolean().default(false),
  /** Si true, crea en Vercel solo target preview las R2_* faltantes (nunca production). */
  loadEnvToVercelPreview: z.boolean().default(false),
});
export type PrepareApplicationInput = z.infer<typeof prepareApplicationInputSchema>;

export const prepareApplicationR2EnvVarsSchema = z.object({
  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_ENDPOINT: z.string(),
  R2_BUCKET: z.string(),
  R2_BUCKET_NAME: z.string(),
  R2_REGION: z.string(),
});
export type PrepareApplicationR2EnvVars = z.infer<typeof prepareApplicationR2EnvVarsSchema>;

export const prepareApplicationResultSchema = z.object({
  status: stagingBucketStatusSchema,
  platformId: z.string(),
  bucketName: z.string().nullable(),
  dryRun: z.boolean(),
  confirm: z.boolean(),
  loadEnvToVercelPreview: z.boolean(),
  bucketExists: z.boolean(),
  endpoint: z.string(),
  endpointValid: z.boolean(),
  credentials: z.object({
    source: z.enum(["env", "created", "missing"]),
    accessKeyIdPresent: z.boolean(),
    accessKeyIdFingerprint: z.string().nullable(),
    secretFingerprint: z.string().nullable(),
    created: z.boolean(),
    createAttempted: z.boolean(),
    createError: z.string().nullable(),
  }),
  envVars: prepareApplicationR2EnvVarsSchema.nullable(),
  envVarKeys: z.array(z.string()),
  vercelPreview: z.object({
    project: z.string().nullable(),
    configured: z.boolean(),
    missingKeys: z.array(z.string()),
    presentKeys: z.array(z.string()),
    loadOffered: z.boolean(),
    loadedKeys: z.array(z.string()),
    loadSkippedReason: z.string().nullable(),
  }),
  smokeTest: z.object({
    key: z.string(),
    uploadOk: z.boolean().nullable(),
    downloadOk: z.boolean().nullable(),
    cleanedUp: z.boolean(),
    error: z.string().nullable(),
  }),
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  actions: z.array(z.string()),
  recommendation: z.string(),
});
export type PrepareApplicationResult = z.infer<typeof prepareApplicationResultSchema>;

export const cloudflareReleaseReadinessSchema = z.object({
  configured: z.boolean(),
  bucketExists: z.boolean(),
  bucketName: z.string().nullable(),
  corsReady: z.boolean().nullable(),
  publicDomainReady: z.boolean().nullable(),
  assetsRequired: z.boolean(),
  productionProtected: z.boolean(),
  riskLevel: riskLevelSchema,
  blockers: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendation: z.string(),
});
export type CloudflareReleaseReadiness = z.infer<typeof cloudflareReleaseReadinessSchema>;

export function parseCloudflareEnvelope<T>(body: unknown, resultSchema: z.ZodType<T>): T {
  const envelope = z
    .object({
      success: z.boolean(),
      errors: z
        .array(
          z.object({
            code: z.union([z.number(), z.string()]).optional(),
            message: z.string().optional(),
          }),
        )
        .optional(),
      result: z.unknown(),
    })
    .parse(body);

  if (!envelope.success) {
    const message =
      envelope.errors
        ?.map((e) => e.message)
        .filter(Boolean)
        .join("; ") || "Cloudflare API respondió success=false";
    throw new Error(message);
  }

  return resultSchema.parse(envelope.result);
}
