/**
 * Backfill: autoriza licencia editorial en todas las fotos CLF existentes
 * (PENDING / UNKNOWN → AUTHORIZED). No toca REVOKED.
 *
 * Uso:
 *   pnpm --filter @repo/db exec tsx ../../apps/infospot/lib/editorial-photos/authorize-all-editorial-licenses.ts
 *   ... --dry-run
 */

import { prisma } from "@repo/db";

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const where = {
    editorialLicenseStatus: { in: ["PENDING", "UNKNOWN"] as const },
  };

  const count = await prisma.infoSpotEditorialPhoto.count({ where });
  console.log(
    `[editorial-license-backfill] candidatas PENDING/UNKNOWN: ${count}` +
      (dryRun ? " (dry-run)" : ""),
  );

  if (dryRun || count === 0) {
    process.exit(0);
  }

  const result = await prisma.infoSpotEditorialPhoto.updateMany({
    where,
    data: { editorialLicenseStatus: "AUTHORIZED" },
  });

  console.log(
    `[editorial-license-backfill] actualizadas a AUTHORIZED: ${result.count}`,
  );
}

main()
  .catch((err) => {
    console.error("[editorial-license-backfill] ERROR", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
