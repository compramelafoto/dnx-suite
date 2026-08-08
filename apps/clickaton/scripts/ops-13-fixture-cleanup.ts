/**
 * ETAPA 13 — cleanup SOLO fixture (AND estricto).
 * NUNCA borra ítems del catálogo INITIAL_DNX_PROMPT_LIBRARY_2026 (55).
 * Solo elimina ítems OPS13_* del exec + edición fixture.
 *
 * Dry-run por defecto. Apply:
 *   SFEF13_ALLOW_CLEANUP=1 SFEF13_APPLY=1 \
 *   SFEF13_EDITION_ID=... DATABASE_URL=... \
 *   pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-13-fixture-cleanup.ts
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
const SLUG_PREFIX = "clickaton-fr-13-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const FIXTURE_EMAIL_PREFIX_RE = /^clickaton13-/i;

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
    process.env.SFEF13_ALLOW_CLEANUP === "1" && process.env.SFEF13_APPLY === "1";
  const credsPath = process.env.SFEF13_CREDS_PATH ?? "/tmp/clickaton-13-fixture.env";
  const file = loadEnvFile(credsPath);
  const editionId = process.env.SFEF13_EDITION_ID ?? file.SFEF13_EDITION_ID;
  const contestId = process.env.SFEF13_CONTEST_ID ?? file.SFEF13_CONTEST_ID;
  const execId = process.env.SFEF13_EXEC_ID ?? file.SFEF13_EXEC_ID;
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
    throw new Error("ABORT slug no es fixture 13");
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

  const opsItems = await prisma.photoPromptLibraryItem.findMany({
    where: {
      OR: [
        { sourceKey: { startsWith: `OPS13_APPROVED_${execId}` } },
        { sourceKey: { startsWith: `OPS13_DRAFT_${execId}` } },
        { sourceKey: { startsWith: `OPS13_E2E_${execId}` } },
        { sourceKey: { startsWith: `OPS13_E2E_DRAFT_${execId}` } },
        { sourceKey: `OPS13_DRAFT_${execId}` },
        {
          AND: [
            { sourceKey: { startsWith: "OPS13_" } },
            { metadataJson: { path: ["execId"], equals: execId } },
          ],
        },
      ],
    },
    select: { id: true, sourceKey: true },
  });

  for (const item of opsItems) {
    if (item.sourceKey?.startsWith(INITIAL_SOURCE_PREFIX)) {
      throw new Error("ABORT attempted delete of catalog item");
    }
  }

  const catalogCount = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
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
    opsLibraryItemsToDelete: opsItems.length,
    catalogItemsProtected: catalogCount,
    note: "Catalog INITIAL_* never deleted",
  };
  console.log(JSON.stringify({ dryRun: !apply, plan }, null, 2));

  if (!apply) {
    console.log(
      JSON.stringify({
        note: "Set SFEF13_ALLOW_CLEANUP=1 SFEF13_APPLY=1 para borrar",
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

  const orgId = file.SFEF13_ORG_ID;
  if (orgId) {
    const left = await prisma.fotorankContest.count({ where: { organizationId: orgId } });
    if (left === 0) {
      await prisma.contestOrganizationMember.deleteMany({
        where: { organizationId: orgId },
      });
      await prisma.contestOrganization.delete({ where: { id: orgId } }).catch(() => null);
    }
  }

  // Borrar solo ítems OPS13 del exec (auditoría/versiones en cascade).
  const opsIds = opsItems.map((i) => i.id);
  if (opsIds.length) {
    await prisma.photoPromptLibraryAuditEvent.deleteMany({
      where: { libraryItemId: { in: opsIds } },
    });
    await prisma.photoPromptLibraryVersion.deleteMany({
      where: { libraryItemId: { in: opsIds } },
    });
    await prisma.photoPromptLibraryItem.deleteMany({
      where: {
        id: { in: opsIds },
        sourceKey: { startsWith: "OPS13_" },
        NOT: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
      },
    });
  }

  for (const r of regs) {
    if (!r.userId) continue;
    const email = r.email;
    if (!FIXTURE_EMAIL_RE.test(email) || !FIXTURE_EMAIL_PREFIX_RE.test(email)) continue;
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
  if (catalogAfter < 55 && catalogAfter < catalogCount) {
    throw new Error(
      `ABORT catalog shrunk unexpectedly: before=${catalogCount} after=${catalogAfter}`,
    );
  }

  const commercialAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });

  console.log(
    JSON.stringify({
      ok: true,
      applied: true,
      catalogCountAfter: catalogAfter,
      catalogCountBeforeCleanup: catalogCount,
      commercialRegCountAfter: commercialAfter,
      commercialRegCountBefore: file.SFEF13_COMMERCIAL_REG_COUNT_BEFORE,
      deletedOpsLibraryItems: opsIds.length,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
