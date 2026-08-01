#!/usr/bin/env node
/**
 * LOCAL ONLY — aplica DDL mínimo TemplateV2* si faltan tablas.
 * No es una migración Prisma; no toca producción.
 *
 *   pnpm --filter compramelafoto e2e:ensure-template-v2-tables
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    let k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function loadDatabaseUrl(): string {
  const here = fileURLToPath(new URL(".", import.meta.url));
  for (const path of [
    resolve(here, "../.env.local"),
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), "apps/compramelafoto/.env.local"),
  ]) {
    const env = parseEnvFile(path);
    if (env.DATABASE_URL) return env.DATABASE_URL.trim();
  }
  throw new Error("DATABASE_URL not found in CLF .env.local");
}

function assertLocal(url: string) {
  const host = new URL(url).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    console.error(JSON.stringify({ ok: false, abort: "PRODUCTION_DATABASE_SAFETY_BLOCKER", host }));
    process.exit(99);
  }
}

function main() {
  const databaseUrl = loadDatabaseUrl();
  assertLocal(databaseUrl);
  const sqlPath = resolve(fileURLToPath(new URL(".", import.meta.url)), "sql/e2e-local-template-v2-tables.sql");
  if (!existsSync(sqlPath)) {
    throw new Error(`Missing ${sqlPath}`);
  }

  const check = execFileSync(
    "psql",
    [databaseUrl, "-tAc", `SELECT to_regclass('public."TemplateV2"')`],
    { encoding: "utf8" }
  ).trim();

  if (check.includes("TemplateV2")) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: "tables_already_present" }));
    return;
  }

  execFileSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1", "-f", sqlPath], {
    stdio: "inherit",
  });
  console.log(JSON.stringify({ ok: true, applied: true, sql: "scripts/sql/e2e-local-template-v2-tables.sql" }));
}

main();
