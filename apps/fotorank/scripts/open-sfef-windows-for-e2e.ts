/**
 * Abre ventanas de Santa Fe en Foco en DB staging aislada para E2E.
 * No cambia fechas “oficiales” documentadas; solo fixture operativo local.
 *
 * DATABASE_URL=...staging pnpm --filter @repo/db exec tsx ../../apps/fotorank/scripts/open-sfef-windows-for-e2e.ts
 */
import { prisma } from "@repo/db";
import { assertSafeFotoRankDatabaseUrl } from "./assert-safe-database-url";

assertSafeFotoRankDatabaseUrl();

async function main() {
  const now = new Date();
  const opens = new Date(now.getTime() - 60_000);
  const closes = new Date(now.getTime() + 30 * 86400_000);
  const updated = await prisma.fotorankContest.updateMany({
    where: { slug: "santa-fe-en-foco" },
    data: {
      registrationEnabled: true,
      registrationOpensAt: opens,
      registrationClosesAt: closes,
      submissionOpensAt: opens,
      submissionDeadline: closes,
      status: "PUBLISHED",
      visibility: "PUBLIC",
    },
  });
  console.log(JSON.stringify({ ok: true, updated: updated.count, opens, closes }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
