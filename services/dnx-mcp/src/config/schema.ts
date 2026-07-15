import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Git
  GIT_REPO_PATH: z.string().optional(),
  GIT_BINARY: z.string().optional(),
  GIT_DEFAULT_BRANCH: z.string().optional(),

  // Vercel
  VERCEL_TOKEN: z.string().optional(),
  VERCEL_TEAM_ID: z.string().optional(),
  VERCEL_TEAM_SLUG: z.string().optional(),
  /** Protection Bypass for Automation — nunca loguear el valor. */
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),

  // Docker
  DOCKER_HOST: z.string().optional(),

  // PostgreSQL / Prisma
  POSTGRES_URL: z.string().optional(),
  POSTGRES_DATABASE_URL: z.string().optional(),
  POSTGRES_READONLY_DATABASE_URL: z.string().optional(),
  POSTGRES_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DATABASE_URL: z.string().optional(),
  PRISMA_SCHEMA_PATH: z.string().optional(),
  PRISMA_MIGRATIONS_PATH: z.string().optional(),
  PRISMA_BINARY: z.string().optional(),

  // Cloudflare
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),

  // Mercado Pago — sandbox Split only (nunca Production / APP_USR-)
  /** @deprecated Prefer MERCADOPAGO_TEST_ACCESS_TOKEN for Split sandbox. */
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_TEST_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_TEST_PUBLIC_KEY: z.string().optional(),
  MERCADOPAGO_TEST_OWNER_USER_ID: z.string().optional(),
  MERCADOPAGO_TEST_PARTNER_EMAIL: z.string().optional(),
  MERCADOPAGO_TEST_DEVICE_ID: z.string().optional(),
  /** Ephemeral card token from MercadoPago.js — never log. */
  MERCADOPAGO_TEST_PAYMENT_TOKEN: z.string().optional(),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // Google / Gmail
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),

  // Google Cloud (gcloud CLI) — valores "true"/"false" como string
  DNX_GCP_ENABLED: z.string().optional(),
  DNX_GCP_DEFAULT_PROJECT: z.string().optional(),
  DNX_GCP_DEFAULT_REGION: z.string().optional(),
  DNX_GCP_ALLOWED_PROJECT_PREFIXES: z.string().optional(),
  DNX_GCP_ALLOW_WRITES: z.string().optional(),
  DNX_GCP_ALLOW_PRODUCTION_WRITES: z.string().optional(),
  DNX_GCP_ALLOW_HIGH_RISK_WRITES: z.string().optional(),
  DNX_GCP_ALLOW_DESTRUCTIVE_ACTIONS: z.string().optional(),
  DNX_GCP_ALLOW_SERVICE_ACCOUNT_KEYS: z.string().optional(),
  DNX_GCP_COMMAND_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  DNX_GCP_MAX_OUTPUT_BYTES: z.coerce.number().int().positive().optional(),
  DNX_GCP_AUDIT_LOG_ENABLED: z.string().optional(),
  DNX_GCP_BINARY: z.string().optional(),

  // Cursor
  CURSOR_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;
