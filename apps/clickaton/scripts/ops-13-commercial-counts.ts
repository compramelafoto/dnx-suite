/**
 * ETAPA 13 — conteos comerciales (antes/después).
 *
 *   DATABASE_URL=... pnpm --filter clickaton ops:13:counts
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../packages/db/package.json",
  ),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID =
  process.env.SFEF13_COMMERCIAL_EDITION_ID ?? "cmrvq7liy0000l904s25767xe";

export async function getCommercialCounts(prisma: InstanceType<typeof PrismaClient>) {
  const editionId = COMMERCIAL_EDITION_ID;
  const [
    editions,
    registrations,
    approved,
    paid,
    orders,
    participants,
    submissions,
  ] = await Promise.all([
    prisma.clickatonEdition.count({
      where: { id: editionId, isOpsFixture: false },
    }),
    prisma.clickatonRegistration.count({ where: { editionId } }),
    prisma.clickatonRegistration.count({
      where: { editionId, paymentStatus: "APPROVED" },
    }),
    prisma.clickatonRegistration.count({
      where: { editionId, paymentOrderId: { not: null } },
    }),
    prisma.clickatonRegistration.count({
      where: { editionId, paymentOrderId: { not: null } },
    }),
    prisma.clickatonRegistration.count({
      where: { editionId, status: "CONFIRMED" },
    }),
    prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
  ]);

  return {
    commercialEditionId: editionId,
    editions,
    registrations,
    approved,
    paid,
    orders,
    participants,
    submissions,
  };
}

async function main() {
  const label = process.env.SFEF13_COUNTS_LABEL ?? "snapshot";
  const prisma = new PrismaClient();
  try {
    const counts = await getCommercialCounts(prisma);
    console.log(JSON.stringify({ ok: true, label, ...counts }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
