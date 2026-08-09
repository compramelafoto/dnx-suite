/**
 * ETAPA 14 — cleanup SOLO fixture (AND estricto).
 * NUNCA borra ítems del catálogo INITIAL_* (55).
 * NUNCA revierte APPROVED globales del subconjunto.
 *
 * Dry-run por defecto. Apply:
 *   SFEF14_ALLOW_CLEANUP=1 SFEF14_APPLY=1 \
 *   DATABASE_URL=... \
 *   pnpm --filter clickaton exec tsx scripts/ops-14-fixture-cleanup.ts
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INITIAL_SOURCE_PREFIX } from "@repo/photo-prompt-library";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const SLUG_PREFIX = "clickaton-fr-14-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const FIXTURE_EMAIL_PREFIX_RE = /^clickaton14-/i;

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

async function main() {
  const apply =
    process.env.SFEF14_ALLOW_CLEANUP === "1" && process.env.SFEF14_APPLY === "1";
  const credsPath = process.env.SFEF14_CREDS_PATH ?? "/tmp/clickaton-14-fixture.env";
  const file = loadEnvFile(credsPath);
  const editionId = process.env.SFEF14_EDITION_ID ?? file.SFEF14_EDITION_ID;
  const contestId = process.env.SFEF14_CONTEST_ID ?? file.SFEF14_CONTEST_ID;
  const execId = process.env.SFEF14_EXEC_ID ?? file.SFEF14_EXEC_ID;
  if (!editionId || !contestId || !execId) {
    throw new Error("ABORT missing edition/contest/exec ids");
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no productivo dawn-dew");
  }

  const prisma = new PrismaClient();
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { id: true, slug: true, isOpsFixture: true, fotorankContestId: true },
  });
  if (!edition) throw new Error("ABORT edition not found");
  if (edition.id === COMMERCIAL_EDITION_ID) throw new Error("ABORT commercial edition denied");
  if (!edition.isOpsFixture) throw new Error("ABORT isOpsFixture=false");
  if (!edition.slug.startsWith(SLUG_PREFIX)) {
    throw new Error("ABORT slug no es fixture 14");
  }
  if (edition.fotorankContestId !== contestId) {
    throw new Error("ABORT contest mismatch");
  }

  const regs = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    select: { id: true, email: true, userId: true, isOpsTest: true },
  });
  for (const r of regs) {
    if (!FIXTURE_EMAIL_RE.test(r.email)) {
      throw new Error(
        `ABORT email no fixture: ${r.email.replace(/(.{3}).+(@.+)/, "$1***$2")}`,
      );
    }
  }

  const catalogCount = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  const approvedCatalog = await prisma.photoPromptLibraryItem.count({
    where: {
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
      status: "APPROVED",
    },
  });

  const plan = {
    apply,
    editionId,
    contestId,
    execId,
    registrations: regs.length,
    testModeRegistrations: regs.filter((r) => r.isOpsTest).length,
    prompts: await prisma.clickatonPrompt.count({ where: { editionId } }),
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
    catalogItemsProtected: catalogCount,
    approvedCatalogPreserved: approvedCatalog,
    note: "Catalog INITIAL_* never deleted; APPROVED globals preserved",
  };
  console.log(JSON.stringify({ dryRun: !apply, plan }, null, 2));

  if (!apply) {
    console.log(
      JSON.stringify({
        note: "Set SFEF14_ALLOW_CLEANUP=1 SFEF14_APPLY=1 para borrar",
      }),
    );
    await prisma.$disconnect();
    return;
  }

  const entryIds = (
    await prisma.fotorankContestEntry.findMany({
      where: { contestId },
      select: { id: true },
    })
  ).map((e: { id: string }) => e.id);

  if (entryIds.length) {
    await prisma.fotorankContestEntryMetadata.deleteMany({
      where: { entryAsset: { entryId: { in: entryIds } } },
    });
    await prisma.fotorankContestEntryCheck.deleteMany({
      where: { entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntryAsset.deleteMany({
      where: { entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntry.deleteMany({ where: { id: { in: entryIds } } });
  }
  await prisma.fotorankContestParticipant.deleteMany({ where: { contestId } });

  await prisma.clickatonPhotoSubmission.deleteMany({ where: { editionId } });
  await prisma.clickatonFotoRankSync.deleteMany({ where: { editionId } }).catch(() => null);
  await prisma.clickatonIntegrationOutboxEvent
    .deleteMany({ where: { editionId } })
    .catch(() => null);
  await prisma.clickatonRegistration.deleteMany({ where: { editionId } });
  await prisma.clickatonPrompt.deleteMany({ where: { editionId } });
  await prisma.clickatonTicketType.deleteMany({ where: { editionId } });
  await prisma.clickatonEditionUploadConfig.deleteMany({ where: { editionId } });
  await prisma.clickatonEdition.delete({ where: { id: editionId } });

  await prisma.fotorankContestCategory.deleteMany({ where: { contestId } });
  await prisma.fotorankContest.delete({ where: { id: contestId } });

  const orgId = file.SFEF14_ORG_ID;
  if (orgId) {
    const left = await prisma.fotorankContest.count({ where: { organizationId: orgId } });
    if (left === 0) {
      await prisma.contestOrganizationMember.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.contestOrganization.delete({ where: { id: orgId } }).catch(() => null);
    }
  }

  for (const r of regs) {
    if (!r.userId) continue;
    if (!FIXTURE_EMAIL_RE.test(r.email) || !FIXTURE_EMAIL_PREFIX_RE.test(r.email)) continue;
    const otherRegs = await prisma.clickatonRegistration.count({
      where: { userId: r.userId },
    });
    if (otherRegs === 0) {
      await prisma.user.delete({ where: { id: r.userId } }).catch(() => null);
    }
  }

  const catalogAfter = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  if (catalogAfter !== 55) {
    throw new Error(`ABORT catalog size after cleanup: ${catalogAfter}`);
  }
  const approvedAfter = await prisma.photoPromptLibraryItem.count({
    where: {
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
      status: "APPROVED",
    },
  });

  const commercialAfter = {
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

  const residualEditions = await prisma.clickatonEdition.count({
    where: { slug: { startsWith: SLUG_PREFIX }, isOpsFixture: true },
  });

  console.log(
    JSON.stringify({
      ok: true,
      applied: true,
      catalogCountAfter: catalogAfter,
      approvedCatalogAfter: approvedAfter,
      commercialAfter,
      residualFixtureEditions: residualEditions,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
