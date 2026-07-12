import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

/**
 * Carga `.env` y `.env.local` desde la raíz del proyecto si existen.
 * `.env.local` sobrescribe valores de `.env`.
 * No falla si los archivos no están presentes.
 */
export function loadDotenvFiles(cwd: string = process.cwd()): void {
  const envPath = resolve(cwd, ".env");
  const localPath = resolve(cwd, ".env.local");

  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, quiet: true });
  }

  if (existsSync(localPath)) {
    loadDotenv({ path: localPath, override: true, quiet: true });
  }
}
