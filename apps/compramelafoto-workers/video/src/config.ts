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
  R2_PUBLIC_BASE_URL: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
  VIDEO_WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  VIDEO_WORKER_MAX_ATTEMPTS: z.coerce.number().int().positive().default(3),
  VIDEO_WORKER_STALE_JOB_MINUTES: z.coerce.number().int().positive().default(30),
});

export type WorkerConfig = z.infer<typeof envSchema> & { r2BucketName: string };

export function loadEnvFiles() {
  const root = path.resolve(__dirname, "../..");
  dotenv.config({ path: path.join(root, ".env") });
  dotenv.config({ path: path.join(root, ".env.local"), override: true });
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
}

export function getConfig(): WorkerConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config inválida: ${msg}`);
  }
  const bucket = parsed.data.R2_BUCKET_NAME ?? parsed.data.R2_BUCKET;
  if (!bucket) {
    throw new Error("R2_BUCKET_NAME o R2_BUCKET es obligatorio");
  }
  return { ...parsed.data, r2BucketName: bucket };
}
