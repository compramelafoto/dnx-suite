/**
 * Cleanup SFEF08 — staging only. APPLY=1 para borrar.
 */
import { prisma } from "@repo/db";

function assertStaging() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }
}

async function main() {
  assertStaging();
  const apply = process.env.APPLY === "1";

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    select: { id: true, organizationId: true },
  });
  if (!contest) throw new Error("contest missing");

  const users = await prisma.user.findMany({
    where: { email: { startsWith: "sfef08-", endsWith: "@fotorank.test" } },
    select: { id: true },
  });
  const judges = await prisma.fotorankJudgeAccount.findMany({
    where: { email: { startsWith: "sfef08-", endsWith: "@fotorank.test" } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const judgeIds = judges.map((j) => j.id);

  const regs = userIds.length
    ? await prisma.fotorankContestRegistration.findMany({
        where: { contestId: contest.id, participantUserId: { in: userIds } },
        select: { id: true },
      })
    : [];
  const regIds = regs.map((r) => r.id);
  const entries = regIds.length
    ? await prisma.fotorankContestEntry.findMany({
        where: { contestId: contest.id, registrationId: { in: regIds } },
        select: { id: true },
      })
    : [];
  const entryIds = entries.map((e) => e.id);
  const snapshots = entryIds.length
    ? await prisma.fotorankJuryEntrySnapshot.findMany({
        where: { contestId: contest.id, entryId: { in: entryIds } },
        select: { id: true },
      })
    : [];
  const snapshotIds = snapshots.map((s) => s.id);

  const inventory = {
    dryRun: !apply,
    users: users.length,
    judges: judges.length,
    entries: entries.length,
    snapshots: snapshots.length,
  };
  if (!apply) {
    console.log(JSON.stringify({ ok: true, ...inventory, note: "APPLY=1 to delete" }, null, 2));
    return;
  }

  // Revocar publicaciones staging de batches ligados a estos snapshots
  if (snapshotIds.length) {
    const resultEntries = await prisma.fotorankResultEntry.findMany({
      where: { juryEntrySnapshotId: { in: snapshotIds } },
      select: { resultBatchId: true },
    });
    const batchIds = [...new Set(resultEntries.map((r) => r.resultBatchId))];
    for (const bid of batchIds) {
      await prisma.fotorankResultRevision.deleteMany({ where: { resultBatchId: bid } });
      await prisma.fotorankTieBreakSession.deleteMany({ where: { resultBatchId: bid } });
      await prisma.fotorankResultEntry.deleteMany({ where: { resultBatchId: bid } });
      await prisma.fotorankResultBatch.deleteMany({ where: { id: bid } });
    }

    const evals = await prisma.fotorankJuryEvaluation.findMany({
      where: { contestId: contest.id, juryEntrySnapshotId: { in: snapshotIds } },
      select: { id: true },
    });
    const evalIds = evals.map((e) => e.id);
    if (evalIds.length) {
      await prisma.fotorankJuryCriterionScore.deleteMany({ where: { evaluationId: { in: evalIds } } });
      await prisma.fotorankJuryEvaluation.deleteMany({ where: { id: { in: evalIds } } });
    }
    await prisma.fotorankJuryPreliminaryAggregate.deleteMany({
      where: { juryEntrySnapshotId: { in: snapshotIds } },
    });
    await prisma.fotorankJuryEntrySnapshot.deleteMany({ where: { id: { in: snapshotIds } } });
  }

  if (entryIds.length) {
    await prisma.fotorankContestEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { activeAssetId: null },
    });
    await prisma.fotorankContestEntryAsset.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankJudgeEntryConflict.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntry.deleteMany({ where: { id: { in: entryIds } } });
  }
  if (regIds.length) {
    await prisma.fotorankContestRegistration.deleteMany({ where: { id: { in: regIds } } });
  }
  if (judgeIds.length) {
    await prisma.fotorankJudgeAssignment.deleteMany({
      where: { contestId: contest.id, judgeAccountId: { in: judgeIds } },
    });
    await prisma.fotorankJudgeOrganizationMembership.deleteMany({
      where: { judgeAccountId: { in: judgeIds } },
    });
    await prisma.fotorankJudgeProfile.deleteMany({ where: { judgeAccountId: { in: judgeIds } } });
    await prisma.fotorankJudgeAccount.deleteMany({ where: { id: { in: judgeIds } } });
  }
  if (userIds.length) {
    await prisma.contestOrganizationMember.deleteMany({
      where: { organizationId: contest.organizationId, userId: { in: userIds } },
    });
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log(JSON.stringify({ ok: true, applied: true, ...inventory }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
