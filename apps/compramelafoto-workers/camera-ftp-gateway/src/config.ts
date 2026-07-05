import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_ENDPOINT: z.string().min(1),
  CAMERA_CONNECTION_FTP_PORT: z.coerce.number().int().positive().default(21),
  FTP_PASV_URL: z.string().optional(),
  FTP_PASV_MIN_PORT: z.coerce.number().int().positive().default(50000),
  FTP_PASV_MAX_PORT: z.coerce.number().int().positive().default(50050),
  FTP_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(31_457_280),
  FTP_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(600_000),
  FTP_RATE_LIMIT_MAX_FILES: z.coerce.number().int().positive().default(60),
  HEALTH_PORT: z.coerce.number().int().positive().default(8080),
});

export type GatewayConfig = z.infer<typeof envSchema> & {
  r2BucketName: string;
  pasvUrl: string | null;
};

export function loadEnvFiles() {
  const root = path.resolve(__dirname, "../..");
  dotenv.config({ path: path.join(root, ".env") });
  dotenv.config({ path: path.join(root, ".env.local"), override: true });
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
}

export function getConfig(): GatewayConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config inválida: ${msg}`);
  }

  const bucket = parsed.data.R2_BUCKET_NAME ?? parsed.data.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME o R2_BUCKET es obligatorio");
  }

  if (parsed.data.FTP_PASV_MAX_PORT < parsed.data.FTP_PASV_MIN_PORT) {
    throw new Error("FTP_PASV_MAX_PORT debe ser >= FTP_PASV_MIN_PORT");
  }

  const pasvRaw = parsed.data.FTP_PASV_URL?.trim();
  const pasvUrl = pasvRaw && pasvRaw.length > 0 ? pasvRaw : null;

  return {
    ...parsed.data,
    r2BucketName: bucket,
    pasvUrl,
  };
}
