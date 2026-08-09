/**
 * ETAPA 14 — probe biblioteca + counts comerciales (read-only).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INITIAL_SOURCE_PREFIX } from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) throw new Error("DATABASE_URL missing");
  console.log("host", new URL(url).hostname);

  const prisma = new PrismaClient();
  const themes = await prisma.photoPromptTheme.count({ where: { active: true } });
  const items = await prisma.photoPromptLibraryItem.count();
  const initial = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  const byStatus = await prisma.photoPromptLibraryItem.groupBy({
    by: ["status"],
    _count: true,
  });
  const cineTheme = await prisma.photoPromptTheme.findFirst({
    where: { slug: "cine" },
    select: { id: true },
  });
  const cine = cineTheme
    ? await prisma.photoPromptLibraryItem.count({ where: { themeId: cineTheme.id } })
    : 0;
  const commercial = {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
  };
  const sample = await prisma.photoPromptLibraryItem.findMany({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
    select: { id: true, title: true, status: true, theme: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
    take: 5,
  });

  console.log(
    JSON.stringify(
      { themes, items, initial, byStatus, cine, commercial, sample },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
