/**
 * ETAPA 12 — cleanup SOLO fixture (AND estricto), incluye inscripciones de
 * Modo Test (isOpsTest) creadas por ops-12-demo-e2e.ts sobre la misma edición.
 *
 * Dry-run por defecto. Apply:
 *   SFEF12_ALLOW_CLEANUP=1 SFEF12_APPLY=1 \
 *   SFEF12_EDITION_ID=... DATABASE_URL=... \
 *   pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-12-fixture-cleanup.ts
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"));
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const SLUG_PREFIX = "clickaton-fr-12-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const FIXTURE_EMAIL_PREFIX_RE = /^clickaton12-/i;

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
  const apply = process.env.SFEF12_ALLOW_CLEANUP === "1" && process.env.SFEF12_APPLY === "1";
  const credsPath = process.env.SFEF12_CREDS_PATH ?? "/tmp/clickaton-12-fixture.env";
  const file = loadEnvFile(credsPath);
  const editionId = process.env.SFEF12_EDITION_ID ?? file.SFEF12_EDITION_ID;
  const contestId = process.env.SFEF12_CONTEST_ID ?? file.SFEF12_CONTEST_ID;
  if (!editionId || !contestId) throw new Error("ABORT missing edition/contest ids");

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
    throw new Error("ABORT slug no es fixture 12");
  }
  if (edition.fotorankContestId !== contestId) {
    throw new Error("ABORT contest mismatch");
  }

  // AND estricto: edición exacta + isOpsFixture + slug prefix + TODAS las
  // inscripciones (fixture base + Modo Test isOpsTest) con email @fotorank.test.
  const regs = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    select: { id: true, email: true, userId: true, isOpsTest: true },
  });
  for (const r of regs) {
    if (!FIXTURE_EMAIL_RE.test(r.email)) {
      throw new Error(`ABORT email no fixture: ${r.email.replace(/(.{3}).+(@.+)/, "$1***$2")}`);
    }
  }

  const plan = {
    apply,
    editionId,
    contestId,
    registrations: regs.length,
    testModeRegistrations: regs.filter((r) => r.isOpsTest).length,
    prompts: await prisma.clickatonPrompt.count({ where: { editionId } }),
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
    syncs: await prisma.clickatonFotoRankSync.count({ where: { editionId } }),
    frEntries: await prisma.fotorankContestEntry.count({ where: { contestId } }),
    frAssets: await prisma.fotorankContestEntryAsset.count({ where: { contestId } }),
    frParticipants: await prisma.fotorankContestParticipant.count({ where: { contestId } }),
  };
  console.log(JSON.stringify({ dryRun: !apply, plan }, null, 2));

  if (!apply) {
    console.log(JSON.stringify({ note: "Set SFEF12_ALLOW_CLEANUP=1 SFEF12_APPLY=1 para borrar" }));
    await prisma.$disconnect();
    return;
  }

  const entryIds = (
    await prisma.fotorankContestEntry.findMany({ where: { contestId }, select: { id: true } })
  ).map((e: { id: string }) => e.id);

  // Assets / entries / participantes (solo contest fixture).
  if (entryIds.length) {
    await prisma.fotorankContestEntryMetadata.deleteMany({
      where: { entryAsset: { entryId: { in: entryIds } } },
    });
    await prisma.fotorankContestEntryCheck.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryAsset.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntry.deleteMany({ where: { id: { in: entryIds } } });
  }
  await prisma.fotorankContestParticipant.deleteMany({ where: { contestId } });

  // Submissions / sync / outbox / regs (fixture + Modo Test) / prompts / ticket / uploadConfig / edición.
  await prisma.clickatonPhotoSubmission.deleteMany({ where: { editionId } });
  await prisma.clickatonFotoRankSync.deleteMany({ where: { editionId } }).catch(() => null);
  await prisma.clickatonIntegrationOutboxEvent.deleteMany({ where: { editionId } }).catch(() => null);
  await prisma.clickatonRegistration.deleteMany({ where: { editionId } });
  await prisma.clickatonPrompt.deleteMany({ where: { editionId } });
  await prisma.clickatonTicketType.deleteMany({ where: { editionId } });
  await prisma.clickatonEditionUploadConfig.deleteMany({ where: { editionId } });
  await prisma.clickatonEdition.delete({ where: { id: editionId } });

  await prisma.fotorankContestCategory.deleteMany({ where: { contestId } });
  await prisma.fotorankContest.delete({ where: { id: contestId } });

  const orgId = file.SFEF12_ORG_ID;
  if (orgId) {
    const left = await prisma.fotorankContest.count({ where: { organizationId: orgId } });
    if (left === 0) {
      await prisma.contestOrganizationMember.deleteMany({ where: { organizationId: orgId } });
      await prisma.contestOrganization.delete({ where: { id: orgId } }).catch(() => null);
    }
  }

  // Users fixture (registración base + Modo Test): solo si no tienen otras
  // registraciones y el email es fixture @fotorank.test con prefijo clickaton12-.
  for (const r of regs) {
    if (!r.userId) continue;
    const email = r.email;
    if (!FIXTURE_EMAIL_RE.test(email) || !FIXTURE_EMAIL_PREFIX_RE.test(email)) continue;
    const otherRegs = await prisma.clickatonRegistration.count({ where: { userId: r.userId } });
    if (otherRegs === 0) {
      await prisma.user.delete({ where: { id: r.userId } }).catch(() => null);
    }
  }

  const commercialAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  const commercialApprovedAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
  });
  const commercialPaidOrdersAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
  });
  console.log(
    JSON.stringify({
      ok: true,
      applied: true,
      commercialRegCountAfter: commercialAfter,
      commercialRegCountBefore: file.SFEF12_COMMERCIAL_REG_COUNT_BEFORE,
      commercialApprovedCountAfter: commercialApprovedAfter,
      commercialApprovedCountBefore: file.SFEF12_COMMERCIAL_APPROVED_BEFORE,
      commercialPaidOrdersCountAfter: commercialPaidOrdersAfter,
      commercialPaidOrdersCountBefore: file.SFEF12_COMMERCIAL_PAID_BEFORE,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
