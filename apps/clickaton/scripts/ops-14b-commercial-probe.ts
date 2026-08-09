/**
 * ETAPA 14B — probe edición comercial + 12 APPROVED (read-only).
 */
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INITIAL_SOURCE_PREFIX } from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL = "cmrvq7liy0000l904s25767xe";

async function main() {
  const prisma = new PrismaClient();
  const commercial = {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL },
    }),
  };

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: COMMERCIAL },
    include: { uploadConfig: true },
  });

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId: COMMERCIAL, status: { not: "CANCELLED" } },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      status: true,
      title: true,
      titleSnapshot: true,
      libraryItemId: true,
      libraryVersion: true,
    },
  });

  const approved = await prisma.photoPromptLibraryItem.findMany({
    where: {
      status: "APPROVED",
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
    },
    orderBy: [{ theme: { sortOrder: "asc" } }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      difficulty: true,
      inspirationType: true,
      inspirationLabel: true,
      version: true,
      theme: { select: { name: true } },
      subtheme: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
  });

  const summary = {
    commercial,
    edition: edition
      ? {
          id: edition.id,
          name: edition.name,
          slug: edition.slug,
          status: edition.status,
          isPublished: edition.isPublished,
          isOpsFixture: edition.isOpsFixture,
          timezone: edition.timezone,
          fotorankContestId: edition.fotorankContestId,
          uploadsEnabled: edition.uploadConfig?.uploadsEnabled ?? null,
          canonicalAssetsEnabled: edition.uploadConfig?.canonicalAssetsEnabled ?? null,
          globalPromptReveal: edition.uploadConfig?.globalPromptReveal ?? null,
          eventRevealAt: edition.uploadConfig?.eventRevealAt ?? null,
          captureWindowStartsAt: edition.uploadConfig?.captureWindowStartsAt ?? null,
          captureWindowEndsAt: edition.uploadConfig?.captureWindowEndsAt ?? null,
          uploadWindowStartsAt: edition.uploadConfig?.uploadWindowStartsAt ?? null,
          uploadWindowEndsAt: edition.uploadConfig?.uploadWindowEndsAt ?? null,
          allowReplacement: edition.uploadConfig?.allowReplacement ?? null,
        }
      : null,
    promptsCount: prompts.length,
    prompts,
    approvedCount: approved.length,
    approved: approved.map((a, i) => ({
      n: i + 1,
      id: a.id,
      title: a.title,
      theme: a.theme.name,
      subtheme: a.subtheme?.name ?? null,
      description: a.description,
      difficulty: a.difficulty,
      inspirationType: a.inspirationType,
      inspirationLabel: a.inspirationLabel,
      usageCount: a._count.assignments,
      lastUsedAt: null,
    })),
    selection: "PENDING_OPERATOR_SELECTION",
  };

  writeFileSync("/tmp/14b-commercial-probe.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
