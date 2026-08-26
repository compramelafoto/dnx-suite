/**
 * Cleanup seguro fixtures SFEF06 / SFEF06B — solo staging, dry-run por defecto.
 *
 * Uso:
 *   DRY_RUN=1 pnpm ... ops-sfef-06b-cleanup-fixtures.ts
 *   APPLY=1 pnpm ... ops-sfef-06b-cleanup-fixtures.ts
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
        { email: { startsWith: "sfef06-" } },
        { email: { startsWith: "sfef06b-" } },
      ],
    },
    select: { id: true, email: true },
  });

  // Safety: only @fotorank.test + prefix
  for (const u of users) {
    if (!u.email.endsWith("@fotorank.test")) throw new Error(`unsafe email ${u.email}`);
    if (!u.email.startsWith("sfef06")) throw new Error(`unsafe prefix ${u.email}`);
  }

  const userIds = users.map((u) => u.id);
  const regs = userIds.length
    ? await prisma.fotorankContestRegistration.findMany({
        where: { contestId: contest.id, participantUserId: { in: userIds } },
        select: { id: true, participantUserId: true },
      })
    : [];
  const regIds = regs.map((r) => r.id);
  const entries = regIds.length
    ? await prisma.fotorankContestEntry.findMany({
        where: { contestId: contest.id, registrationId: { in: regIds } },
        select: { id: true, admissionStatus: true, admissionBatchId: true },
      })
    : [];
  const entryIds = entries.map((e) => e.id);

  const orgMembers = userIds.length
    ? await prisma.contestOrganizationMember.findMany({
        where: { organizationId: contest.organizationId, userId: { in: userIds } },
        select: { id: true, userId: true },
      })
    : [];

  const inventory = {
    dryRun,
    apply,
    contestId: contest.id,
    users: users.length,
    registrations: regs.length,
    entries: entries.length,
    orgMembers: orgMembers.length,
    userEmails: users.map((u) => u.email),
    entryStatuses: Object.fromEntries(
      entries.reduce((m, e) => {
        const k = e.admissionStatus ?? "null";
        m.set(k, (m.get(k) ?? 0) + 1);
        return m;
      }, new Map<string, number>()),
    ),
  };

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, ...inventory, note: "Set APPLY=1 to delete" }, null, 2));
    return;
  }

  // Apply: order matters — reviews/checks cascade with entry; snapshots by entry
  if (entryIds.length) {
    await prisma.fotorankJuryEntrySnapshot.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntryReview.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryCheck.deleteMany({ where: { entryId: { in: entryIds } } });
    await prisma.fotorankContestEntryAsset.deleteMany({
      where: { contestId: contest.id, entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntry.deleteMany({
      where: { contestId: contest.id, id: { in: entryIds } },
    });
  }
  if (regIds.length) {
    await prisma.fotorankContestRegistration.deleteMany({
      where: { contestId: contest.id, id: { in: regIds } },
    });
  }
  if (orgMembers.length) {
    await prisma.contestOrganizationMember.deleteMany({
      where: { id: { in: orgMembers.map((m) => m.id) } },
    });
  }
  if (userIds.length) {
    // Sesiones, perfiles y auditoría antes del User (FK sin cascade).
    await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankProfile.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { actorUserId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        deleted: inventory,
        residualUsers: await prisma.user.count({
          where: {
            email: { endsWith: "@fotorank.test" },
            OR: [{ email: { startsWith: "sfef06-" } }, { email: { startsWith: "sfef06b-" } }],
          },
        }),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
