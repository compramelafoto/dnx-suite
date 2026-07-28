/**
 * Preflight seguro para cast profilePhotoStatus → enum (welcome_cards).
 * No imprime PII. Exit 1 si hay valores incompatibles.
 *
 * Uso: pnpm --filter clickaton exec tsx scripts/welcome-cards-migration-preflight.ts
 */
import { prisma } from "@repo/db";

const ALLOWED = new Set(["PENDING", "READY", "REJECTED"]);

async function main() {
  const rows = await prisma.$queryRaw<Array<{ v: string | null; c: bigint }>>`
    SELECT "profilePhotoStatus"::text AS v, COUNT(*)::bigint AS c
    FROM "ClickatonRegistration"
    GROUP BY 1
    ORDER BY 2 DESC
  `;

  console.log("=== welcome_cards profilePhotoStatus preflight ===");
  let bad = 0n;
  for (const row of rows) {
    const label = row.v ?? "<NULL>";
    const ok = row.v === null || ALLOWED.has(row.v.toUpperCase());
    console.log(`${label}\tcount=${row.c}\tok=${ok}`);
    if (!ok) bad += row.c;
  }
  if (bad > 0n) {
    console.error(`BLOCKED: ${bad} row(s) with incompatible profilePhotoStatus`);
    process.exitCode = 1;
    return;
  }
  console.log("OK: safe to run welcome_cards enum cast");
}

main()
  .catch((err) => {
    console.error("PREFLIGHT_FAILED", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
