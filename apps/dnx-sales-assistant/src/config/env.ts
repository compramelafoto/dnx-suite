import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { AppConfig } from "../types/config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PACKAGE_VERSION = "0.1.0";

const envSchema = z.object({
  NODE_ENV: z.string().optional().default("development"),
  PORT: z.coerce.number().int().positive().default(3040),
  ASSISTANT_MODE: z.literal("simulate").default("simulate"),
});

export function loadEnvFiles(): void {
  const appRoot = path.resolve(__dirname, "../..");
  dotenv.config({ path: path.join(appRoot, ".env") });
  dotenv.config({ path: path.join(appRoot, ".env.local"), override: true });
}

export function loadConfig(): AppConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Config inválida: ${msg}`);
  }

  return {
    port: parsed.data.PORT,
    environment: parsed.data.NODE_ENV,
    mode: parsed.data.ASSISTANT_MODE,
    serviceName: "dnx-sales-assistant",
    version: PACKAGE_VERSION,
  };
}
