import dotenv from "dotenv";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  FOTOFFICE_R2_ENDPOINT: z.string().optional(),
  R2_ENDPOINT: z.string().optional(),
  FOTOFFICE_R2_ACCESS_KEY_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  FOTOFFICE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  FOTOFFICE_R2_BUCKET: z.string().optional(),
  DIGITALIZACION_MAX_HORAS: z.coerce.number().positive().default(20),
  DIGITALIZACION_PRESET: z.string().min(1).default("veryfast"),
});

export type Config = {
  databaseUrl: string;
  r2: { endpoint: string; accessKeyId: string; secretAccessKey: string };
  bucket: string;
  maxHoras: number;
  preset: string;
};

export function loadEnvFiles() {
  const root = path.resolve(__dirname, "../..");
  dotenv.config({ path: path.join(root, ".env") });
  dotenv.config({ path: path.join(root, ".env.local"), override: true });
  dotenv.config({ path: path.resolve(__dirname, "../.env"), override: true });
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config inválida: ${msg}`);
  }
  const d = parsed.data;
  const endpoint = d.FOTOFFICE_R2_ENDPOINT || d.R2_ENDPOINT;
  const accessKeyId = d.FOTOFFICE_R2_ACCESS_KEY_ID || d.R2_ACCESS_KEY_ID;
  const secretAccessKey = d.FOTOFFICE_R2_SECRET_ACCESS_KEY || d.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Config inválida: faltan FOTOFFICE_R2_ENDPOINT, FOTOFFICE_R2_ACCESS_KEY_ID o FOTOFFICE_R2_SECRET_ACCESS_KEY",
    );
  }
  return {
    databaseUrl: d.DATABASE_URL,
    r2: { endpoint, accessKeyId, secretAccessKey },
    bucket: d.FOTOFFICE_R2_BUCKET || "fotoffice-private",
    maxHoras: d.DIGITALIZACION_MAX_HORAS,
    preset: d.DIGITALIZACION_PRESET,
  };
}
