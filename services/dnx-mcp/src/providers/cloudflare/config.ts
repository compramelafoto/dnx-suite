import { z } from "zod";
import { loadEnv } from "../../config/index.js";

export const cloudflareConfigSchema = z.object({
  apiToken: z.string().default(""),
  accountId: z.string().default(""),
  baseUrl: z.string().url().default("https://api.cloudflare.com/client/v4"),
  maxRetries: z.number().int().min(0).max(10).default(3),
  retryBaseDelayMs: z.number().int().min(50).default(500),
  requestsPerMinute: z.number().int().min(1).default(100),
  /** Credenciales S3-compatible para objetos R2 (opcionales). */
  r2AccessKeyId: z.string().default(""),
  r2SecretAccessKey: z.string().default(""),
  r2Jurisdiction: z.enum(["default", "eu", "fedramp"]).default("default"),
});

export type CloudflareConfig = z.infer<typeof cloudflareConfigSchema>;

export const defaultCloudflareConfig = {
  baseUrl: "https://api.cloudflare.com/client/v4",
  maxRetries: 3,
  retryBaseDelayMs: 500,
  requestsPerMinute: 100,
  r2Jurisdiction: "default",
} as const;

export function resolveCloudflareConfig(
  overrides: Partial<CloudflareConfig> = {},
): CloudflareConfig {
  const env = loadEnv();

  return cloudflareConfigSchema.parse({
    ...defaultCloudflareConfig,
    apiToken: overrides.apiToken ?? env.CLOUDFLARE_API_TOKEN ?? "",
    accountId: overrides.accountId ?? env.CLOUDFLARE_ACCOUNT_ID ?? "",
    r2AccessKeyId: overrides.r2AccessKeyId ?? env.R2_ACCESS_KEY_ID ?? "",
    r2SecretAccessKey: overrides.r2SecretAccessKey ?? env.R2_SECRET_ACCESS_KEY ?? "",
    ...overrides,
  });
}

export function isCloudflareConfigured(
  config: Pick<CloudflareConfig, "apiToken" | "accountId">,
): boolean {
  return config.apiToken.length > 0 && config.accountId.length > 0;
}

export function hasR2ObjectCredentials(
  config: Pick<CloudflareConfig, "r2AccessKeyId" | "r2SecretAccessKey">,
): boolean {
  return config.r2AccessKeyId.length > 0 && config.r2SecretAccessKey.length > 0;
}

/** Endpoint S3-compatible de R2 (nunca loguear credenciales). */
export function buildR2S3Endpoint(
  accountId: string,
  jurisdiction: CloudflareConfig["r2Jurisdiction"] = "default",
): string {
  if (jurisdiction === "eu") {
    return `https://${accountId}.eu.r2.cloudflarestorage.com`;
  }
  if (jurisdiction === "fedramp") {
    return `https://${accountId}.fedramp.r2.cloudflarestorage.com`;
  }
  return `https://${accountId}.r2.cloudflarestorage.com`;
}
