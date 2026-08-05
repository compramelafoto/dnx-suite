/**
 * Fixtures ETAPA 08 — sesión CLOSED + ResultBatch GENERATED (sin LIVE).
 * Creds → /tmp/sfef-08-creds.env
 */
import { createHash, randomBytes, scryptSync } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@repo/db";
import {
  acceptJuryTerms,
  activateRubric,
  ensureDraftScoringSession,
  openScoringSession,
  closeScoringSession,
  upsertJuryEvaluation,
} from "../app/lib/fotorank/jury";
import { freezeAdmittedEntries } from "../app/lib/fotorank/admission";
import { SANTA_FE_EN_FOCO_JURY_CRITERIA } from "../app/lib/fotorank/jury/santa-fe-en-foco-rubric";
import {
  activateResultRuleSet,
  ensureDraftResultRuleSet,
  generateResultBatch,
} from "../app/lib/fotorank/results";

const KEY_LEN = 64;
const JUDGE_PASSWORD = `Sfef08-J-${randomBytes(3).toString("hex")}!`;
const ORG_PASSWORD = `Sfef08-O-${randomBytes(3).toString("hex")}!`;

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
  if (!amateur) throw new Error("amateur missing");

  const rulesVersion = await prisma.fotorankContestRulesVersion.findFirst({
    where: { contestId: contest.id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!rulesVersion) throw new Error("rulesVersion missing");

  let workspace = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!workspace) workspace = await prisma.workspace.create({ data: { name: "SFEF08 Workspace" } });

  const openSessions = await prisma.fotorankJuryScoringSession.findMany({
    where: { contestId: contest.id, status: "OPEN" },
    select: { id: true },
  });

  const orgEmail = `sfef08-org-${runId}@fotorank.test`;
  const orgUser = await prisma.user.create({
    data: {
      email: orgEmail,
      name: "SFEF08 Organizer",
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
  await prisma.membership.upsert({
    where: { userId_workspaceId: { userId: orgUser.id, workspaceId: workspace.id } },
    create: { userId: orgUser.id, workspaceId: workspace.id, role: "ADMIN" },
    update: {},
  });

  for (const s of openSessions) {
    await closeScoringSession({
      contestId: contest.id,
      sessionId: s.id,
      actorUserId: orgUser.id,
      force: true,
      reason: "sfef08-isolate",
    });
  }

  const entryIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const u = await prisma.user.create({
      data: {
        email: `sfef08-part-${i}-${runId}@fotorank.test`,
        name: `SFEF08 Part ${i}`,
        password: hashPassword(ORG_PASSWORD),
        emailVerifiedAt: new Date(),
        province: "Santa Fe",
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
        registrationNumber: `SFEF08-${runId}-${i}`.slice(0, 32),
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
        title: `SFEF08 ${runId} ${i}`,
        entryNumber: `S8-${runId.slice(-6)}-${i}`.toUpperCase(),
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
    const asset = await prisma.fotorankContestEntryAsset.create({
      data: {
        contestId: contest.id,
        registrationId: reg.id,
        entryId: entry.id,
        versionNumber: 1,
        kind: "JURY_PREVIEW",
        storageProvider: "r2",
        storageBucket: "fotorank-private-staging",
        storageKey: `fotorank/contests/${contest.id}/entries/${entry.id}/versions/1/jury/sfef08-${runId}-${i}`,
        mimeType: "image/jpeg",
        extension: "jpg",
        fileSizeBytes: 1024,
        width: 800,
        height: 600,
        sha256: createHash("sha256").update(`sfef08-${runId}-${i}`).digest("hex"),
        isActive: true,
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
    });
    await prisma.fotorankContestEntry.update({
      where: { id: entry.id },
      data: { activeAssetId: asset.id },
    });
    entryIds.push(entry.id);
  }

  const dry = await freezeAdmittedEntries({
    contestId: contest.id,
    organizerUserId: orgUser.id,
    categorySlugs: ["fotografo-amateur"],
    entryIds,
    dryRun: true,
  });
  if (!dry.selectionHash || !dry.batchId) throw new Error("freeze dry-run failed");
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
  const batchId = applied.batchId ?? dry.batchId;

  const methodConfig = {
    criteria: SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => c.key),
    scale: { min: 1, max: 10 },
  };

  async function makeJudge(tag: string) {
    const email = `sfef08-${tag}-${runId}@fotorank.test`;
    const acc = await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId: workspace!.id,
        email,
        passwordHash: hashPassword(JUDGE_PASSWORD),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: tag,
            lastName: "SFEF08",
            publicSlug: `sfef08-${tag}-${runId}`,
            isPublic: false,
          },
        },
        organizationMemberships: {
          create: { organizationId: contest!.organizationId, membershipStatus: "ACTIVE" },
        },
      },
    });
    await prisma.fotorankJudgeAssignment.create({
      data: {
        judgeAccountId: acc.id,
        organizationId: contest!.organizationId,
        contestId: contest!.id,
        categoryId: amateur!.id,
        assignmentType: "PRIMARY",
        assignmentStatus: "ACCEPTED",
        methodType: "CRITERIA_BASED",
        methodConfigJson: methodConfig,
        allowVoteEdit: false,
        createdByUserId: orgUser.id,
        admissionBatchId: batchId,
      },
    });
    return { id: acc.id, email };
  }

  const judges = [await makeJudge("j0"), await makeJudge("j1"), await makeJudge("j2")];
  for (const j of judges) {
    await acceptJuryTerms({
      judgeAccountId: j.id,
      contestId: contest.id,
      source: "ops-sfef-08",
    });
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
    select: { id: true, entryId: true },
  });
  const snapByEntry = new Map(snapshots.map((s) => [s.entryId, s.id]));

  // entry2 === entry3 → empate completo (comité). entry0/1 distintos.
  const tied = {
    composition: 7,
    technique: 7,
    originality: 7,
    narrative_impact: 7,
    thematic_relation: 7,
  };
  const scoreSets = [
    { composition: 9, technique: 9, originality: 9, narrative_impact: 9, thematic_relation: 9 },
    { composition: 8, technique: 8, originality: 8, narrative_impact: 8, thematic_relation: 8 },
    tied,
    tied,
  ];

  for (const j of judges) {
    for (let i = 0; i < entryIds.length; i++) {
      const entryId = entryIds[i]!;
      const snapId = snapByEntry.get(entryId);
      if (!snapId) throw new Error("snap missing");
      const scores = scoreSets[i]!;
      await upsertJuryEvaluation({
        judgeAccountId: j.id,
        contestId: contest.id,
        entryId,
        snapshotId: snapId,
        scores: SANTA_FE_EN_FOCO_JURY_CRITERIA.map((c) => ({
          key: c.key,
          score: scores[c.key as keyof typeof scores],
        })),
        privateComment: "sfef08",
        submit: true,
        idempotencyKey: `sfef08-${j.id}-${entryId}`,
      });
    }
  }

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
  });
  const resultBatch = generated.batch;

  const tiedEntries = await prisma.fotorankResultEntry.findMany({
    where: { resultBatchId: resultBatch.id, resultStatus: "TIED" },
    orderBy: { anonymousCode: "asc" },
    select: { juryEntrySnapshotId: true, tieGroup: true, anonymousCode: true },
  });
  const tieGroup = tiedEntries[0]?.tieGroup ?? "";
  const tiedSnapIds = tiedEntries.map((e) => e.juryEntrySnapshotId).join(",");

  const credsPath = "/tmp/sfef-08-creds.env";
  writeFileSync(
    credsPath,
    [
      `SFEF_08_ORG_EMAIL=${orgEmail}`,
      `SFEF_08_ORG_PASSWORD=${ORG_PASSWORD}`,
      `SFEF_08_CONTEST_ID=${contest.id}`,
      `SFEF_08_SESSION_ID=${session.id}`,
      `SFEF_08_ADMISSION_BATCH_ID=${batchId}`,
      `SFEF_08_RESULT_BATCH_ID=${resultBatch.id}`,
      `SFEF_08_RULESET_ID=${ruleSet.id}`,
      `SFEF_08_RUN_ID=${runId}`,
      `SFEF_08_CATEGORY_ID=${amateur.id}`,
      `SFEF_08_TIE_GROUP='${tieGroup.replace(/'/g, "'\\''")}'`,
      `SFEF_08_TIED_SNAPSHOT_IDS='${tiedSnapIds.replace(/'/g, "'\\''")}'`,
      `SFEF_08_TIED_COUNT=${tiedEntries.length}`,
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
        sessionId: session.id,
        resultBatchId: resultBatch.id,
        resultBatchStatus: resultBatch.status,
        tiedCount: tiedEntries.length,
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
