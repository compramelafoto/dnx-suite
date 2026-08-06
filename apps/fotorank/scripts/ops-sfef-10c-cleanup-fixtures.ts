/**
 * Cleanup seguro fixtures SFEF10C — prefijo sfef10c*@fotorank.test únicamente.
 * Dry-run por defecto; aplicar solo con SFEF10C_ALLOW_CLEANUP=1 (y sin DRY_RUN=1).
 *
 * Uso:
 *   DATABASE_URL=... pnpm ... ops-sfef-10c-cleanup-fixtures.ts
 *   SFEF10C_ALLOW_CLEANUP=1 DATABASE_URL=... pnpm ... ops-sfef-10c-cleanup-fixtures.ts
 */
import { prisma } from "@repo/db";
import { getContestEntryStorage } from "../app/lib/fotorank/storage/provider";

const CONTEST_SLUG = "santa-fe-en-foco";

function assertSafeEmail(email: string) {
  if (!email.endsWith("@fotorank.test")) throw new Error(`unsafe email domain: ${email}`);
  if (!email.startsWith("sfef10c")) throw new Error(`unsafe email prefix: ${email}`);
}

async function countInventory(contestId: string, userIds: number[], entryIds: string[]) {
  const regIds =
    userIds.length > 0
      ? (
          await prisma.fotorankContestRegistration.findMany({
            where: { contestId, participantUserId: { in: userIds } },
            select: { id: true },
          })
        ).map((r) => r.id)
      : [];

  const entries =
    entryIds.length > 0
      ? await prisma.fotorankContestEntry.findMany({
          where: { contestId, id: { in: entryIds } },
          select: { id: true, admissionStatus: true },
        })
      : regIds.length > 0
        ? await prisma.fotorankContestEntry.findMany({
            where: { contestId, registrationId: { in: regIds } },
            select: { id: true, admissionStatus: true },
          })
        : [];

  const resolvedEntryIds = [...new Set([...entryIds, ...entries.map((e) => e.id)])];

  const [assets, checks, outbox, auditEmail, orgMembers, sessions] = await Promise.all([
    resolvedEntryIds.length
      ? prisma.fotorankContestEntryAsset.count({ where: { entryId: { in: resolvedEntryIds } } })
      : 0,
    resolvedEntryIds.length
      ? prisma.fotorankContestEntryCheck.count({ where: { entryId: { in: resolvedEntryIds } } })
      : 0,
    resolvedEntryIds.length
      ? prisma.$queryRawUnsafe<Array<{ n: number }>>(
          `SELECT COUNT(*)::int AS n FROM public."FotorankTransactionalEmailOutbox"
           WHERE "entryId" = ANY($1::text[]) AND "kind" LIKE 'PHOTO_%'`,
          resolvedEntryIds,
        ).then((rows) => rows[0]?.n ?? 0)
      : 0,
    resolvedEntryIds.length
      ? prisma.fotorankJudgeAuditEvent.count({
          where: {
            contestId,
            eventType: { startsWith: "EMAIL_" },
            entityId: { in: resolvedEntryIds },
          },
        })
      : 0,
    userIds.length
      ? prisma.contestOrganizationMember.count({
          where: { userId: { in: userIds } },
        })
      : 0,
    userIds.length ? prisma.userSession.count({ where: { userId: { in: userIds } } }) : 0,
  ]);

  return {
    users: userIds.length,
    registrations: regIds.length,
    entries: resolvedEntryIds.length,
    assets,
    checks,
    outboxPhoto: outbox,
    auditEmail,
    orgMembers,
    sessions,
    entryIds: resolvedEntryIds,
    regIds,
  };
}

async function main() {
  const allowCleanup = process.env.SFEF10C_ALLOW_CLEANUP === "1";
  const dryRun = process.env.DRY_RUN === "1" || !allowCleanup;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: CONTEST_SLUG },
    select: { id: true, organizationId: true },
  });
  if (!contest) throw new Error("contest missing");

  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@fotorank.test", startsWith: "sfef10c" },
    },
    select: { id: true, email: true },
  });
  for (const u of users) assertSafeEmail(u.email);

  const userIds = users.map((u) => u.id);
  const before = await countInventory(contest.id, userIds, []);

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun: true,
          apply: false,
          contestId: contest.id,
          before,
          userEmails: users.map((u) => u.email),
          note: "Set SFEF10C_ALLOW_CLEANUP=1 (y DRY_RUN≠1) para borrar",
        },
        null,
        2,
      ),
    );
    return;
  }

  const entryIds = before.entryIds;
  const regIds = before.regIds;

  const storageKeys =
    entryIds.length > 0
      ? (
          await prisma.fotorankContestEntryAsset.findMany({
            where: { entryId: { in: entryIds } },
            select: { storageKey: true, entryId: true },
          })
        )
          .filter((a) => entryIds.some((id) => a.storageKey.includes(id)))
          .map((a) => a.storageKey)
      : [];

  let r2Deleted = 0;
  let r2Errors = 0;
  if (storageKeys.length > 0) {
    try {
      const storage = getContestEntryStorage();
      for (const key of storageKeys) {
        try {
          await storage.deleteObject(key);
          r2Deleted += 1;
        } catch {
          r2Errors += 1;
        }
      }
    } catch {
      // storage no configurado — best-effort
    }
  }

  if (entryIds.length) {
    await prisma.fotorankJuryEntrySnapshot.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntryReview.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryCheck.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."FotorankTransactionalEmailOutbox"
       WHERE "entryId" = ANY($1::text[]) AND "kind" LIKE 'PHOTO_%'`,
      entryIds,
    );
    await prisma.fotorankJudgeAuditEvent.deleteMany({
      where: {
        contestId: contest.id,
        eventType: { startsWith: "EMAIL_" },
        entityId: { in: entryIds },
      },
    });
    await prisma.fotorankContestEntry.updateMany({
      where: { id: { in: entryIds } },
      data: { activeAssetId: null },
    });
    await prisma.fotorankContestEntryAsset.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntry.deleteMany({
      where: { contestId: contest.id, id: { in: entryIds } },
    });
  }

  if (regIds.length) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."FotorankTransactionalEmailOutbox"
       WHERE "registrationId" = ANY($1::text[]) AND "kind" LIKE 'PHOTO_%'`,
      regIds,
    );
    await prisma.fotorankContestRegistration.deleteMany({
      where: { contestId: contest.id, id: { in: regIds } },
    });
  }

  if (userIds.length) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public."FotorankTransactionalEmailOutbox"
       WHERE "toUserId" = ANY($1::int[]) AND "kind" LIKE 'PHOTO_%'`,
      userIds,
    );
    await prisma.contestOrganizationMember.deleteMany({
      where: { organizationId: contest.organizationId, userId: { in: userIds } },
    });
    await prisma.membership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  const after = await countInventory(contest.id, [], []);
  const residualUsers = await prisma.user.count({
    where: { email: { endsWith: "@fotorank.test", startsWith: "sfef10c" } },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        dryRun: false,
        apply: true,
        contestId: contest.id,
        before,
        after,
        r2: { attempted: storageKeys.length, deleted: r2Deleted, errors: r2Errors },
        residualUsers,
        deletedEmails: users.map((u) => u.email),
      },
      null,
      2,
    ),
  );

  if (residualUsers > 0) {
    throw new Error(`Cleanup incompleto: ${residualUsers} usuarios sfef10c residuales`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
