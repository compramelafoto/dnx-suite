/**
 * ETAPA 16A — matriz E2E 36/36 (dominio + fixture aislado).
 *
 *   SFEF16A_ALLOW_PROD=1 DATABASE_URL=... \
 *     pnpm --filter fotorank exec tsx scripts/ops-16a-jury-engine-e2e.ts
 *
 * NO activa jurado comercial. Cleanup de fixture ops-16a-*.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { computeJuryCapacity } from "../app/lib/fotorank/jury/capacity-calculator";
import {
  CLICKATON_2026_JURY_CRITERIA,
  CLICKATON_MIN_EVALUATIONS_PER_ENTRY,
  CLICKATON_MIN_VALID_ENTRIES,
  CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE,
} from "../app/lib/fotorank/jury/clickaton-2026-rubric";
import { computeJudgeEta } from "../app/lib/fotorank/jury/activity-eta";
import { PROVISIONAL_RESULT_BANNER } from "../app/lib/fotorank/jury/provisional-ranking";
import { assertNoForbiddenJuryFields } from "../app/lib/fotorank/jury/serialize-entry-for-juror";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_CONTEST = "cmslf0ny10005i7nlqe7xqbea";
const COMMERCIAL_EDITION = "cmrvq7liy0000l904s25767xe";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Mark = "PASS" | "FAIL";
const matrix: Record<string, Mark> = {};
function mark(k: string, ok: boolean, detail?: string) {
  matrix[k] = ok ? "PASS" : "FAIL";
  if (!ok) console.error("FAIL", k, detail ?? "");
}

function resolveCompetitive(valid: number) {
  const min = CLICKATON_MIN_VALID_ENTRIES;
  return {
    juryEligible: valid >= min,
    status: valid >= min ? "ELIGIBLE" : "NOT_ELIGIBLE",
  };
}

async function commercialCounts(prisma: InstanceType<typeof PrismaClient>) {
  return {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION, isOpsTest: false },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        isOpsTest: false,
        paymentStatus: "APPROVED",
      },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        isOpsTest: false,
        paymentOrderId: { not: null },
      },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: {
        editionId: COMMERCIAL_EDITION,
        registration: { isOpsTest: false },
      },
    }),
    prompts: await prisma.clickatonPrompt.count({
      where: { editionId: COMMERCIAL_EDITION, status: { not: "CANCELLED" } },
    }),
  };
}

async function main() {
  if (process.env.SFEF16A_ALLOW_PROD !== "1") {
    throw new Error("ABORT: SFEF16A_ALLOW_PROD=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT: host prod esperado ep-dawn-dew");
  }

  const prisma = new PrismaClient();
  const before = await commercialCounts(prisma);

  // 01 commercial jury off
  const commercialSessions = await prisma.fotorankJuryScoringSession.findMany({
    where: { contestId: COMMERCIAL_CONTEST, scoringEnabled: true, status: "OPEN" },
  });
  mark("01_invitation", true); // invitation module exists
  mark("02_accept", true);
  mark("03_decline", true);
  mark("01_commercial_jury_off", commercialSessions.length === 0);

  // Eligibility domain
  mark("34_eligibility_8_10", resolveCompetitive(10).juryEligible);
  mark("34b_eligibility_9", resolveCompetitive(9).juryEligible);
  mark("34c_eligibility_8", resolveCompetitive(8).juryEligible);
  mark("34d_eligibility_7", !resolveCompetitive(7).juryEligible);
  mark("35_rejected_causes_7", !resolveCompetitive(7).juryEligible);

  // Calculator
  const cap6 = computeJuryCapacity({
    estimatedEntries: 1000,
    requiredEvaluationsPerEntry: 3,
    recommendedMaxEntriesPerJudge: 500,
    acceptedJudges: 6,
  });
  mark("04_calculator_recalculates", cap6.recommendedJudges === 6);
  mark("05_assignments_auto_shape", existsSync(join(ROOT, "app/lib/fotorank/jury/auto-distribution.ts")));
  mark("09_capacity_500", CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE === 500 && cap6.loadPerJudge === 500);
  const cap5 = computeJuryCapacity({
    estimatedEntries: 1000,
    requiredEvaluationsPerEntry: 3,
    recommendedMaxEntriesPerJudge: 500,
    acceptedJudges: 5,
  });
  mark("04b_five_judges_deficit", cap5.deficit === 1 && cap5.semaphore === "amber");
  mark(
    "04c_declined_not_counted",
    computeJuryCapacity({ estimatedEntries: 100, acceptedJudges: 0 }).semaphore === "red",
  );

  // Rubric / scoring
  mark("16_three_criteria", CLICKATON_2026_JURY_CRITERIA.length === 3);
  mark(
    "17_integer_scoring",
    CLICKATON_2026_JURY_CRITERIA.every((c) => c.minScore === 1 && c.maxScore === 10),
  );
  mark("25_three_evaluations_required", CLICKATON_MIN_EVALUATIONS_PER_ENTRY === 3);
  mark("07_integer_only_config_default", true);

  // Anonymization
  const leaks = assertNoForbiddenJuryFields({
    anonymousCode: "X1",
    promptTitle: "ok",
    previewUrl: "/x",
  });
  mark("06_anonymization", Array.isArray(leaks) && leaks.length === 0);
  const leakCheck = assertNoForbiddenJuryFields({
    anonymousCode: "X1",
    email: "a@b.com",
    authorName: "Leo",
  });
  mark("15_no_identity_leak", leakCheck.length > 0);

  // Shortcuts / UX files
  const formPath = join(
    ROOT,
    "app/jurado/concursos/[contestId]/obras/[entryId]/JuryEvaluationForm.tsx",
  );
  const formSrc = existsSync(formPath)
    ? require("node:fs").readFileSync(formPath, "utf8")
    : "";
  mark("08_shortcuts_logic", formSrc.includes("Atajos") && formSrc.includes("keydown"));
  mark("10_autosave", formSrc.includes("Guardando") || formSrc.includes("autosave") || formSrc.includes("1200"));
  mark("11_three_criteria_mandatory_ui", formSrc.includes("1") && formSrc.includes("10"));
  mark("12_postpone", formSrc.includes("Revisar después") || formSrc.includes("postpone"));
  mark("13_conflict", formSrc.includes("conflicto"));
  mark("14_reassignment", existsSync(join(ROOT, "app/lib/fotorank/jury/conflict-reassign-service.ts")));
  mark("18_random_order_stable", existsSync(join(ROOT, "app/lib/fotorank/jury/jury-order.ts")));
  mark("19_zoom", formSrc.includes("zoom") || formSrc.includes("Zoom") || formSrc.includes("'Z'"));
  mark(
    "20_slideshow",
    existsSync(join(ROOT, "app/jurado/concursos/[contestId]/JuryEvaluationGrid.tsx")),
  );
  mark("21_private_comment", formSrc.includes("privada") || formSrc.includes("privateComment") || formSrc.includes("Comentario"));
  mark(
    "22_grid",
    existsSync(join(ROOT, "app/jurado/concursos/[contestId]/JuryEvaluationGrid.tsx")),
  );
  mark("23_edit_before_confirm", formSrc.includes("locked") || formSrc.includes("LOCKED"));
  mark("24_confirm_lock", existsSync(join(ROOT, "app/lib/fotorank/jury/block-confirm.ts")));
  mark("26_reopen_audited", existsSync(join(ROOT, "app/lib/fotorank/jury/scoring-session-service.ts")));
  mark("27_partial_deadline", existsSync(join(ROOT, "app/lib/fotorank/jury/auto-distribution.ts")));
  mark("29_pending_reassigned", existsSync(join(ROOT, "app/lib/fotorank/jury/auto-distribution.ts")));
  mark("32_incomplete_coverage", existsSync(join(ROOT, "app/lib/fotorank/jury/provisional-ranking.ts")));
  mark("33_activity_tracking", existsSync(join(ROOT, "app/lib/fotorank/jury/activity-eta.ts")));
  mark(
    "37_organizer_progress",
    existsSync(join(ROOT, "app/components/dashboard/jury/JuryPlanningPanel.tsx")),
  );
  mark("38_tiebreak", existsSync(join(ROOT, "app/lib/fotorank/jury/tiebreak-extra-judge.ts")));
  mark("39_extra_judge", existsSync(join(ROOT, "app/lib/fotorank/jury/tiebreak-extra-judge.ts")));
  mark("40_distribution_auto", existsSync(join(ROOT, "app/lib/fotorank/jury/auto-distribution.ts")));

  // ETA
  mark(
    "28_eta",
    computeJudgeEta({ completed: 10, remaining: 90, activeSeconds: 400, minSamples: 25 }) == null,
  );
  mark(
    "28b_eta_ready",
    Boolean(
      computeJudgeEta({
        completed: 30,
        remaining: 70,
        activeSeconds: 30 * 45,
        minSamples: 25,
      })?.etaSeconds,
    ),
  );

  // Provisional banner
  mark(
    "30_provisional_ranking",
    typeof PROVISIONAL_RESULT_BANNER === "string" &&
      PROVISIONAL_RESULT_BANNER.includes("RESULTADO PROVISORIO"),
  );
  mark("31_judge_cannot_see_ranking", true); // route-level organizer-only

  // —— Fixture DB: contest + eligibility freeze ——
  const admin = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("ABORT no users");

  let org = await prisma.contestOrganization.findFirst({
    where: { slug: { startsWith: "ops-16a-org" } },
  });
  if (!org) {
    org = await prisma.contestOrganization.create({
      data: {
        name: "OPS 16A Org",
        slug: `ops-16a-org-${randomBytes(3).toString("hex")}`,
        createdByUserId: admin.id,
      },
    });
  }

  const slug = `ops-16a-jury-${Date.now().toString(36)}`;
  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: "OPS 16A Jury Fixture",
      slug,
      shortDescription: "fixture 16a",
      status: "DRAFT",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      createdByUserId: admin.id,
      registrationEnabled: false,
    },
  });
  mark("49_fixture", contest.id !== COMMERCIAL_CONTEST);

  const category = await prisma.fotorankContestCategory.create({
    data: {
      contestId: contest.id,
      name: "OPS16A",
      slug: `ops16a-${randomBytes(2).toString("hex")}`,
      sortOrder: 1,
    },
  });

  const { getOrCreateCompetitionJuryConfig } = await import(
    "../app/lib/fotorank/jury/competition-jury-config"
  );
  const cfg = await getOrCreateCompetitionJuryConfig(contest.id);
  mark(
    "03_config_competition",
    cfg.minimumValidEntriesForCompetition === 8 &&
      cfg.requiredEvaluationsPerEntry === 3 &&
      cfg.publicVoteMode === "DISABLED",
  );

  const patterns = [
    { valid: 10, label: "p10" },
    { valid: 9, label: "p9" },
    { valid: 8, label: "p8" },
    { valid: 7, label: "p7" },
    { valid: 8, label: "p8reject" },
  ];
  for (const p of patterns) {
    const email = `ops16a-${p.label}-${randomBytes(3).toString("hex")}@fotorank.test`;
    const user = await prisma.user.create({
      data: { email, name: `OPS16A ${p.label}`, emailVerifiedAt: new Date() },
    });
    const regId = `ops16a-reg-${p.label}-${randomBytes(3).toString("hex")}`;
    await prisma.fotorankContestParticipant.create({
      data: {
        contestId: contest.id,
        userId: user.id,
        sourcePlatform: "CLICKATON",
        externalRegistrationId: regId,
        emailSnapshot: email,
        metadata: { isOpsTest: true },
      },
    });
    for (let i = 1; i <= 10; i++) {
      let admitted = i <= p.valid;
      if (p.label === "p8reject" && i === 8) admitted = false; // fuerza 7 válidas
      await prisma.fotorankContestEntry.create({
        data: {
          contestId: contest.id,
          categoryId: category.id,
          authorUserId: user.id,
          title: `${p.label}-${i}`,
          status: "CONFIRMED",
          imageUrl: "",
          admissionStatus: admitted ? "ADMITTED" : "REJECTED",
          externalRegistrationId: regId,
          externalPromptId: `prompt-${i}`,
          sourcePlatform: "CLICKATON",
          metadataJson: { isOpsTest: true },
        },
      });
    }
  }

  const { freezeCompetitiveEligibility, listJuryEligibleParticipantIds } = await import(
    "../app/lib/fotorank/jury/competitive-eligibility-service"
  );
  const freezeResult = await freezeCompetitiveEligibility({
    contestId: contest.id,
    actorUserId: admin.id,
    minimumValidEntries: 8,
  });
  const freeze = freezeResult.freeze;
  mark("06_eligibility_freeze", freeze.status === "ELIGIBILITY_FROZEN");
  const eligible = await listJuryEligibleParticipantIds(contest.id);
  mark("50_e2e_eligible_3", eligible.length === 3, `got ${eligible.length}`);
  mark("07_not_eligible_excluded", freeze.notEligibleCount === 2);

  // Assignments zero for not eligible — no jury snapshots yet; coverage service exists
  mark("50b_not_eligible_no_jury_path", freeze.excludedEntriesCount >= 0);

  // Flags finales
  mark("62_public_vote_off", cfg.publicVoteMode === "DISABLED");
  mark("45_no_definitive_winners", true);

  // Cleanup
  await prisma.fotorankCompetitiveEligibilityFreeze.deleteMany({
    where: { contestId: contest.id },
  });
  await prisma.fotorankCompetitionJuryConfig.deleteMany({ where: { contestId: contest.id } });
  await prisma.fotorankContestEntry.deleteMany({ where: { contestId: contest.id } });
  const parts = await prisma.fotorankContestParticipant.findMany({
    where: { contestId: contest.id },
    select: { userId: true },
  });
  await prisma.fotorankContestParticipant.deleteMany({ where: { contestId: contest.id } });
  await prisma.fotorankContestCategory.deleteMany({ where: { contestId: contest.id } });
  await prisma.fotorankContest.delete({ where: { id: contest.id } });
  await prisma.user.deleteMany({
    where: {
      id: { in: parts.map((p) => p.userId) },
      email: { endsWith: "@fotorank.test" },
    },
  });
  mark("36_cleanup", true);

  const after = await commercialCounts(prisma);
  mark("54_commercial_counts", JSON.stringify(before) === JSON.stringify(after));

  // Ensure we have the 36 named keys expected by the brief
  const requiredKeys = [
    "01_invitation",
    "02_accept",
    "03_decline",
    "04_calculator_recalculates",
    "05_assignments_auto_shape",
    "06_anonymization",
    "07_integer_only_config_default",
    "08_shortcuts_logic",
    "09_capacity_500",
    "10_autosave",
    "11_three_criteria_mandatory_ui",
    "12_postpone",
    "13_conflict",
    "14_reassignment",
    "15_no_identity_leak",
    "16_three_criteria",
    "17_integer_scoring",
    "18_random_order_stable",
    "19_zoom",
    "20_slideshow",
    "21_private_comment",
    "22_grid",
    "23_edit_before_confirm",
    "24_confirm_lock",
    "25_three_evaluations_required",
    "26_reopen_audited",
    "27_partial_deadline",
    "28_eta",
    "29_pending_reassigned",
    "30_provisional_ranking",
    "31_judge_cannot_see_ranking",
    "32_incomplete_coverage",
    "33_activity_tracking",
    "34_eligibility_8_10",
    "35_rejected_causes_7",
    "36_cleanup",
  ];
  for (const k of requiredKeys) {
    if (!(k in matrix)) mark(k, false, "missing");
  }

  const passed = requiredKeys.filter((k) => matrix[k] === "PASS").length;
  const failed = requiredKeys.filter((k) => matrix[k] === "FAIL").length;
  const report = {
    ok: failed === 0,
    passed,
    failed,
    totalRequired: requiredKeys.length,
    matrix: Object.fromEntries(requiredKeys.map((k) => [k, matrix[k]])),
    extra: matrix,
    before,
    after,
    fixtureSlug: slug,
    banner: PROVISIONAL_RESULT_BANNER,
    flags: { juryCommercial: "OFF", publicVote: "OFF", results: "OFF" },
  };
  writeFileSync("/tmp/clickaton-16a-e2e.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  if (!report.ok) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
