/**
 * Cleanup fixtures ETAPA 11 (sfef11-*@fotorank.test).
 * Dry-run por defecto. Apply: SFEF11_ALLOW_CLEANUP=1
 */
import { prisma } from "@repo/db";

async function main() {
  const allow = process.env.SFEF11_ALLOW_CLEANUP === "1";
  const dryRun = process.env.DRY_RUN === "1" || !allow;

  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@fotorank.test", contains: "sfef11" } },
    select: { id: true, email: true, globalRole: true },
  });
  const judgeAccounts = await prisma.fotorankJudgeAccount.findMany({
    where: { email: { endsWith: "@fotorank.test", contains: "sfef11" } },
    select: { id: true, email: true },
  });

  console.log(
    JSON.stringify(
      {
        dryRun,
        users: users.map((u) => u.email.replace(/(.{4}).+(@.+)/, "$1***$2")),
        judges: judgeAccounts.map((j) => j.email.replace(/(.{4}).+(@.+)/, "$1***$2")),
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log(JSON.stringify({ note: "Set SFEF11_ALLOW_CLEANUP=1 (y DRY_RUN≠1) para borrar" }));
    await prisma.$disconnect();
    return;
  }

  const userIds = users.map((u) => u.id);
  const judgeIds = judgeAccounts.map((j) => j.id);

  if (judgeIds.length) {
    await prisma.fotorankJudgeAssignment.deleteMany({
      where: { judgeAccountId: { in: judgeIds } },
    });
    await prisma.fotorankJudgeAccount.deleteMany({ where: { id: { in: judgeIds } } });
  }

  if (userIds.length) {
    const regs = await prisma.fotorankContestRegistration.findMany({
      where: { participantUserId: { in: userIds } },
      select: { id: true },
    });
    const regIds = regs.map((r) => r.id);
    if (regIds.length) {
      const entries = await prisma.fotorankContestEntry.findMany({
        where: { registrationId: { in: regIds } },
        select: { id: true },
      });
      const entryIds = entries.map((e) => e.id);
      if (entryIds.length) {
        await prisma.fotorankContestEntryCheck.deleteMany({
          where: { entryId: { in: entryIds } },
        });
        await prisma.fotorankContestEntryAsset.deleteMany({
          where: { entryId: { in: entryIds } },
        });
        await prisma.fotorankContestEntry.deleteMany({ where: { id: { in: entryIds } } });
      }
      await prisma.fotorankContestRegistration.deleteMany({ where: { id: { in: regIds } } });
    }
    await prisma.contestOrganizationMember.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    try {
      await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    } catch {
      /* optional */
    }
    // Revocar SA fixture antes de borrar
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const residualUsers = await prisma.user.count({
    where: { email: { endsWith: "@fotorank.test", contains: "sfef11" } },
  });
  const residualJudges = await prisma.fotorankJudgeAccount.count({
    where: { email: { endsWith: "@fotorank.test", contains: "sfef11" } },
  });
  console.log(JSON.stringify({ residualUsers, residualJudges, deleted: userIds.length }));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
