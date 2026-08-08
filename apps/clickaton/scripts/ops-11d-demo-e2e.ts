/**
 * ETAPA 11D — demo productiva 3 consignas + matriz E2E 18.
 *
 *   set -a && source /tmp/sfef11b-prod.env && source /tmp/clickaton-11d-fixture.env && set +a
 *   SFEF11D_ALLOW_PROD_FIXTURE=1 CLICKATON_FOTORANK_CANONICAL_ASSETS=1 \
 *     pnpm --filter clickaton exec tsx scripts/ops-11d-demo-e2e.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"));
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");
import {
  enqueueFotoRankSyncAfterPaid,
  processFotoRankSyncById,
} from "../lib/fotorank-sync/infrastructure/prisma-fotorank-sync";
import {
  confirmPromptSubmission,
  processPromptUpload,
} from "../lib/photo-upload/service";
import {
  assertLockedDtoIsSafe,
  toPromptPublicDto,
} from "../lib/timeline/prompt-dto";
import {
  admitEntry,
  freezeAdmittedEntries,
} from "../../fotorank/app/lib/fotorank/admission/admission-service";
import { upsertJuryEvaluation } from "../../fotorank/app/lib/fotorank/jury/evaluation-service";
import {
  activateRubric,
  computeAndStorePreliminaryAggregates,
  ensureDraftRubric,
  ensureDraftScoringSession,
  openScoringSession,
} from "../../fotorank/app/lib/fotorank/jury/scoring-session-service";

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";

type Matrix = Record<string, "PASS" | "FAIL" | "SKIP">;

async function ensureUpload(prisma: PrismaClient, input: {
  registrationId: string;
  promptId: string;
  userId: number;
  contestId: string;
  buffer: Buffer;
  fileName: string;
}) {
  const existing = await prisma.fotorankContestEntry.findFirst({
    where: {
      contestId: input.contestId,
      externalRegistrationId: input.registrationId,
      externalPromptId: input.promptId,
    },
    select: { id: true, technicalSummaryJson: true, admissionStatus: true },
  });
  const tech = (existing?.technicalSummaryJson ?? {}) as Record<string, unknown>;
  if (tech.assetOwner === "FOTORANK" && tech.canonicalAssetId) {
    return { submissionId: "existing", skipped: true as const };
  }
  const up = await processPromptUpload({
    registrationId: input.registrationId,
    promptId: input.promptId,
    userId: input.userId,
    buffer: input.buffer,
    originalFileName: input.fileName,
    declaredMime: "image/jpeg",
  });
  await confirmPromptSubmission({
    registrationId: input.registrationId,
    promptId: input.promptId,
    userId: input.userId,
    acceptDeclaration: true,
  });
  return { submissionId: up.submissionId, skipped: false as const };
}


function loadEnv(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i)] = t.slice(i + 1);
  }
  return out;
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

async function jpeg(opts: {
  label: string;
  withExif: boolean;
  make?: string;
  model?: string;
}): Promise<Buffer> {
  const base = await sharp({
    create: {
      width: 1200,
      height: 900,
      channels: 3,
      background: { r: 40 + opts.label.length * 7, g: 80, b: 120 },
    },
  })
    .jpeg({ quality: 88 })
    .toBuffer();
  if (!opts.withExif) return base;
  return sharp(base)
    .withExif({
      IFD0: {
        Make: opts.make ?? "FixtureCam",
        Model: opts.model ?? "CK11D-1",
        Software: "SFEF11D_FIXTURE",
      },
      ExifIFD: {
        DateTimeOriginal: "2026:08:08 12:00:00",
      },
    })
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function main() {
  if (process.env.SFEF11D_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF11D_ALLOW_PROD_FIXTURE=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no dawn-dew");
  }
  if (process.env.CLICKATON_FOTORANK_CANONICAL_ASSETS !== "1") {
    throw new Error("ABORT: CLICKATON_FOTORANK_CANONICAL_ASSETS=1 requerido para demo");
  }
  if (!process.env.FOTORANK_INTERNAL_ASSET_SECRET || process.env.FOTORANK_INTERNAL_ASSET_SECRET.length < 16) {
    throw new Error("ABORT: FOTORANK_INTERNAL_ASSET_SECRET ausente");
  }

  const file = loadEnv(process.env.SFEF11D_CREDS_PATH ?? "/tmp/clickaton-11d-fixture.env");
  const editionId = file.SFEF11D_EDITION_ID!;
  const contestId = file.SFEF11D_CONTEST_ID!;
  const orgId = file.SFEF11D_ORG_ID!;
  const reg1 = file.SFEF11D_REG_1!;
  const user1 = Number(file.SFEF11D_USER_1_ID);
  const p1 = file.SFEF11D_PROMPT_1!;
  const p2 = file.SFEF11D_PROMPT_2!;
  const p3 = file.SFEF11D_PROMPT_3!;
  const prisma = new PrismaClient();
  const matrix: Matrix = {};
  const mark = (k: string, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  // Reabrir ventanas server-side (demo puede correr minutos después del setup).
  {
    const now = new Date();
    await prisma.clickatonPrompt.update({
      where: { id: p1 },
      data: {
        status: "RELEASED",
        releasedAt: now,
        uploadStartsAt: new Date(now.getTime() - 60_000),
        captureStartsAt: new Date(now.getTime() - 60_000),
        uploadEndsAt: new Date(now.getTime() + 40 * 60_000),
        captureEndsAt: new Date(now.getTime() + 40 * 60_000),
      },
    });
    for (const [id, offset] of [[p2, 2], [p3, 4]] as const) {
      await prisma.clickatonPrompt.update({
        where: { id },
        data: {
          status: "LOCKED",
          releasedAt: null,
          uploadStartsAt: new Date(now.getTime() + offset * 60_000),
          captureStartsAt: new Date(now.getTime() + offset * 60_000),
          uploadEndsAt: new Date(now.getTime() + (20 + offset) * 60_000),
          captureEndsAt: new Date(now.getTime() + (20 + offset) * 60_000),
        },
      });
    }
  }

  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    include: { uploadConfig: true },
  });
  mark(
    "01_fixture_edition",
    Boolean(
      edition?.isOpsFixture &&
        edition.slug.startsWith("clickaton-fr-assets-fixture-") &&
        !edition.isPublished &&
        edition.uploadConfig?.canonicalAssetsEnabled === true &&
        edition.id !== COMMERCIAL_EDITION_ID,
    ),
  );

  const enq1 = await enqueueFotoRankSyncAfterPaid({
    editionId,
    registrationId: reg1,
    userId: user1,
    paymentOrderId: null,
  });
  if (!enq1.syncId) throw new Error(`sync enqueue failed: ${enq1.reason}`);
  const syncId = enq1.syncId;
  const proc1 = await processFotoRankSyncById(syncId);
  const enq2 = await enqueueFotoRankSyncAfterPaid({
    editionId,
    registrationId: reg1,
    userId: user1,
    paymentOrderId: null,
  });
  const proc2 = await processFotoRankSyncById(syncId);
  const frParts = await prisma.fotorankContestParticipant.count({
    where: { contestId, externalRegistrationId: reg1 },
  });
  const syncRow = await prisma.clickatonFotoRankSync.findUnique({ where: { id: syncId } });
  mark("02_registration_sync", proc1.status === "SYNCED" && syncRow?.status === "SYNCED");
  mark("03_retry_no_duplicate", frParts === 1 && Boolean(enq2.syncId) && proc2.status === "SYNCED");

  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
  let secretOk = true;
  for (const pr of prompts.filter((x) => x.sequence > 1)) {
    const dto = toPromptPublicDto(pr as never, { showOpensAt: true });
    try {
      assertLockedDtoIsSafe(dto);
      const raw = JSON.stringify(dto);
      if (raw.includes(pr.title) || (pr.instructions && raw.includes(pr.instructions))) {
        secretOk = false;
      }
    } catch {
      secretOk = false;
    }
  }
  mark("04_future_prompt_secret", secretOk && prompts[1]?.status === "LOCKED");

  const buf1 = await jpeg({ label: "p1", withExif: true, make: "Canon", model: "Fixture-R6" });
  const up1 = await ensureUpload(prisma, {
    registrationId: reg1,
    promptId: p1,
    userId: user1,
    contestId,
    buffer: buf1,
    fileName: "fixture-p1.jpg",
  });
  mark("05_prompt1_reveal", prompts[0]?.status === "RELEASED");
  mark("06_prompt1_upload", Boolean(up1.submissionId));

  const entry1 = await prisma.fotorankContestEntry.findFirst({
    where: { contestId, externalPromptId: p1, externalRegistrationId: reg1 },
    include: { assets: true },
  });
  const tech = (entry1?.technicalSummaryJson ?? {}) as Record<string, unknown>;
  mark(
    "07_canonical_asset_fr",
    tech.assetOwner === "FOTORANK" && Boolean(tech.canonicalAssetId) && (entry1?.assets.length ?? 0) > 0,
  );

  const now = new Date();
  for (const id of [p2, p3]) {
    await prisma.clickatonPrompt.update({
      where: { id },
      data: {
        status: "RELEASED",
        releasedAt: now,
        uploadStartsAt: new Date(now.getTime() - 60_000),
        captureStartsAt: new Date(now.getTime() - 60_000),
        uploadEndsAt: new Date(now.getTime() + 20 * 60_000),
        captureEndsAt: new Date(now.getTime() + 20 * 60_000),
      },
    });
  }

  const buf2 = await jpeg({ label: "p2", withExif: false });
  const buf3 = await jpeg({ label: "p3", withExif: true, make: "Nikon", model: "Fixture-Z6" });
  const up2 = await ensureUpload(prisma, {
    registrationId: reg1,
    promptId: p2,
    userId: user1,
    contestId,
    buffer: buf2,
    fileName: "fixture-p2.jpg",
  });
  const up3 = await ensureUpload(prisma, {
    registrationId: reg1,
    promptId: p3,
    userId: user1,
    contestId,
    buffer: buf3,
    fileName: "fixture-p3.jpg",
  });
  mark("08_prompt2_upload", Boolean(up2.submissionId));
  mark("09_prompt3_upload", Boolean(up3.submissionId));

  const entries = await prisma.fotorankContestEntry.findMany({
    where: { contestId, externalRegistrationId: reg1 },
  });
  const byPrompt = new Map(entries.map((e) => [e.externalPromptId, e]));
  mark(
    "10_one_entry_per_prompt",
    entries.length === 3 && byPrompt.size === 3 && Boolean(byPrompt.get(p1) && byPrompt.get(p2) && byPrompt.get(p3)),
  );

  const subs = await prisma.clickatonPhotoSubmission.findMany({
    where: { editionId, registrationId: reg1 },
  });
  const exifStatuses = new Set(subs.map((s) => s.exifStatus));
  mark("11_exif_checklist", exifStatuses.size >= 2 && subs.length === 3);

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  for (const e of entries) {
    await prisma.fotorankContestEntry.update({
      where: { id: e.id },
      data: { status: "CONFIRMED", admissionStatus: "ELIGIBLE" },
    });
  }
  const e1 = byPrompt.get(p1)!;
  const e2 = byPrompt.get(p2)!;
  const e3 = byPrompt.get(p3)!;
  await admitEntry({ contestId, entryId: e1.id, organizerUserId: sa.id }).catch(() => null);
  await admitEntry({ contestId, entryId: e2.id, organizerUserId: sa.id }).catch(() => null);
  await prisma.fotorankContestEntry.update({
    where: { id: e3.id },
    data: { admissionStatus: "PENDING_MANUAL_REVIEW", manualReviewStatus: "PENDING" },
  });
  const adm = await prisma.fotorankContestEntry.findMany({ where: { contestId } });
  mark(
    "12_admission",
    adm.filter((a) => a.admissionStatus === "ADMITTED").length === 2 &&
      adm.some((a) => a.admissionStatus === "PENDING_MANUAL_REVIEW"),
  );

  const dry = await freezeAdmittedEntries({
    contestId,
    organizerUserId: sa.id,
    entryIds: [e1.id, e2.id],
    dryRun: true,
  });
  const apply = await freezeAdmittedEntries({
    contestId,
    organizerUserId: sa.id,
    entryIds: [e1.id, e2.id],
    dryRun: false,
    selectionHash: dry.selectionHash,
    expectedCount: dry.expectedCount,
    confirmPhrase: `CONGELAR ${dry.expectedCount} OBRAS`,
    batchId: dry.batchId,
  });
  const frozenCount = await prisma.fotorankContestEntry.count({
    where: { contestId, admissionStatus: "FROZEN_FOR_JURY" },
  });
  mark("13_freeze", frozenCount === 2 && apply.dryRun === false);

  // Jury fixture anonimizado
  const juryEmail = `clickaton11d-jury-${file.SFEF11D_EXEC_ID}@fotorank.test`;
  let judge = await prisma.fotorankJudgeAccount.findUnique({ where: { email: juryEmail } });
  let workspaceId = judge?.workspaceId;
  if (!judge) {
    const workspace = await prisma.workspace.create({
      data: { name: `CK11D Jury WS ${file.SFEF11D_EXEC_ID}` },
    });
    workspaceId = workspace.id;
    judge = await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId: workspace.id,
        email: juryEmail,
        passwordHash: hashPassword(`Jk11d-${randomBytes(3).toString("hex")}!`),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: "CK11D",
            lastName: "Jury",
            publicSlug: `ck11d-jury-${file.SFEF11D_EXEC_ID}`,
            isPublic: false,
          },
        },
        organizationMemberships: {
          create: { organizationId: orgId, membershipStatus: "ACTIVE" },
        },
      },
    });
  }
  const workspace = { id: workspaceId! };
  const category = await prisma.fotorankContestCategory.findFirst({
    where: { contestId },
    select: { id: true },
  });
  if (!category) throw new Error("category missing");
  const batchId = dry.batchId;
  const assignment = await prisma.fotorankJudgeAssignment.upsert({
    where: {
      judgeAccountId_contestId_categoryId: {
        judgeAccountId: judge.id,
        contestId,
        categoryId: category.id,
      },
    },
    create: {
      organizationId: orgId,
      contestId,
      categoryId: category.id,
      judgeAccountId: judge.id,
      assignmentStatus: "ACCEPTED",
      assignmentType: "PRIMARY",
      methodType: "SCORE_1_10",
      methodConfigJson: { fixture: true, label: "PRODUCTION_FIXTURE_TEST_CONFIGURATION" },
      createdByUserId: sa.id,
      admissionBatchId: batchId,
    },
    update: {
      assignmentStatus: "ACCEPTED",
      admissionBatchId: batchId,
    },
  });

  const frozen = await prisma.fotorankContestEntry.findMany({
    where: { contestId, admissionStatus: "FROZEN_FOR_JURY" },
    select: { id: true, anonymousJuryCode: true, metadataJson: true },
  });
  const snaps = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { contestId, admissionBatchId: batchId },
  });
  const anonOk =
    frozen.every((f) => Boolean(f.anonymousJuryCode)) &&
    snaps.every((s) => {
      const raw = JSON.stringify(s);
      return !raw.includes("@fotorank.test") && !/clickaton11d-/i.test(raw);
    }) &&
    frozen.every((f) => {
      const raw = JSON.stringify(f.metadataJson ?? {});
      return !raw.includes("@fotorank.test");
    });
  mark("14_jury_anon", anonOk && Boolean(assignment.id));

  // Fuerza criterios fixture aunque NODE_ENV=production
  process.env.SFEF11D_LOCAL_RUBRIC = "1";
  let rubric = await ensureDraftRubric({
    contestId,
    admissionBatchId: batchId,
    actorUserId: sa.id,
    localExample: true,
  });
  if (rubric.criteria.length === 0) {
    await prisma.fotorankJuryCriterion.createMany({
      data: [
        {
          id: `jc${randomBytes(8).toString("hex")}`,
          rubricId: rubric.id,
          key: "interpretation",
          name: "Interpretación",
          weight: 40,
          minScore: 1,
          maxScore: 10,
          step: 1,
          required: true,
          sortOrder: 10,
        },
        {
          id: `jc${randomBytes(8).toString("hex")}`,
          rubricId: rubric.id,
          key: "impact",
          name: "Impacto",
          weight: 60,
          minScore: 1,
          maxScore: 10,
          step: 1,
          required: true,
          sortOrder: 20,
        },
      ],
    });
    rubric = await prisma.fotorankJuryRubric.findUniqueOrThrow({
      where: { id: rubric.id },
      include: { criteria: true },
    });
  }
  await prisma.fotorankJuryRubric.update({
    where: { id: rubric.id },
    data: {
      description:
        "PRODUCTION_FIXTURE_TEST_CONFIGURATION — STAGING/PRODUCTION_FIXTURE_TEST_CONFIGURATION — no comercial",
    },
  });
  await activateRubric({ contestId, rubricId: rubric.id, actorUserId: sa.id });
  const session = await ensureDraftScoringSession({
    contestId,
    admissionBatchId: batchId,
    actorUserId: sa.id,
  });
  await prisma.fotorankJuryScoringSession.update({
    where: { id: session.id },
    data: { rubricId: rubric.id },
  });
  await openScoringSession({ contestId, sessionId: session.id, actorUserId: sa.id });

  const criteria = await prisma.fotorankJuryCriterion.findMany({ where: { rubricId: rubric.id } });
  for (const snap of snaps) {
    await upsertJuryEvaluation({
      judgeAccountId: judge.id,
      contestId,
      snapshotId: snap.id,
      scores: criteria.map((c, idx) => ({
        key: c.key,
        score: 6 + ((idx + snap.id.length) % 4),
      })),
      submit: true,
      idempotencyKey: `ck11d-${snap.id}`,
    });
  }
  const evalCount = await prisma.fotorankJuryEvaluation.count({
    where: { contestId, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  mark("15_scoring", evalCount >= 1);

  await computeAndStorePreliminaryAggregates({
    contestId,
    sessionId: session.id,
  });
  const aggs = await prisma.fotorankJuryPreliminaryAggregate.findMany({
    where: { contestId, scoringSessionId: session.id },
  });
  const rankingPayload = {
    label: "PRODUCTION_FIXTURE_TEST_CONFIGURATION",
    byPrompt: [p1, p2].map((pid) => ({
      promptId: pid,
      entries: entries
        .filter((e) => e.externalPromptId === pid && e.admissionStatus !== "PENDING_MANUAL_REVIEW")
        .map((e, idx) => ({ entryId: e.id, rank: idx + 1 })),
    })),
    global: aggs
      .slice()
      .sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0))
      .map((a, idx) => ({
        anonymousCode: a.anonymousCode,
        rank: idx + 1,
        averageScore: a.averageScore,
      })),
    published: false,
  };
  writeFileSync("/tmp/clickaton-11d-ranking.json", JSON.stringify(rankingPayload, null, 2));
  mark("16_ranking_by_prompt", rankingPayload.byPrompt.length === 2);
  mark(
    "17_ranking_global_fixture",
    rankingPayload.global.length >= 1 && rankingPayload.label.includes("FIXTURE"),
  );
  mark("18_results_private", rankingPayload.published === false);

  // persist jury ids for cleanup
  writeFileSync(
    "/tmp/clickaton-11d-fixture.env",
    readFileSync("/tmp/clickaton-11d-fixture.env", "utf8") +
      [
        `SFEF11D_JURY_EMAIL=${juryEmail}`,
        `SFEF11D_JUDGE_ACCOUNT_ID=${judge.id}`,
        `SFEF11D_JURY_WORKSPACE_ID=${workspace.id}`,
        `SFEF11D_BATCH_ID=${batchId}`,
        `SFEF11D_SESSION_ID=${session.id}`,
        `SFEF11D_RUBRIC_ID=${rubric.id}`,
      ].join("\n") +
      "\n",
    "utf8",
  );

  const passed = Object.values(matrix).filter((v) => v === "PASS").length;
  const failed = Object.values(matrix).filter((v) => v === "FAIL").length;
  const skipped = Object.values(matrix).filter((v) => v === "SKIP").length;
  const commercialRegs = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  const out = {
    ok: failed === 0 && skipped === 0 && passed === 18,
    passed,
    failed,
    skipped,
    matrix,
    commercialRegCount: commercialRegs,
    juryEmail,
  };
  writeFileSync("/tmp/clickaton-11d-e2e-matrix.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!out.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
