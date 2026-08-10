/** Cleanup seguro fixtures ops-16b-*@fotorank.test / slug ops-16b-* */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

async function main() {
  const p = new PrismaClient();
  const contests = await p.fotorankContest.findMany({
    where: { slug: { startsWith: "ops-16b-" } },
    select: { id: true, slug: true },
  });
  console.log("contests", contests.length, contests.map((c) => c.slug));
  for (const c of contests) {
    await p.fotorankFinalistSnapshot.deleteMany({ where: { contestId: c.id } });
    await p.fotorankFinalistPackage.deleteMany({ where: { contestId: c.id } });
    await p.fotorankResultEntry.deleteMany({ where: { resultBatch: { contestId: c.id } } });
    await p.fotorankResultBatch.deleteMany({ where: { contestId: c.id } });
    await p.fotorankResultRuleSet.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJuryCriterionScore.deleteMany({ where: { evaluation: { contestId: c.id } } });
    await p.fotorankJuryEvaluation.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJuryPreliminaryAggregate.deleteMany({
      where: { scoringSession: { contestId: c.id } },
    });
    await p.fotorankJudgeEntryConflict.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJudgeAssignment.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJudgeAuditEvent.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJuryScoringSession.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJuryCriterion.deleteMany({ where: { rubric: { contestId: c.id } } });
    await p.fotorankJuryRubric.deleteMany({ where: { contestId: c.id } });
    await p.fotorankJuryEntrySnapshot.deleteMany({ where: { contestId: c.id } });
    await p.fotorankAdmissionBatch.deleteMany({ where: { contestId: c.id } });
    await p.fotorankCompetitiveEligibilityFreeze.deleteMany({ where: { contestId: c.id } });
    await p.fotorankCompetitionJuryConfig.deleteMany({ where: { contestId: c.id } });
    await p.fotorankContestEntryAsset.deleteMany({ where: { contestId: c.id } });
    await p.fotorankContestEntry.deleteMany({ where: { contestId: c.id } });
    const parts = await p.fotorankContestParticipant.findMany({
      where: { contestId: c.id },
      select: { userId: true },
    });
    await p.fotorankContestParticipant.deleteMany({ where: { contestId: c.id } });
    await p.fotorankContestCategory.deleteMany({ where: { contestId: c.id } });
    await p.fotorankContest.delete({ where: { id: c.id } });
    await p.contestOrganizationMember.deleteMany({
      where: { userId: { in: parts.map((x) => x.userId) } },
    });
  }
  const judges = await p.fotorankJudgeAccount.findMany({
    where: { email: { startsWith: "ops16b-" } },
    select: { id: true },
  });
  for (const j of judges) {
    await p.fotorankJudgeOrganizationMembership.deleteMany({ where: { judgeAccountId: j.id } });
    await p.fotorankJudgeProfile.deleteMany({ where: { judgeAccountId: j.id } });
    await p.fotorankJudgeAccount.delete({ where: { id: j.id } }).catch(() => null);
  }
  // No borrar org creators si la org ops-16b-org* sigue existiendo.
  const orgCreators = await p.contestOrganization.findMany({
    where: { slug: { startsWith: "ops-16b-org" } },
    select: { createdByUserId: true },
  });
  const keepUserIds = new Set(orgCreators.map((o) => o.createdByUserId).filter(Boolean) as number[]);
  const users = await p.user.deleteMany({
    where: {
      email: { startsWith: "ops16b-", endsWith: "@fotorank.test" },
      id: { notIn: [...keepUserIds] },
    },
  });
  console.log("deleted users", users.count, "judges", judges.length, "keptOrgCreators", keepUserIds.size);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
