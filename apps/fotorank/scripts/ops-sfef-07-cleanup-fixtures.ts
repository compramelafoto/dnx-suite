/**
 * Cleanup seguro fixtures SFEF07 — solo staging, dry-run por defecto.
 *
 * Uso:
 *   DRY_RUN=1 pnpm ... ops-sfef-07-cleanup-fixtures.ts
 *   APPLY=1 pnpm ... ops-sfef-07-cleanup-fixtures.ts
 */
import { prisma } from "@repo/db";

function assertStaging() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }
  if (process.env.VERCEL_ENV === "production") throw new Error("ABORT production");
}

async function main() {
  assertStaging();
  const apply = process.env.APPLY === "1";
  const dryRun = !apply;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    select: { id: true, organizationId: true },
  });
  if (!contest) throw new Error("contest missing");

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@fotorank.test" },
      OR: [
        { email: { startsWith: "sfef07-org-" } },
        { email: { startsWith: "sfef07-part-" } },
      ],
    },
    select: { id: true, email: true },
  });
  for (const u of users) {
    if (!u.email.endsWith("@fotorank.test") || !u.email.startsWith("sfef07-")) {
      throw new Error(`unsafe email ${u.email}`);
    }
  }

  const judges = await prisma.fotorankJudgeAccount.findMany({
    where: {
      email: { endsWith: "@fotorank.test", startsWith: "sfef07-judge-" },
    },
    select: { id: true, email: true },
  });
  for (const j of judges) {
    if (!j.email.endsWith("@fotorank.test") || !j.email.startsWith("sfef07-judge-")) {
      throw new Error(`unsafe judge ${j.email}`);
    }
  }

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
    dryRun,
    apply,
    contestId: contest.id,
    users: users.length,
    judges: judges.length,
    registrations: regs.length,
    entries: entries.length,
    snapshots: snapshots.length,
    userEmails: users.map((u) => u.email),
    judgeEmails: judges.map((j) => j.email),
  };

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, ...inventory, note: "Set APPLY=1 to delete" }, null, 2));
    return;
  }

  if (snapshotIds.length) {
    const evals = await prisma.fotorankJuryEvaluation.findMany({
      where: { contestId: contest.id, juryEntrySnapshotId: { in: snapshotIds } },
      select: { id: true },
    });
    const evalIds = evals.map((e) => e.id);
    if (evalIds.length) {
      await prisma.fotorankJuryCriterionScore.deleteMany({
        where: { evaluationId: { in: evalIds } },
      });
      await prisma.fotorankJuryEvaluation.deleteMany({ where: { id: { in: evalIds } } });
    }
    await prisma.fotorankJuryPreliminaryAggregate.deleteMany({
      where: { juryEntrySnapshotId: { in: snapshotIds } },
    });
    await prisma.fotorankResultEntry.deleteMany({
      where: { juryEntrySnapshotId: { in: snapshotIds } },
    });
  }

  if (entryIds.length) {
    await prisma.fotorankJudgeEntryConflict.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankJuryEntrySnapshot.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntryReview.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryCheck.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryAsset.deleteMany({ where: { entryId: { in: entryIds } } });
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
    // Sesiones / perfiles / auditoría antes del User (FK sin cascade).
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankProfile.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
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
