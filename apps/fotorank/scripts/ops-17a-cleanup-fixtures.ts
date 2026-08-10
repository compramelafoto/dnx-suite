/**
 * Cleanup exclusivo de fixtures ops-17a-* (dry-run por defecto).
 *   DRY_RUN=0 SFEF17A_ALLOW_PROD=1 DATABASE_URL=... tsx scripts/ops-17a-cleanup-fixtures.ts
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

async function main() {
  if (process.env.SFEF17A_ALLOW_PROD !== "1") throw new Error("ABORT: SFEF17A_ALLOW_PROD=1");
  const dry = process.env.DRY_RUN !== "0";
  const prisma = new PrismaClient();
  const contests = await prisma.fotorankContest.findMany({
    where: { slug: { startsWith: "ops-17a-" } },
    select: { id: true, slug: true },
  });
  console.log("fixtures", contests.length, dry ? "(dry-run)" : "(DELETE)");
  if (dry) {
    await prisma.$disconnect();
    return;
  }
  for (const c of contests) {
    const id = c.id;
    await prisma.fotorankPublicVoteFinalSnapshot.deleteMany({ where: { round: { contestId: id } } });
    await prisma.fotorankPublicVoteObservation.deleteMany({ where: { round: { contestId: id } } });
    await prisma.fotorankPublicVoteCandidate.deleteMany({ where: { round: { contestId: id } } });
    await prisma.fotorankPublicVoteRound.deleteMany({ where: { contestId: id } });
    await prisma.fotorankFinalistSnapshot.deleteMany({ where: { contestId: id } });
    await prisma.fotorankFinalistPackage.deleteMany({ where: { contestId: id } });
    await prisma.fotorankJudgeAuditEvent.deleteMany({ where: { contestId: id } });
    await prisma.fotorankJuryScoringSession.deleteMany({ where: { contestId: id } });
    await prisma.fotorankJuryRubric.deleteMany({ where: { contestId: id } });
    await prisma.fotorankJuryEntrySnapshot.deleteMany({ where: { contestId: id } });
    await prisma.fotorankAdmissionBatch.deleteMany({ where: { contestId: id } });
    await prisma.fotorankCompetitionJuryConfig.deleteMany({ where: { contestId: id } });
    await prisma.fotorankContestEntry.deleteMany({ where: { contestId: id } });
    await prisma.fotorankContestParticipant.deleteMany({ where: { contestId: id } });
    await prisma.fotorankContestCategory.deleteMany({ where: { contestId: id } });
    await prisma.fotorankContest.delete({ where: { id } }).catch(() => null);
  }
  console.log("OK residual contests", await prisma.fotorankContest.count({ where: { slug: { startsWith: "ops-17a-" } } }));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
