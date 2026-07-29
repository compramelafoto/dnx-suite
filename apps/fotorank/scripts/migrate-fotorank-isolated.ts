/**
 * Aplica migraciones Prisma solo sobre DB local/aislada FotoRank.
 * Nunca usa packages/db/.env Neon sin override explícito.
 *
 * Uso:
 *   DATABASE_URL='postgresql://USER@localhost:5432/fotorank_staging_2026' \
 *   DIRECT_URL="$DATABASE_URL" \
 *     pnpm --filter fotorank exec tsx scripts/migrate-fotorank-isolated.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

const check = assertSafeFotoRankDatabaseUrl();
console.log("[migrate-fotorank-isolated]", check);

const result = spawnSync(
  "pnpm",
  ["--filter", "@repo/db", "exec", "prisma", "migrate", "deploy"],
  {
    cwd: repoRoot,
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL,
      DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
    stdio: "inherit",
  },
);

process.exit(result.status ?? 1);
