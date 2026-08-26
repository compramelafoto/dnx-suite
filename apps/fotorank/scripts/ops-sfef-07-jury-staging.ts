/**
 * Ops ETAPA 07 — fixtures jurado staging (round-fog).
 * Creds → /tmp/sfef-07-creds.env (chmod 600).
 */
import { randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import {
  activateRubric,
  ensureDraftScoringSession,
  getCoverageReport,
  openScoringSession,
  closeScoringSession,
  upsertJuryEvaluation,
  acceptJuryTerms,
} from "../app/lib/fotorank/jury";
import { freezeAdmittedEntries } from "../app/lib/fotorank/admission";
import {
  activateResultRuleSet,
  ensureDraftResultRuleSet,
  generateResultBatch,
} from "../app/lib/fotorank/results";
import { SANTA_FE_EN_FOCO_JURY_CRITERIA } from "../app/lib/fotorank/jury/santa-fe-en-foco-rubric";

const KEY_LEN = 64;
const JUDGE_PASSWORD = `Sfef07-Judge-${randomBytes(3).toString("hex")}!`;
const ORG_PASSWORD = `Sfef07-Org-${randomBytes(3).toString("hex")}!`;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, KEY_LEN).toString("hex");
  return `${salt}:${digest}`;
}

function assertStaging() {
  const url = process.env.DATABASE_URL ?? "";
  const host = new URL(url).hostname;
  if (!host.includes("ep-round-fog") || host.includes("dawn-dew")) {
    throw new Error(`ABORT host no staging: ${host}`);
  }
}

async function main() {
  assertStaging();
  const runId = `${Date.now().toString(36)}-${randomBytes(2).toString("hex")}`;

  const contest = await prisma.fotorankContest.findFirst({
    where: { slug: "santa-fe-en-foco" },
    include: { categories: { where: { status: "ACTIVE" } } },
  });
  if (!contest) throw new Error("contest missing");
  const amateur = contest.categories.find((c) => c.slug === "fotografo-amateur");
  if (!amateur) throw new Error("amateur category missing");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) {
    workspace = await prisma.workspace.create({ data: { name: "SFEF07 Staging Workspace" } });
  }

  const orgEmail = `sfef07-org-${runId}@fotorank.test`;
  const orgUser = await prisma.user.create({
    data: {
      email: orgEmail,
      name: "SFEF07 Organizer",
      password: hashPassword(ORG_PASSWORD),
      role: "ORGANIZER",
      emailVerifiedAt: new Date(),
      province: "Santa Fe",
      country: "Argentina",
    },
  });
  await prisma.contestOrganizationMember.create({
    data: {
      organizationId: contest.organizationId,
      userId: orgUser.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const entryIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const u = await prisma.user.create({
      data: {
        email: `sfef07-part-${i}-${runId}@fotorank.test`,
        name: `SFEF07 Part ${i}`,
        password: hashPassword(ORG_PASSWORD),
        emailVerifiedAt: new Date(),
        province: "Córdoba",
        country: "Argentina",
      },
    });
    const reg = await prisma.fotorankContestRegistration.create({
      data: {
        contestId: contest.id,
        categoryId: amateur.id,
        participantUserId: u.id,
        status: "CONFIRMED",
        paymentStatus: "NOT_REQUIRED",
        paymentModeSnapshot: "FREE",
        registrationNumber: `SFEF07-${runId}-${i}`.slice(0, 32),
        rulesVersionId: rulesVersion.id,
        rulesAcceptedAt: new Date(),
        registeredAt: new Date(),
        confirmedAt: new Date(),
        licenseAccepted: true,
        licenseAcceptedAt: new Date(),
        declaredAgeYears: 30,
        answersJson: {},
      },
    });
    const entry = await prisma.fotorankContestEntry.create({
      data: {
        contestId: contest.id,
        categoryId: amateur.id,
        registrationId: reg.id,
        authorUserId: u.id,
        status: "CONFIRMED",
        technicalSummaryStatus: "APPROVED",
        manualReviewStatus: "NONE",
        admissionStatus: "ADMITTED",
        submittedAt: new Date(),
        confirmedAt: new Date(),
        imageUrl: "",
        title: `SFEF07 ${runId} ${i}`,
        entryNumber: `SFE7-${runId.slice(-6)}-${i}`.toUpperCase(),
        metadataJson: {
          eligibility: {
            captureLocality: "Rosario",
            territoryConfirmedSantaFe: true,
            declaredDeviceKind: "SMARTPHONE",
            gpsPresent: false,
          },
        },
      },
    });
    entryIds.push(entry.id);
  }

  // Cerrar sesiones OPEN previas del concurso para evitar loadOpenSession cruzado.
  const openSessions = await prisma.fotorankJuryScoringSession.findMany({
    where: { contestId: contest.id, status: "OPEN" },
    select: { id: true },
  });
  for (const s of openSessions) {
    await closeScoringSession({
      contestId: contest.id,
      sessionId: s.id,
      actorUserId: orgUser.id,
      force: true,
      reason: "sfef07-ops-isolate-session",
    });
  }

  const dry = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId: orgUser.id,
    categorySlugs: ["fotografo-amateur"],
    entryIds,
    dryRun: true,
  });
  if (!("selectionHash" in dry) || !dry.selectionHash || !dry.batchId) {
    throw new Error(`freeze dry-run failed: ${JSON.stringify(dry)}`);
  }
  const applied = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId: orgUser.id,
    categorySlugs: ["fotografo-amateur"],
    entryIds,
    dryRun: false,
    batchId: dry.batchId,
    selectionHash: dry.selectionHash,
    expectedCount: dry.expectedCount,
    confirmPhrase: `CONGELAR ${dry.expectedCount} OBRAS`,
  });
  const batchId =
    ("batchId" in applied && applied.batchId) || dry.batchId || null;
  if (!batchId) throw new Error(`no batch after freeze: ${JSON.stringify(applied)}`);

  const judges: Array<{ id: string; email: string }> = [];
  for (let i = 0; i < 3; i++) {
    const email = `sfef07-judge-${i}-${runId}@fotorank.test`;
    const acc = await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId: workspace.id,
        email,
        passwordHash: hashPassword(JUDGE_PASSWORD),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: `Judge${i}`,
            lastName: "SFEF07",
            publicSlug: `sfef07-j${i}-${runId}`,
            isPublic: false,
          },
        },
        organizationMemberships: {
          create: {
            organizationId: contest.organizationId,
            membershipStatus: "ACTIVE",
          },
        },
      },
    });
    await prisma.fotorankJudgeAssignment.create({
      data: {
        judgeAccountId: acc.id,
        organizationId: contest.organizationId,
        contestId: contest.id,
        categoryId: amateur.id,
        assignmentType: "PRIMARY",
        assignmentStatus: "ACCEPTED",
        methodType: "CRITERIA_BASED",
        methodConfigJson: {
          criteria: SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => c.key),
          scale: { min: 1, max: 10 },
        },
        allowVoteEdit: false,
        createdByUserId: orgUser.id,
        admissionBatchId: batchId,
      },
    });
    judges.push({ id: acc.id, email });
  }

  const session = await ensureDraftScoringSession({
    contestId: contest.id,
    admissionBatchId: batchId,
    actorUserId: orgUser.id,
  });
  await activateRubric({
    contestId: contest.id,
    rubricId: session.rubricId,
    actorUserId: orgUser.id,
  });
  await openScoringSession({
    contestId: contest.id,
    sessionId: session.id,
    actorUserId: orgUser.id,
  });

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: batchId },
    select: { id: true, anonymousCode: true },
  });

  for (const j of judges) {
    await acceptJuryTerms({
      judgeAccountId: j.id,
      contestId: contest.id,
      source: "ops-sfef-07",
    });
  }

  for (const snap of snapshots) {
    for (let ji = 0; ji < judges.length; ji++) {
      const base = 6 + ji;
      await upsertJuryEvaluation({
        judgeAccountId: judges[ji]!.id,
        contestId: contest.id,
        snapshotId: snap.id,
        scores: SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
          key: c.key,
          score: Math.min(10, base + (c.key === "narrative_impact" ? 1 : 0)),
        })),
        privateComment: "ops sfef07",
        submit: true,
        idempotencyKey: `sfef07-${runId}-${snap.id}-${ji}`,
      });
    }
  }

  const coverageBeforeClose = await getCoverageReport(contest.id, session.id);
  if (coverageBeforeClose.incompleteEntries > 0) {
    throw new Error(`coverage incomplete: ${JSON.stringify(coverageBeforeClose)}`);
  }

  // Dry-run cierre bloqueado: forzar incompleto temporal no; aquí cobertura OK.
  await closeScoringSession({
    contestId: contest.id,
    sessionId: session.id,
    actorUserId: orgUser.id,
  });

  const ruleSet = await ensureDraftResultRuleSet({
    contestId: contest.id,
    scoringSessionId: session.id,
    actorUserId: orgUser.id,
  });
  await activateResultRuleSet({
    contestId: contest.id,
    ruleSetId: ruleSet.id,
    actorUserId: orgUser.id,
  });
  const generated = await generateResultBatch({
    contestId: contest.id,
    scoringSessionId: session.id,
    ruleSetId: ruleSet.id,
    actorUserId: orgUser.id,
    idempotencyKey: `sfef07-rank-${runId}`,
  });
  const resultBatch = "batch" in generated ? generated.batch : generated;

  const credsPath = "/tmp/sfef-07-creds.env";
  writeFileSync(
    credsPath,
    [
      `SFEF_07_ORG_EMAIL=${orgEmail}`,
      `SFEF_07_ORG_PASSWORD=${ORG_PASSWORD}`,
      `SFEF_07_CONTEST_ID=${contest.id}`,
      `SFEF_07_BATCH_ID=${batchId}`,
      `SFEF_07_SESSION_ID=${session.id}`,
      `SFEF_07_RESULT_BATCH_ID=${resultBatch.id}`,
      `SFEF_07_JUDGE_PASSWORD=${JUDGE_PASSWORD}`,
      ...judges.map((j, i) => `SFEF_07_JUDGE_${i}_EMAIL=${j.email}`),
      ...judges.map((j, i) => `SFEF_07_JUDGE_${i}_ID=${j.id}`),
      `SFEF_07_RUN_ID=${runId}`,
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        runId,
        contestId: contest.id,
        batchId,
        sessionId: session.id,
        resultBatchId: resultBatch.id,
        snapshots: snapshots.length,
        judges: judges.length,
        coverage: coverageBeforeClose,
        credsPath,
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
