/**
 * ETAPA 11D — cleanup SOLO fixture (AND estricto).
 *
 * Dry-run default. Apply:
 *   SFEF11D_ALLOW_CLEANUP=1 SFEF11D_APPLY=1 \
 *   SFEF11D_EDITION_ID=... DATABASE_URL=... \
 *   pnpm --filter @repo/db exec tsx ../../apps/clickaton/scripts/ops-11d-fixture-cleanup.ts
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;

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
  const apply = process.env.SFEF11D_ALLOW_CLEANUP === "1" && process.env.SFEF11D_APPLY === "1";
  const file = loadEnvFile(process.env.SFEF11D_CREDS_PATH ?? "/tmp/clickaton-11d-fixture.env");
  const editionId = process.env.SFEF11D_EDITION_ID ?? file.SFEF11D_EDITION_ID;
  const contestId = process.env.SFEF11D_CONTEST_ID ?? file.SFEF11D_CONTEST_ID;
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
  if (!edition.slug.startsWith("clickaton-fr-assets-fixture-")) {
    throw new Error("ABORT slug no es fixture");
  }
  if (edition.fotorankContestId !== contestId) {
    throw new Error("ABORT contest mismatch");
  }

  const regs = await prisma.clickatonRegistration.findMany({
    where: { editionId },
    select: { id: true, email: true, userId: true },
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
    prompts: await prisma.clickatonPrompt.count({ where: { editionId } }),
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
    syncs: await prisma.clickatonFotoRankSync.count({ where: { editionId } }),
    frEntries: await prisma.fotorankContestEntry.count({ where: { contestId } }),
    frAssets: await prisma.fotorankContestEntryAsset.count({ where: { contestId } }),
    frParticipants: await prisma.fotorankContestParticipant.count({ where: { contestId } }),
  };
  console.log(JSON.stringify({ dryRun: !apply, plan }, null, 2));

  if (!apply) {
    console.log(JSON.stringify({ note: "Set SFEF11D_ALLOW_CLEANUP=1 SFEF11D_APPLY=1 para borrar" }));
    await prisma.$disconnect();
    return;
  }

  // Orden seguro: submissions → sync/outbox → regs → prompts → uploadConfig → edition
  // FR: assets → entries → participants → contest categories → contest → org if fixture-only
  const entryIds = (
    await prisma.fotorankContestEntry.findMany({ where: { contestId }, select: { id: true } })
  ).map((e) => e.id);

  // Jury / scoring / admission batch (solo contest fixture)
  await prisma.fotorankJuryCriterionScore.deleteMany({ where: { evaluation: { contestId } } }).catch(() => null);
  await prisma.fotorankJuryEvaluation.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryPreliminaryAggregate.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryEntrySnapshot.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryScoringSession.deleteMany({ where: { contestId } });
  await prisma.fotorankJuryCriterion.deleteMany({ where: { rubric: { contestId } } });
  await prisma.fotorankJuryRubric.deleteMany({ where: { contestId } });
  await prisma.fotorankJudgeAssignment.deleteMany({ where: { contestId } });
  await prisma.fotorankAdmissionBatch.deleteMany({ where: { contestId } });
  const judgeId = file.SFEF11D_JUDGE_ACCOUNT_ID;
  if (judgeId) {
    await prisma.fotorankJudgeProfile.deleteMany({ where: { judgeAccountId: judgeId } });
    await prisma.fotorankJudgeOrganizationMembership.deleteMany({ where: { judgeAccountId: judgeId } });
    await prisma.fotorankJudgeAccount.delete({ where: { id: judgeId } }).catch(() => null);
  }
  const wsId = file.SFEF11D_JURY_WORKSPACE_ID;
  if (wsId) {
    await prisma.workspace.delete({ where: { id: wsId } }).catch(() => null);
  }

  if (entryIds.length) {
    await prisma.fotorankContestEntryMetadata.deleteMany({
      where: { entryAsset: { entryId: { in: entryIds } } },
    });
    await prisma.fotorankContestEntryCheck.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryAsset.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntry.deleteMany({ where: { id: { in: entryIds } } });
  }
  await prisma.fotorankContestParticipant.deleteMany({ where: { contestId } });

  await prisma.clickatonPhotoSubmission.deleteMany({ where: { editionId } });
  await prisma.clickatonFotoRankSync.deleteMany({ where: { editionId } });
  await prisma.clickatonIntegrationOutboxEvent.deleteMany({ where: { editionId } });
  await prisma.clickatonRegistration.deleteMany({ where: { editionId } });
  await prisma.clickatonPrompt.deleteMany({ where: { editionId } });
  await prisma.clickatonTicketType.deleteMany({ where: { editionId } });
  await prisma.clickatonEditionUploadConfig.deleteMany({ where: { editionId } });
  await prisma.clickatonEdition.delete({ where: { id: editionId } });

  await prisma.fotorankContestCategory.deleteMany({ where: { contestId } });
  await prisma.fotorankContest.delete({ where: { id: contestId } });

  const orgId = file.SFEF11D_ORG_ID;
  if (orgId) {
    const left = await prisma.fotorankContest.count({ where: { organizationId: orgId } });
    if (left === 0) {
      await prisma.contestOrganizationMember.deleteMany({ where: { organizationId: orgId } });
      await prisma.contestOrganization.delete({ where: { id: orgId } }).catch(() => null);
    }
  }

  // Users fixture: solo si no tienen otras relaciones críticas — soft leave password users
  for (const r of regs) {
    if (!r.userId) continue;
    const email = r.email;
    if (!FIXTURE_EMAIL_RE.test(email)) continue;
    const otherRegs = await prisma.clickatonRegistration.count({ where: { userId: r.userId } });
    if (otherRegs === 0) {
      await prisma.user.delete({ where: { id: r.userId } }).catch(() => null);
    }
  }

  const commercialAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  console.log(
    JSON.stringify({
      ok: true,
      applied: true,
      commercialRegCountAfter: commercialAfter,
      commercialRegCountBefore: file.SFEF11D_COMMERCIAL_REG_COUNT_BEFORE,
    }),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
