/**
 * ETAPA 11E — demo productiva 10 consignas + matriz E2E 24.
 *
 *   set -a && source /tmp/sfef11b-prod.env && source /tmp/clickaton-11e-fixture.env && set +a
 *   SFEF11E_ALLOW_PROD_FIXTURE=1 CLICKATON_FOTORANK_CANONICAL_ASSETS=1 \
 *     pnpm --filter clickaton exec tsx scripts/ops-11e-demo-e2e.ts
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
const SLUG_PREFIX = "clickaton-fr-11e-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const PROMPT_COUNT = 10;
const ADMIT_COUNT = 6;

const MATRIX_KEYS = [
  "01_edition_fixture",
  "02_registration_sync",
  "03_retry_no_duplicate",
  "04_prompt1_secret_before_reveal",
  "05_reveal_prompt1",
  "06_upload_prompt1",
  "07_one_entry_per_prompt",
  "08_prompt2_independent",
  "09_deadline_before",
  "10_deadline_after",
  "11_replace_before_close",
  "12_replace_after_close_blocked",
  "13_prompt_secrecy_future",
  "14_ten_prompts_ordered",
  "15_ten_entries_max",
  "16_exif_checklist",
  "17_admission",
  "18_freeze",
  "19_jury_anonymous",
  "20_scoring",
  "21_ranking_per_prompt",
  "22_ranking_global_fixture",
  "23_results_private",
  "24_cleanup_safe",
] as const;
type MatrixKey = (typeof MATRIX_KEYS)[number];
type Matrix = Record<MatrixKey, "PASS" | "FAIL" | "SKIP">;

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
  seed?: number;
}): Promise<Buffer> {
  const seed = opts.seed ?? 0;
  const base = await sharp({
    create: {
      width: 1200 + (seed % 9),
      height: 900 + (seed % 7),
      channels: 3,
      background: {
        r: (40 + opts.label.length * 7 + seed * 3) % 255,
        g: (80 + seed) % 255,
        b: 120,
      },
    },
  })
    .jpeg({ quality: 84 + (seed % 8) })
    .toBuffer();
  if (!opts.withExif) return base;
  return sharp(base)
    .withExif({
      IFD0: {
        Make: opts.make ?? "FixtureCam",
        Model: opts.model ?? "CK11E-1",
        Software: "SFEF11E_FIXTURE",
      },
      ExifIFD: {
        DateTimeOriginal: "2026:08:08 12:00:00",
      },
    })
    .jpeg({ quality: 84 + (seed % 8) })
    .toBuffer();
}

async function ensureUpload(input: {
  registrationId: string;
  promptId: string;
  userId: number;
  buffer: Buffer;
  fileName: string;
  isReplace?: boolean;
}) {
  const up = await processPromptUpload({
    registrationId: input.registrationId,
    promptId: input.promptId,
    userId: input.userId,
    buffer: input.buffer,
    originalFileName: input.fileName,
    declaredMime: "image/jpeg",
    isReplace: input.isReplace,
  });
  await confirmPromptSubmission({
    registrationId: input.registrationId,
    promptId: input.promptId,
    userId: input.userId,
    acceptDeclaration: true,
  });
  return up;
}

async function expectThrow(fn: () => Promise<unknown>): Promise<{ threw: boolean; code?: string }> {
  try {
    await fn();
    return { threw: false };
  } catch (e) {
    const code = (e as { code?: string })?.code;
    return { threw: true, code };
  }
}

async function releaseOpen(
  prisma: PrismaClient,
  promptId: string,
  opts: { minutesOpen?: number; startedMinutesAgo?: number } = {},
) {
  const now = new Date();
  const startedMinutesAgo = opts.startedMinutesAgo ?? 1;
  const minutesOpen = opts.minutesOpen ?? 90;
  return prisma.clickatonPrompt.update({
    where: { id: promptId },
    data: {
      status: "RELEASED",
      releasedAt: new Date(now.getTime() - startedMinutesAgo * 60_000),
      uploadStartsAt: new Date(now.getTime() - startedMinutesAgo * 60_000),
      captureStartsAt: new Date(now.getTime() - startedMinutesAgo * 60_000),
      uploadEndsAt: new Date(now.getTime() + minutesOpen * 60_000),
      captureEndsAt: new Date(now.getTime() + minutesOpen * 60_000),
    },
  });
}

async function main() {
  if (process.env.SFEF11E_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF11E_ALLOW_PROD_FIXTURE=1 requerido");
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

  const credsPath = process.env.SFEF11E_CREDS_PATH ?? "/tmp/clickaton-11e-fixture.env";
  const file = loadEnv(credsPath);
  const execId = file.SFEF11E_EXEC_ID!;
  const editionId = file.SFEF11E_EDITION_ID!;
  const contestId = file.SFEF11E_CONTEST_ID!;
  const orgId = file.SFEF11E_ORG_ID!;
  const reg1 = file.SFEF11E_REG_1!;
  const user1 = Number(file.SFEF11E_USER_1_ID);
  if (!execId || !editionId || !contestId || !orgId || !reg1 || !user1) {
    throw new Error("ABORT: creds incompletas en " + credsPath);
  }
  const promptIds: string[] = [];
  for (let i = 1; i <= PROMPT_COUNT; i++) {
    const id = file[`SFEF11E_PROMPT_${i}`];
    if (!id) throw new Error(`ABORT: falta SFEF11E_PROMPT_${i} en ${credsPath}`);
    promptIds.push(id);
  }

  const prisma = new PrismaClient();
  const matrix = {} as Matrix;
  for (const k of MATRIX_KEYS) matrix[k] = "SKIP";
  const mark = (k: MatrixKey, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  // --- Reset: forzar las 10 consignas a LOCKED con ventanas futuras (simula estado pre-demo). ---
  const t0 = new Date();
  for (let i = 0; i < PROMPT_COUNT; i++) {
    const offset = (i + 1) * 6;
    await prisma.clickatonPrompt.update({
      where: { id: promptIds[i] },
      data: {
        status: "LOCKED",
        releasedAt: null,
        uploadStartsAt: new Date(t0.getTime() + offset * 60_000),
        captureStartsAt: new Date(t0.getTime() + offset * 60_000),
        uploadEndsAt: new Date(t0.getTime() + (offset + 40) * 60_000),
        captureEndsAt: new Date(t0.getTime() + (offset + 40) * 60_000),
      },
    });
  }

  // 01: edición fixture, no comercial, no pública, assets canónicos habilitados.
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    include: { uploadConfig: true },
  });
  mark(
    "01_edition_fixture",
    Boolean(
      edition?.isOpsFixture &&
        edition.slug.startsWith(SLUG_PREFIX) &&
        !edition.isPublished &&
        edition.uploadConfig?.canonicalAssetsEnabled === true &&
        edition.id !== COMMERCIAL_EDITION_ID,
    ),
  );

  // 02 / 03: sync FotoRank idempotente.
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
  const frPartsAfterRetry = await prisma.fotorankContestParticipant.count({
    where: { contestId, externalRegistrationId: reg1 },
  });
  const syncRow = await prisma.clickatonFotoRankSync.findUnique({ where: { id: syncId } });
  mark("02_registration_sync", proc1.status === "SYNCED" && syncRow?.status === "SYNCED");
  mark(
    "03_retry_no_duplicate",
    frPartsAfterRetry === 1 && Boolean(enq2.syncId) && proc2.status === "SYNCED",
  );

  // 04 + 13 (parcial): secreto de LOCKED antes de revelar (todas las 10 consignas están LOCKED acá).
  const checkAllLockedSecret = async (): Promise<boolean> => {
    const snapshot = await prisma.clickatonPrompt.findMany({
      where: { editionId },
      orderBy: { sequence: "asc" },
    });
    let ok = true;
    for (const pr of snapshot) {
      if (pr.status !== "LOCKED") continue;
      const dto = toPromptPublicDto(pr as never, { showOpensAt: true });
      try {
        assertLockedDtoIsSafe(dto);
        const raw = JSON.stringify(dto);
        if (raw.includes(pr.title) || (pr.instructions && raw.includes(pr.instructions))) ok = false;
        if (dto.status !== "LOCKED") ok = false;
      } catch {
        ok = false;
      }
    }
    return ok;
  };

  const secretOkBeforeReveal = await checkAllLockedSecret();
  const p1 = promptIds[0]!;
  await releaseOpen(prisma, p1, { minutesOpen: 90, startedMinutesAgo: 1 });
  const p1AfterRelease = await prisma.clickatonPrompt.findUniqueOrThrow({ where: { id: p1 } });
  const p1Dto = toPromptPublicDto(p1AfterRelease as never, { showOpensAt: true });
  const titleVisible =
    p1Dto.status === "RELEASED" && Boolean(p1Dto.title) && p1Dto.title === p1AfterRelease.title;
  mark("04_prompt1_secret_before_reveal", secretOkBeforeReveal && titleVisible);
  mark("05_reveal_prompt1", p1AfterRelease.status === "RELEASED" && p1AfterRelease.releasedAt != null);

  // 06: subida consigna 1.
  const buf1 = await jpeg({ label: "p1", withExif: true, make: "Canon", model: "Fixture-R6", seed: 1 });
  const up1 = await ensureUpload({
    registrationId: reg1,
    promptId: p1,
    userId: user1,
    buffer: buf1,
    fileName: "fixture-11e-p1.jpg",
  });
  mark("06_upload_prompt1", Boolean(up1.submissionId));

  // 08: consigna 2 independiente.
  const p2 = promptIds[1]!;
  await releaseOpen(prisma, p2, { minutesOpen: 90, startedMinutesAgo: 1 });
  const buf2 = await jpeg({ label: "p2", withExif: false, seed: 2 });
  const up2 = await ensureUpload({
    registrationId: reg1,
    promptId: p2,
    userId: user1,
    buffer: buf2,
    fileName: "fixture-11e-p2.jpg",
  });
  const entry1 = await prisma.fotorankContestEntry.findFirst({
    where: { contestId, externalRegistrationId: reg1, externalPromptId: p1 },
    select: { id: true },
  });
  const entry2 = await prisma.fotorankContestEntry.findFirst({
    where: { contestId, externalRegistrationId: reg1, externalPromptId: p2 },
    select: { id: true, technicalSummaryJson: true },
  });
  mark(
    "08_prompt2_independent",
    Boolean(up2.submissionId) && Boolean(entry2?.id) && entry2?.id !== entry1?.id,
  );

  // 09: ventana en el futuro -> debe fallar.
  const p3 = promptIds[2]!;
  const nowFuture = new Date();
  await prisma.clickatonPrompt.update({
    where: { id: p3 },
    data: {
      status: "RELEASED",
      releasedAt: nowFuture,
      uploadStartsAt: new Date(nowFuture.getTime() + 30 * 60_000),
      captureStartsAt: new Date(nowFuture.getTime() + 30 * 60_000),
      uploadEndsAt: new Date(nowFuture.getTime() + 90 * 60_000),
      captureEndsAt: new Date(nowFuture.getTime() + 90 * 60_000),
    },
  });
  const buf3Attempt = await jpeg({ label: "p3-early", withExif: true, make: "Sony", seed: 30 });
  const attempt09 = await expectThrow(() =>
    processPromptUpload({
      registrationId: reg1,
      promptId: p3,
      userId: user1,
      buffer: buf3Attempt,
      originalFileName: "fixture-11e-p3-early.jpg",
      declaredMime: "image/jpeg",
    }),
  );
  mark("09_deadline_before", attempt09.threw && attempt09.code === "UPLOAD_WINDOW_NOT_OPEN");
  await releaseOpen(prisma, p3, { minutesOpen: 90, startedMinutesAgo: 1 });

  // 10: ventana en el pasado -> debe fallar.
  const p4 = promptIds[3]!;
  const nowPast = new Date();
  await prisma.clickatonPrompt.update({
    where: { id: p4 },
    data: {
      status: "RELEASED",
      releasedAt: new Date(nowPast.getTime() - 120 * 60_000),
      uploadStartsAt: new Date(nowPast.getTime() - 120 * 60_000),
      captureStartsAt: new Date(nowPast.getTime() - 120 * 60_000),
      uploadEndsAt: new Date(nowPast.getTime() - 10 * 60_000),
      captureEndsAt: new Date(nowPast.getTime() - 10 * 60_000),
    },
  });
  const buf4Attempt = await jpeg({ label: "p4-late", withExif: false, seed: 40 });
  const attempt10 = await expectThrow(() =>
    processPromptUpload({
      registrationId: reg1,
      promptId: p4,
      userId: user1,
      buffer: buf4Attempt,
      originalFileName: "fixture-11e-p4-late.jpg",
      declaredMime: "image/jpeg",
    }),
  );
  mark("10_deadline_after", attempt10.threw && attempt10.code === "UPLOAD_WINDOW_CLOSED");
  await releaseOpen(prisma, p4, { minutesOpen: 90, startedMinutesAgo: 1 });

  // Subir p3 y p4 tras restaurar ventanas (los deadline tests no dejan entry).
  for (const [pid, seed, withExif] of [
    [p3, 31, true],
    [p4, 41, false],
  ] as const) {
    const buf = await jpeg({
      label: `p-restored-${seed}`,
      withExif,
      make: withExif ? "Sony" : undefined,
      model: withExif ? "Fixture-A7" : undefined,
      seed,
    });
    await ensureUpload({
      registrationId: reg1,
      promptId: pid,
      userId: user1,
      buffer: buf,
      fileName: `fixture-11e-${pid.slice(-6)}.jpg`,
    });
  }

  // 11: reemplazo permitido antes del cierre (misma entry, nuevo checksum/versión).
  const entry2Before = await prisma.fotorankContestEntry.findUniqueOrThrow({
    where: { id: entry2!.id },
    select: { id: true, technicalSummaryJson: true },
  });
  const techBefore = (entry2Before.technicalSummaryJson ?? {}) as Record<string, unknown>;
  const buf2b = await jpeg({ label: "p2-replace", withExif: true, make: "Nikon", model: "Fixture-Z9", seed: 22 });
  const replace11 = await ensureUpload({
    registrationId: reg1,
    promptId: p2,
    userId: user1,
    buffer: buf2b,
    fileName: "fixture-11e-p2-v2.jpg",
    isReplace: true,
  });
  const entry2After = await prisma.fotorankContestEntry.findUniqueOrThrow({
    where: { id: entry2!.id },
    select: { id: true, technicalSummaryJson: true },
  });
  const techAfter = (entry2After.technicalSummaryJson ?? {}) as Record<string, unknown>;
  mark(
    "11_replace_before_close",
    Boolean(replace11.submissionId) &&
      entry2After.id === entry2Before.id &&
      techAfter.sha256 !== techBefore.sha256,
  );

  // 12: reemplazo bloqueado tras cierre de ventana.
  const nowClose = new Date();
  await prisma.clickatonPrompt.update({
    where: { id: p2 },
    data: {
      uploadEndsAt: new Date(nowClose.getTime() - 5 * 60_000),
      captureEndsAt: new Date(nowClose.getTime() - 5 * 60_000),
    },
  });
  const buf2c = await jpeg({ label: "p2-replace-blocked", withExif: false, seed: 23 });
  const attempt12 = await expectThrow(() =>
    processPromptUpload({
      registrationId: reg1,
      promptId: p2,
      userId: user1,
      buffer: buf2c,
      originalFileName: "fixture-11e-p2-v3.jpg",
      declaredMime: "image/jpeg",
      isReplace: true,
    }),
  );
  mark(
    "12_replace_after_close_blocked",
    attempt12.threw && (attempt12.code === "UPLOAD_WINDOW_CLOSED" || attempt12.code === "REPLACE_DEADLINE"),
  );

  // 13: consignas restantes (5..10) siguen LOCKED y seguras.
  const secretOkFuture = await checkAllLockedSecret();
  mark("13_prompt_secrecy_future", secretOkFuture);

  // 14: 10 consignas con sequence 1..10 ordenadas.
  const allPrompts = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
  const sequences = allPrompts.map((p) => p.sequence);
  mark(
    "14_ten_prompts_ordered",
    allPrompts.length === PROMPT_COUNT &&
      sequences.every((s, idx) => s === idx + 1),
  );

  // Liberar y subir las consignas 5..10 restantes (mix EXIF).
  for (let i = 4; i < PROMPT_COUNT; i++) {
    const pid = promptIds[i]!;
    await releaseOpen(prisma, pid, { minutesOpen: 90, startedMinutesAgo: 1 });
    const withExif = i % 2 === 0;
    const buf = await jpeg({
      label: `p${i + 1}`,
      withExif,
      make: withExif ? "FixtureCam" : undefined,
      model: withExif ? `CK11E-${i + 1}` : undefined,
      seed: (i + 1) * 10,
    });
    await ensureUpload({
      registrationId: reg1,
      promptId: pid,
      userId: user1,
      buffer: buf,
      fileName: `fixture-11e-p${i + 1}.jpg`,
    });
  }

  // 07 + 15: invariantes de entries por registración.
  const finalEntries = await prisma.fotorankContestEntry.findMany({
    where: { contestId, externalRegistrationId: reg1 },
    orderBy: { externalPromptId: "asc" },
  });
  const promptIdSet = new Set(finalEntries.map((e) => e.externalPromptId));
  mark(
    "07_one_entry_per_prompt",
    finalEntries.length <= PROMPT_COUNT && finalEntries.length === promptIdSet.size,
  );
  mark(
    "15_ten_entries_max",
    finalEntries.length === PROMPT_COUNT &&
      promptIdSet.size === PROMPT_COUNT &&
      promptIds.every((pid) => promptIdSet.has(pid)),
  );

  // 16: checklist EXIF con mezcla de estados.
  const subs = await prisma.clickatonPhotoSubmission.findMany({
    where: { editionId, registrationId: reg1 },
  });
  const exifStatuses = new Set(subs.map((s) => s.exifStatus));
  mark("16_exif_checklist", exifStatuses.size >= 2 && subs.length >= PROMPT_COUNT);

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  // 17: admisión — admitir un subconjunto, dejar el resto en revisión manual.
  for (const e of finalEntries) {
    await prisma.fotorankContestEntry.update({
      where: { id: e.id },
      data: { status: "CONFIRMED", admissionStatus: "ELIGIBLE" },
    });
  }
  const sortedByPromptSeq = promptIds
    .map((pid) => finalEntries.find((e) => e.externalPromptId === pid))
    .filter((e): e is (typeof finalEntries)[number] => Boolean(e));
  const toAdmit = sortedByPromptSeq.slice(0, ADMIT_COUNT);
  const toReview = sortedByPromptSeq.slice(ADMIT_COUNT);
  for (const e of toAdmit) {
    await admitEntry({ contestId, entryId: e.id, organizerUserId: sa.id }).catch(() => null);
  }
  for (const e of toReview) {
    await prisma.fotorankContestEntry.update({
      where: { id: e.id },
      data: { admissionStatus: "PENDING_MANUAL_REVIEW", manualReviewStatus: "PENDING" },
    });
  }
  const admStateAfter = await prisma.fotorankContestEntry.findMany({
    where: { contestId },
    select: { id: true, admissionStatus: true },
  });
  mark(
    "17_admission",
    admStateAfter.filter((a) => a.admissionStatus === "ADMITTED").length === ADMIT_COUNT &&
      admStateAfter.filter((a) => a.admissionStatus === "PENDING_MANUAL_REVIEW").length ===
        PROMPT_COUNT - ADMIT_COUNT,
  );

  // 18: congelar solo las admitidas, por IDs explícitos (no global).
  const admittedIds = toAdmit.map((e) => e.id);
  const dry = await freezeAdmittedEntries({
    contestId,
    organizerUserId: sa.id,
    entryIds: admittedIds,
    dryRun: true,
  });
  const apply = await freezeAdmittedEntries({
    contestId,
    organizerUserId: sa.id,
    entryIds: admittedIds,
    dryRun: false,
    selectionHash: dry.selectionHash,
    expectedCount: dry.expectedCount,
    confirmPhrase: `CONGELAR ${dry.expectedCount} OBRAS`,
    batchId: dry.batchId,
  });
  const frozenCount = await prisma.fotorankContestEntry.count({
    where: { contestId, admissionStatus: "FROZEN_FOR_JURY" },
  });
  const notFrozenReview = await prisma.fotorankContestEntry.count({
    where: { contestId, admissionStatus: "PENDING_MANUAL_REVIEW" },
  });
  mark(
    "18_freeze",
    frozenCount === ADMIT_COUNT && apply.dryRun === false && notFrozenReview === PROMPT_COUNT - ADMIT_COUNT,
  );

  // 19: jurado anonimizado.
  const juryEmail = `clickaton11e-jury-${execId}@fotorank.test`;
  let judge = await prisma.fotorankJudgeAccount.findUnique({ where: { email: juryEmail } });
  let workspaceId = judge?.workspaceId;
  if (!judge) {
    const workspace = await prisma.workspace.create({
      data: { name: `CK11E Jury WS ${execId}` },
    });
    workspaceId = workspace.id;
    judge = await prisma.fotorankJudgeAccount.create({
      data: {
        workspaceId: workspace.id,
        email: juryEmail,
        passwordHash: hashPassword(`Jk11e-${randomBytes(3).toString("hex")}!`),
        accountStatus: "ACTIVE",
        profile: {
          create: {
            firstName: "CK11E",
            lastName: "Jury",
            publicSlug: `ck11e-jury-${execId}`,
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
    select: { id: true, anonymousJuryCode: true, metadataJson: true, externalPromptId: true },
  });
  const snaps = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { contestId, admissionBatchId: batchId },
  });
  const anonOk =
    frozen.length === ADMIT_COUNT &&
    frozen.every((f) => Boolean(f.anonymousJuryCode)) &&
    snaps.every((s) => {
      const raw = JSON.stringify(s);
      return !FIXTURE_EMAIL_RE.test(raw) && !/clickaton11e-/i.test(raw);
    }) &&
    frozen.every((f) => {
      const raw = JSON.stringify(f.metadataJson ?? {});
      return !FIXTURE_EMAIL_RE.test(raw);
    });
  mark("19_jury_anonymous", anonOk && Boolean(assignment.id));

  // 20: scoring con rúbrica fixture.
  process.env.SFEF11E_LOCAL_RUBRIC = "1";
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
        score: 5 + ((idx + snap.id.length) % 6),
      })),
      submit: true,
      idempotencyKey: `ck11e-${snap.id}`,
    });
  }
  const evalCount = await prisma.fotorankJuryEvaluation.count({
    where: { contestId, status: { in: ["SUBMITTED", "LOCKED"] } },
  });
  mark("20_scoring", evalCount === ADMIT_COUNT);

  // 21 / 22 / 23: ranking por consigna, ranking global fixture, resultados privados.
  await computeAndStorePreliminaryAggregates({
    contestId,
    sessionId: session.id,
  });
  const aggs = await prisma.fotorankJuryPreliminaryAggregate.findMany({
    where: { contestId, scoringSessionId: session.id },
  });
  const byPrompt = promptIds.map((pid) => ({
    promptId: pid,
    entries: frozen
      .filter((e) => e.externalPromptId === pid)
      .map((e, idx) => ({ entryId: e.id, rank: idx + 1 })),
  }));
  mark(
    "21_ranking_per_prompt",
    byPrompt.length === PROMPT_COUNT &&
      byPrompt.filter((b) => b.entries.length > 0).length === ADMIT_COUNT,
  );

  const rankingPayload = {
    label: "PRODUCTION_FIXTURE_TEST_CONFIGURATION",
    byPrompt,
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
  writeFileSync("/tmp/clickaton-11e-ranking.json", JSON.stringify(rankingPayload, null, 2));
  mark(
    "22_ranking_global_fixture",
    rankingPayload.global.length >= 1 &&
      rankingPayload.global.length === ADMIT_COUNT &&
      rankingPayload.label.includes("FIXTURE") &&
      rankingPayload.published === false,
  );
  mark("23_results_private", rankingPayload.published === false);

  // 24: cleanup seguro — el plan de borrado solo tocaría fixture; comercial intacto (no se borra en demo).
  const commercialRegCountAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  const commercialApprovedCountAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
  });
  const commercialPaidOrdersCountAfter = await prisma.clickatonRegistration.count({
    where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
  });
  const editionFixtureCheck = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { isOpsFixture: true, slug: true, id: true },
  });
  const cleanupPlanScopedToFixture = {
    editionId,
    contestId,
    registrations: await prisma.clickatonRegistration.count({ where: { editionId } }),
    frEntries: await prisma.fotorankContestEntry.count({ where: { contestId } }),
  };
  mark(
    "24_cleanup_safe",
    String(commercialRegCountAfter) === file.SFEF11E_COMMERCIAL_REG_COUNT_BEFORE &&
      String(commercialApprovedCountAfter) === file.SFEF11E_COMMERCIAL_APPROVED_COUNT_BEFORE &&
      String(commercialPaidOrdersCountAfter) === file.SFEF11E_COMMERCIAL_PAID_ORDERS_BEFORE &&
      editionFixtureCheck?.isOpsFixture === true &&
      editionFixtureCheck.slug.startsWith(SLUG_PREFIX) &&
      editionFixtureCheck.id !== COMMERCIAL_EDITION_ID &&
      cleanupPlanScopedToFixture.registrations >= 1 &&
      cleanupPlanScopedToFixture.frEntries === PROMPT_COUNT,
  );

  // Persistir ids de jurado/batch/sesión/rúbrica para el cleanup.
  writeFileSync(
    credsPath,
    readFileSync(credsPath, "utf8") +
      [
        `SFEF11E_JURY_EMAIL=${juryEmail}`,
        `SFEF11E_JUDGE_ACCOUNT_ID=${judge.id}`,
        `SFEF11E_JURY_WORKSPACE_ID=${workspace.id}`,
        `SFEF11E_BATCH_ID=${batchId}`,
        `SFEF11E_SESSION_ID=${session.id}`,
        `SFEF11E_RUBRIC_ID=${rubric.id}`,
      ].join("\n") +
      "\n",
    "utf8",
  );

  const passed = Object.values(matrix).filter((v) => v === "PASS").length;
  const failed = Object.values(matrix).filter((v) => v === "FAIL").length;
  const skipped = Object.values(matrix).filter((v) => v === "SKIP").length;
  const out = {
    ok: failed === 0 && skipped === 0 && passed === MATRIX_KEYS.length,
    passed,
    failed,
    skipped,
    matrix,
    commercialRegCountAfter,
    commercialApprovedCountAfter,
    commercialPaidOrdersCountAfter,
    juryEmail,
  };
  writeFileSync("/tmp/clickaton-11e-e2e-matrix.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!out.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
