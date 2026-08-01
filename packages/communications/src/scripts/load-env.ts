import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Carga .env de forma explícita (solo scripts).
 * No se usa desde módulos de dominio.
 */
export function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env) || !process.env[k]) {
      process.env[k] = v;
    }
  }
}

export function loadCommunicationsEnvFiles(): string[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(here, "../..");
  const monorepoRoot = resolve(packageRoot, "../..");
  const candidates = [
    resolve(packageRoot, ".env.local"),
    resolve(packageRoot, ".env"),
    resolve(monorepoRoot, ".env.local"),
    resolve(monorepoRoot, ".env"),
  ];
  const loaded: string[] = [];
  for (const path of candidates) {
    if (existsSync(path)) {
      loadEnvFile(path);
      loaded.push(path);
    }
  }
  return loaded;
}
