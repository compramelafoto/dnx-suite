import { z } from "zod";
import { loadEnv } from "../../config/index.js";

export const postgresConfigSchema = z.object({
  databaseUrl: z.string().default(""),
  queryTimeoutMs: z.number().int().positive().default(10_000),
  longRunningThresholdMs: z.number().int().positive().default(30_000),
  maxConnectionWarning: z.number().int().positive().default(50),
});

export type PostgresConfig = z.infer<typeof postgresConfigSchema>;

export function resolvePostgresConfig(overrides: Partial<PostgresConfig> = {}): PostgresConfig {
  const env = loadEnv();

  const databaseUrl =
    overrides.databaseUrl ??
    env.POSTGRES_READONLY_DATABASE_URL ??
    env.POSTGRES_DATABASE_URL ??
    env.POSTGRES_URL ??
    env.DATABASE_URL ??
    "";

  return postgresConfigSchema.parse({
    databaseUrl,
    queryTimeoutMs: overrides.queryTimeoutMs ?? env.POSTGRES_QUERY_TIMEOUT_MS ?? undefined,
    longRunningThresholdMs: overrides.longRunningThresholdMs,
    maxConnectionWarning: overrides.maxConnectionWarning,
  });
}

export function isPostgresConfigured(config: Pick<PostgresConfig, "databaseUrl">): boolean {
  return config.databaseUrl.length > 0;
}

export function redactDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) {
      parsed.password = "***";
    }
    return parsed.toString();
  } catch {
    return "[redacted-connection-string]";
  }
}
