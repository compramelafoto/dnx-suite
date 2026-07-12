import { z } from "zod";

export const platformIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "El id debe ser kebab-case");

export const platformDomainsSchema = z.object({
  production: z.array(z.string().min(1)).min(1),
  preview: z.array(z.string().min(1)).min(1),
});

export const platformDatabaseSchema = z
  .object({
    provider: z.enum(["postgres", "prisma"]),
    urlEnvKey: z.string().min(1),
    schema: z.string().optional(),
  })
  .nullable();

export const platformRedisSchema = z
  .object({
    urlEnvKey: z.string().min(1),
    prefix: z.string().optional(),
  })
  .nullable();

export const platformR2Schema = z
  .object({
    /** Bucket legacy / alias de producción (compat). */
    bucket: z.string().min(1).optional(),
    prefix: z.string().optional(),
    publicUrl: z.string().url().optional(),
    /** Bucket de producción — NO TOCAR desde flujos staging/MCP. */
    productionBucket: z.string().min(1).optional(),
    /** Bucket de staging permitido para operaciones MCP. */
    stagingBucket: z.string().min(1).optional(),
    /** Si true, mutaciones sobre producción están bloqueadas. */
    productionProtected: z.boolean().default(true),
    /** Si true, DNX-MCP puede operar sobre staging. */
    stagingOperationsAllowed: z.boolean().default(true),
    /** URL pública esperada (staging o CDN). */
    expectedPublicUrl: z.string().url().optional(),
    /** Clave de objeto para smoke test de assets. */
    smokeTestObjectKey: z.string().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.bucket && !value.productionBucket && !value.stagingBucket) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Se requiere al menos bucket, productionBucket o stagingBucket",
      });
    }
  })
  .nullable();

export const platformCloudflareSchema = z
  .object({
    zoneId: z.string().min(1),
    accountId: z.string().min(1),
  })
  .nullable();

export const platformMercadoPagoSchema = z
  .object({
    enabled: z.boolean(),
    webhookPath: z.string().optional(),
  })
  .nullable();

export const platformGmailSchema = z
  .object({
    enabled: z.boolean(),
    senderEnvKey: z.string().optional(),
  })
  .nullable();

export const platformGoogleSchema = z
  .object({
    enabled: z.boolean(),
    oauthScopes: z.array(z.string()).optional(),
  })
  .nullable();

export const healthEndpointSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
  expectedStatus: z.number().int().min(100).max(599).default(200),
});

export const smokeTestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["http", "cli", "mcp"]),
  target: z.string().min(1),
});

export const releasePolicySchema = z.object({
  requireStagingValidation: z.boolean().default(true),
  requireConfirmation: z.boolean().default(true),
  autoDeployOnMerge: z.boolean().default(false),
  allowedTargets: z.array(z.enum(["production", "preview", "development"])).default(["production"]),
  /** Ramas permitidas para release. Si vacío o ausente, usa `defaultBranch`. */
  allowedBranches: z.array(z.string().min(1)).optional(),
});

export const rollbackPolicySchema = z.object({
  enabled: z.boolean().default(true),
  maxRollbackSteps: z.number().int().min(1).max(10).default(1),
  requireConfirmation: z.boolean().default(true),
});

export const maintenanceModeSchema = z.object({
  enabled: z.boolean().default(false),
  message: z.string().optional(),
  allowedIps: z.array(z.string()).default([]),
});

export const featureFlagSchema = z.object({
  key: z.string().min(1),
  description: z.string().min(1),
  defaultValue: z.boolean().default(false),
});

export const platformDefinitionSchema = z.object({
  id: platformIdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  repository: z.string().min(1),
  defaultBranch: z.string().min(1),
  vercelProject: z.string().min(1),
  domains: platformDomainsSchema,
  workers: z.array(z.string()),
  database: platformDatabaseSchema,
  redis: platformRedisSchema,
  r2: platformR2Schema,
  cloudflare: platformCloudflareSchema,
  mercadoPago: platformMercadoPagoSchema,
  gmail: platformGmailSchema,
  google: platformGoogleSchema,
  healthEndpoints: z.array(healthEndpointSchema),
  smokeTests: z.array(smokeTestSchema),
  releasePolicy: releasePolicySchema,
  rollbackPolicy: rollbackPolicySchema,
  maintenanceMode: maintenanceModeSchema,
  featureFlags: z.array(featureFlagSchema),
});

export type PlatformId = z.infer<typeof platformIdSchema>;
export type PlatformDomains = z.infer<typeof platformDomainsSchema>;
export type PlatformDatabase = z.infer<typeof platformDatabaseSchema>;
export type PlatformRedis = z.infer<typeof platformRedisSchema>;
export type PlatformR2 = z.infer<typeof platformR2Schema>;
export type PlatformCloudflare = z.infer<typeof platformCloudflareSchema>;
export type PlatformMercadoPago = z.infer<typeof platformMercadoPagoSchema>;
export type PlatformGmail = z.infer<typeof platformGmailSchema>;
export type PlatformGoogle = z.infer<typeof platformGoogleSchema>;
export type HealthEndpoint = z.infer<typeof healthEndpointSchema>;
export type SmokeTest = z.infer<typeof smokeTestSchema>;
export type ReleasePolicy = z.infer<typeof releasePolicySchema>;
export type RollbackPolicy = z.infer<typeof rollbackPolicySchema>;
export type MaintenanceMode = z.infer<typeof maintenanceModeSchema>;
export type FeatureFlag = z.infer<typeof featureFlagSchema>;
export type PlatformDefinition = z.infer<typeof platformDefinitionSchema>;

export interface PlatformValidationResult {
  valid: boolean;
  platformId: string;
  errors: string[];
}

export interface PlatformContext {
  platformId: string;
  platformName: string;
  vercelProject: string;
}

export function toPlatformContext(platform: PlatformDefinition): PlatformContext {
  return {
    platformId: platform.id,
    platformName: platform.name,
    vercelProject: platform.vercelProject,
  };
}
