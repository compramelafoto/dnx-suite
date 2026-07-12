import { z } from "zod";
import { loadEnv } from "../../config/index.js";

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === "") return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parsePrefixes(raw: string | undefined): string[] {
  if (!raw || raw.trim() === "") return ["dnx-"];
  return raw
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export const googleCloudConfigSchema = z.object({
  enabled: z.boolean(),
  defaultProject: z.string(),
  defaultRegion: z.string(),
  allowedProjectPrefixes: z.array(z.string()),
  allowWrites: z.boolean(),
  allowProductionWrites: z.boolean(),
  allowHighRiskWrites: z.boolean(),
  allowDestructiveActions: z.boolean(),
  allowServiceAccountKeys: z.boolean(),
  commandTimeoutMs: z.number().int().positive(),
  maxOutputBytes: z.number().int().positive(),
  auditLogEnabled: z.boolean(),
  binary: z.string().min(1),
});

export type GoogleCloudConfig = z.infer<typeof googleCloudConfigSchema>;

export const defaultGoogleCloudConfig: GoogleCloudConfig = {
  enabled: false,
  defaultProject: "",
  defaultRegion: "southamerica-east1",
  allowedProjectPrefixes: ["dnx-"],
  allowWrites: false,
  allowProductionWrites: false,
  allowHighRiskWrites: false,
  allowDestructiveActions: false,
  allowServiceAccountKeys: false,
  commandTimeoutMs: 120_000,
  maxOutputBytes: 1_048_576,
  auditLogEnabled: true,
  binary: "gcloud",
};

export function resolveGoogleCloudConfig(
  overrides: Partial<GoogleCloudConfig> = {},
): GoogleCloudConfig {
  const env = loadEnv();

  return googleCloudConfigSchema.parse({
    ...defaultGoogleCloudConfig,
    enabled: parseBool(env.DNX_GCP_ENABLED, false),
    defaultProject: env.DNX_GCP_DEFAULT_PROJECT ?? "",
    defaultRegion: env.DNX_GCP_DEFAULT_REGION ?? "southamerica-east1",
    allowedProjectPrefixes: parsePrefixes(env.DNX_GCP_ALLOWED_PROJECT_PREFIXES),
    allowWrites: parseBool(env.DNX_GCP_ALLOW_WRITES, false),
    allowProductionWrites: parseBool(env.DNX_GCP_ALLOW_PRODUCTION_WRITES, false),
    allowHighRiskWrites: parseBool(env.DNX_GCP_ALLOW_HIGH_RISK_WRITES, false),
    allowDestructiveActions: parseBool(env.DNX_GCP_ALLOW_DESTRUCTIVE_ACTIONS, false),
    allowServiceAccountKeys: parseBool(env.DNX_GCP_ALLOW_SERVICE_ACCOUNT_KEYS, false),
    commandTimeoutMs: env.DNX_GCP_COMMAND_TIMEOUT_MS ?? 120_000,
    maxOutputBytes: env.DNX_GCP_MAX_OUTPUT_BYTES ?? 1_048_576,
    auditLogEnabled: parseBool(env.DNX_GCP_AUDIT_LOG_ENABLED, true),
    binary: env.DNX_GCP_BINARY?.trim() || "gcloud",
    ...overrides,
  });
}

export function isGoogleCloudModuleEnabled(config: GoogleCloudConfig = resolveGoogleCloudConfig()): boolean {
  return config.enabled;
}
