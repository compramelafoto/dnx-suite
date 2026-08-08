/**
 * ETAPA 12 — matriz E2E (20 claves) de reveal GLOBAL + ventanas captura/carga
 * independientes a nivel edición (maratón).
 *
 *   set -a && source /tmp/clickaton-12-fixture.env && set +a
 *   SFEF12_ALLOW_PROD_FIXTURE=1 \
 *     pnpm --filter clickaton exec tsx scripts/ops-12-demo-e2e.ts
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
  confirmPromptSubmission,
  processPromptUpload,
} from "../lib/photo-upload/service";
import {
  arePromptsGloballyRevealed,
  getCapturePhase,
  getUploadPhase,
  resolveEditionSchedule,
} from "../lib/photo-upload/edition-schedule";
import {
  evaluateCaptureDate,
  getUploadWindowState,
  resolveEffectiveWindows,
} from "../lib/photo-upload/windows";
import {
  assertLockedDtoIsSafe,
  toPromptPublicDto,
} from "../lib/timeline/prompt-dto";
import { fixedClock } from "../lib/timeline/clock";

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const SLUG_PREFIX = "clickaton-fr-12-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const PROMPT_COUNT = 10;

const MATRIX_KEYS = [
  "01_before_reveal_no_leak",
  "02_reveal_shows_all_10",
  "03_capture_active",
  "04_capture_closed_upload_open",
  "05_upload_open_accepts",
  "06_upload_closed_rejects",
  "07_exif_valid",
  "08_exif_out_of_range_review",
  "09_no_exif_review",
  "10_replace_within_window",
  "11_replace_after_close_blocked",
  "12_progress_1_of_10",
  "13_progress_10_of_10",
  "14_test_mode_enter",
  "15_virtual_clock_test",
  "16_preview_participant_ui",
  "17_test_upload",
  "18_cleanup_test_dry",
  "19_commercial_counts_intact",
  "20_santa_fe_untouched",
] as const;
type MatrixKey = (typeof MATRIX_KEYS)[number];
type Matrix = Record<MatrixKey, "PASS" | "FAIL" | "SKIP">;

type PrismaClientType = InstanceType<typeof PrismaClient>;
type UploadConfigRow = Awaited<ReturnType<PrismaClientType["clickatonEditionUploadConfig"]["update"]>>;

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

/** Serializa una fecha a formato EXIF "YYYY:MM:DD HH:MM:SS" en hora LOCAL del proceso
 * (exifr revive las fechas EXIF como hora local — simétrico con new Date(y,m-1,d,h,mi,s)). */
function exifDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function jpeg(opts: {
  withExif: boolean;
  captureDate?: Date;
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
        r: (40 + seed * 3) % 255,
        g: (80 + seed) % 255,
        b: 130,
      },
    },
  })
    .jpeg({ quality: 84 + (seed % 8) })
    .toBuffer();
  if (!opts.withExif) return base;
  return sharp(base)
    .withExif({
      IFD0: { Make: opts.make ?? "FixtureCam12", Model: opts.model ?? "CK12-1" },
      // NOTA: DateTimeOriginal va en IFD2 (mapeo libvips del Exif IFD "photo"),
      // NO en "ExifIFD" (clave inexistente para sharp/libvips — se descarta en silencio).
      IFD2: { DateTimeOriginal: exifDateString(opts.captureDate ?? new Date()) },
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

async function setEditionWindow(
  prisma: PrismaClientType,
  editionId: string,
  offsetsMin: {
    reveal: number;
    captureStart: number;
    captureEnd: number | null;
    uploadStart: number;
    uploadEnd: number | null;
  },
): Promise<UploadConfigRow> {
  const now = new Date();
  const at = (m: number | null) => (m == null ? null : new Date(now.getTime() + m * 60_000));
  return prisma.clickatonEditionUploadConfig.update({
    where: { editionId },
    data: {
      globalPromptReveal: true,
      eventRevealAt: at(offsetsMin.reveal),
      captureWindowStartsAt: at(offsetsMin.captureStart),
      captureWindowEndsAt: at(offsetsMin.captureEnd),
      uploadWindowStartsAt: at(offsetsMin.uploadStart),
      uploadWindowEndsAt: at(offsetsMin.uploadEnd),
      allowReplacement: true,
    },
  });
}

async function main() {
  if (process.env.SFEF12_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF12_ALLOW_PROD_FIXTURE=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no dawn-dew");
  }

  const credsPath = process.env.SFEF12_CREDS_PATH ?? "/tmp/clickaton-12-fixture.env";
  const file = loadEnv(credsPath);
  const execId = file.SFEF12_EXEC_ID!;
  const editionId = file.SFEF12_EDITION_ID!;
  const contestId = file.SFEF12_CONTEST_ID!;
  const ticketId = file.SFEF12_TICKET_ID!;
  const reg1 = file.SFEF12_REG_1!;
  const user1 = Number(file.SFEF12_USER_1_ID);
  if (!execId || !editionId || !contestId || !ticketId || !reg1 || !user1) {
    throw new Error("ABORT: creds incompletas en " + credsPath);
  }
  const promptIds: string[] = [];
  for (let i = 1; i <= PROMPT_COUNT; i++) {
    const id = file[`SFEF12_PROMPT_${i}`];
    if (!id) throw new Error(`ABORT: falta SFEF12_PROMPT_${i} en ${credsPath}`);
    promptIds.push(id);
  }
  if (editionId === COMMERCIAL_EDITION_ID) {
    throw new Error("ABORT: editionId coincide con edición comercial");
  }

  const prisma = new PrismaClient();
  const matrix = {} as Matrix;
  for (const k of MATRIX_KEYS) matrix[k] = "SKIP";
  const mark = (k: MatrixKey, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  const editionCheck = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { id: true, slug: true, isOpsFixture: true, timezone: true },
  });
  if (!editionCheck.isOpsFixture || !editionCheck.slug.startsWith(SLUG_PREFIX)) {
    throw new Error("ABORT: edición no es fixture 12");
  }

  const commercialCount = async () => ({
    regs: await prisma.clickatonRegistration.count({ where: { editionId: COMMERCIAL_EDITION_ID } }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
    }),
  });
  const commercialBefore = await commercialCount();

  // ============================================================
  // FASE 1 — antes del reveal global (todas las consignas en el futuro).
  // ============================================================
  await setEditionWindow(prisma, editionId, {
    reveal: 60,
    captureStart: 60,
    captureEnd: 180,
    uploadStart: 60,
    uploadEnd: 300,
  });
  const config1 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({ where: { editionId } });
  const promptsPhase1 = await prisma.clickatonPrompt.findMany({ where: { editionId }, orderBy: { sequence: "asc" } });
  const schedule1 = resolveEditionSchedule(config1);

  let phase1Ok = promptsPhase1.length === PROMPT_COUNT && !arePromptsGloballyRevealed(schedule1);
  for (const p of promptsPhase1) {
    try {
      const dto = toPromptPublicDto(p as never, { editionSchedule: config1, showOpensAt: true });
      if (dto.status !== "LOCKED") phase1Ok = false;
      assertLockedDtoIsSafe(dto);
      const raw = JSON.stringify(dto);
      if (raw.includes(p.title ?? "\u0000") || (p.instructions && raw.includes(p.instructions))) phase1Ok = false;
    } catch {
      phase1Ok = false;
    }
  }
  mark("01_before_reveal_no_leak", phase1Ok);

  // ============================================================
  // FASE 2 — reveal global activo + captura y carga abiertas.
  // ============================================================
  await setEditionWindow(prisma, editionId, {
    reveal: -1,
    captureStart: -1,
    captureEnd: 120,
    uploadStart: -1,
    uploadEnd: 240,
  });
  const config2 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({ where: { editionId } });
  const promptsPhase2 = await prisma.clickatonPrompt.findMany({ where: { editionId }, orderBy: { sequence: "asc" } });
  const schedule2 = resolveEditionSchedule(config2);

  let allReleased = promptsPhase2.length === PROMPT_COUNT;
  for (const p of promptsPhase2) {
    const dto = toPromptPublicDto(p as never, { editionSchedule: config2 });
    if (dto.status !== "RELEASED" || dto.title !== p.title) allReleased = false;
  }
  mark("02_reveal_shows_all_10", allReleased && arePromptsGloballyRevealed(schedule2));

  const capturePhase2 = getCapturePhase(schedule2);
  const uploadPhase2 = getUploadPhase(schedule2);
  mark("03_capture_active", capturePhase2 === "OPEN" && uploadPhase2 === "OPEN");

  // 16: DTO revelado + ventanas de maratón consistentes ("vista participante").
  const p1Dto = toPromptPublicDto(promptsPhase2[0] as never, { editionSchedule: config2 });
  const windowsP1 = resolveEffectiveWindows(promptsPhase2[0] as never, config2);
  mark(
    "16_preview_participant_ui",
    p1Dto.status === "RELEASED" &&
      p1Dto.captureEndsAt != null &&
      p1Dto.uploadEndsAt != null &&
      schedule2.globalPromptReveal === true &&
      windowsP1.captureStartsAt?.toISOString() === config2.captureWindowStartsAt?.toISOString() &&
      windowsP1.uploadEndsAt?.toISOString() === config2.uploadWindowEndsAt?.toISOString(),
  );

  // 15: reloj virtual (fixedClock) independiente del reloj real — antes/después del reveal.
  const nowRef = new Date();
  const beforeRevealClock = fixedClock(new Date(nowRef.getTime() - 30 * 60_000));
  const afterRevealClock = fixedClock(new Date(nowRef.getTime() + 1 * 60_000));
  const revealedWithPastClock = arePromptsGloballyRevealed(schedule2, beforeRevealClock);
  const revealedWithFutureClock = arePromptsGloballyRevealed(schedule2, afterRevealClock);
  const captureWithPastClock = getCapturePhase(schedule2, beforeRevealClock);
  const captureWithFutureClock = getCapturePhase(schedule2, afterRevealClock);
  mark(
    "15_virtual_clock_test",
    revealedWithPastClock === false &&
      revealedWithFutureClock === true &&
      captureWithPastClock === "NOT_OPEN" &&
      captureWithFutureClock === "OPEN",
  );

  // 07: EXIF válido dentro de la ventana de captura -> PASS.
  const p1 = promptIds[0]!;
  const capStart2 = config2.captureWindowStartsAt!;
  const capEnd2 = config2.captureWindowEndsAt!;
  const buf1 = await jpeg({
    withExif: true,
    captureDate: new Date(capStart2.getTime() + 10 * 60_000),
    make: "Canon",
    model: "Fixture12-R6",
    seed: 1,
  });
  await ensureUpload({ registrationId: reg1, promptId: p1, userId: user1, buffer: buf1, fileName: "fixture-12-p1.jpg" });
  const sub1 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: reg1, promptId: p1 } },
  });
  // Verificación cruzada e independiente del validador de captura (windows.ts).
  const directEval1 = evaluateCaptureDate({
    captureDate: new Date(capStart2.getTime() + 10 * 60_000),
    windows: windowsP1,
    toleranceMinutes: 5,
    timezone: editionCheck.timezone ?? "America/Argentina/Buenos_Aires",
  });
  mark(
    "07_exif_valid",
    sub1.status === "CONFIRMED" && sub1.validationResult === "PASS" && directEval1.result === "PASS",
  );

  // 12: progreso 1/10 confirmadas justo después de la primera consigna.
  const confirmedAfterP1 = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: reg1, status: "CONFIRMED" },
  });
  mark("12_progress_1_of_10", confirmedAfterP1 === 1);

  // 08: EXIF fuera de rango (moderado, no extremo) -> MANUAL_REVIEW.
  const p2 = promptIds[1]!;
  const buf2 = await jpeg({
    withExif: true,
    captureDate: new Date(capEnd2.getTime() + 15 * 60_000),
    make: "Sony",
    model: "Fixture12-A7",
    seed: 2,
  });
  await ensureUpload({ registrationId: reg1, promptId: p2, userId: user1, buffer: buf2, fileName: "fixture-12-p2.jpg" });
  const sub2 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: reg1, promptId: p2 } },
  });
  const tech2 = (sub2.technicalSummaryJson ?? {}) as Record<string, unknown>;
  const captureEval2 = tech2.captureEval as { reason?: string } | undefined;
  mark(
    "08_exif_out_of_range_review",
    sub2.validationResult === "MANUAL_REVIEW" && captureEval2?.reason === "CAPTURE_OUTSIDE_WINDOW",
  );

  // 09: sin EXIF -> MANUAL_REVIEW (EXIF_CAPTURE_DATE_ABSENT).
  const p3 = promptIds[2]!;
  const buf3 = await jpeg({ withExif: false, seed: 3 });
  await ensureUpload({ registrationId: reg1, promptId: p3, userId: user1, buffer: buf3, fileName: "fixture-12-p3.jpg" });
  const sub3 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: reg1, promptId: p3 } },
  });
  const tech3 = (sub3.technicalSummaryJson ?? {}) as Record<string, unknown>;
  const captureEval3 = tech3.captureEval as { reason?: string } | undefined;
  mark(
    "09_no_exif_review",
    sub3.validationResult === "MANUAL_REVIEW" && captureEval3?.reason === "EXIF_CAPTURE_DATE_ABSENT",
  );

  // 10: reemplazo dentro de ventana abierta -> mismo submission, nuevo checksum.
  const shaBefore10 = sub1.sha256;
  const buf1b = await jpeg({
    withExif: true,
    captureDate: new Date(capStart2.getTime() + 20 * 60_000),
    make: "Nikon",
    model: "Fixture12-Z9",
    seed: 11,
  });
  await ensureUpload({
    registrationId: reg1,
    promptId: p1,
    userId: user1,
    buffer: buf1b,
    fileName: "fixture-12-p1-v2.jpg",
    isReplace: true,
  });
  const sub1After = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: reg1, promptId: p1 } },
  });
  mark(
    "10_replace_within_window",
    sub1After.status === "CONFIRMED" && sub1After.sha256 !== shaBefore10 && sub1After.sha256 != null,
  );

  // Subir + confirmar las 7 consignas restantes (4..10) para completar 10/10.
  for (let i = 3; i < PROMPT_COUNT; i++) {
    const pid = promptIds[i]!;
    const withExif = i % 2 === 0;
    const buf = await jpeg({
      withExif,
      captureDate: withExif ? new Date(capStart2.getTime() + (i + 1) * 5 * 60_000) : undefined,
      make: withExif ? "FixtureCam12" : undefined,
      model: withExif ? `CK12-${i + 1}` : undefined,
      seed: (i + 1) * 10,
    });
    await ensureUpload({
      registrationId: reg1,
      promptId: pid,
      userId: user1,
      buffer: buf,
      fileName: `fixture-12-p${i + 1}.jpg`,
    });
  }
  const confirmedAll = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: reg1, status: "CONFIRMED" },
  });
  mark("13_progress_10_of_10", confirmedAll === PROMPT_COUNT);

  // 14: entrar en Modo Test — inscripción aislada isOpsTest=true, email @fotorank.test.
  const now14 = new Date();
  const testEmail = `clickaton12-test-${execId}-${randomBytes(2).toString("hex")}@fotorank.test`;
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    create: {
      email: testEmail,
      name: "CK12 Test Mode",
      password: hashPassword(`Ck12Test-${randomBytes(3).toString("hex")}!`),
      role: "CUSTOMER",
      globalRole: "USER",
      emailVerifiedAt: now14,
    },
    update: { emailVerifiedAt: now14 },
    select: { id: true, email: true },
  });
  const testReg = await prisma.clickatonRegistration.create({
    data: {
      editionId,
      userId: testUser.id,
      email: testUser.email,
      firstName: "Test",
      lastName: "Mode12",
      ticketTypeId: ticketId,
      status: "CONFIRMED",
      paymentStatus: "NOT_REQUIRED",
      isOpsTest: true,
      confirmedAt: now14,
      acceptedTermsAt: now14,
      acceptedImageAt: now14,
      sequenceNumber: 900_000 + (testUser.id % 1000),
      visibleCode: `TS${execId.slice(-4).toUpperCase()}`,
    },
  });
  mark(
    "14_test_mode_enter",
    testReg.isOpsTest === true &&
      FIXTURE_EMAIL_RE.test(testReg.email) &&
      testReg.paymentStatus === "NOT_REQUIRED" &&
      testReg.editionId === editionId,
  );

  // 17: carga real a través de la inscripción isOpsTest (vista "como participante").
  const bufTest = await jpeg({
    withExif: true,
    captureDate: new Date(capStart2.getTime() + 30 * 60_000),
    make: "FixtureCam12",
    model: "CK12-TEST",
    seed: 99,
  });
  await ensureUpload({
    registrationId: testReg.id,
    promptId: p1,
    userId: testUser.id,
    buffer: bufTest,
    fileName: "fixture-12-test-mode-p1.jpg",
  });
  const testSub = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: testReg.id, promptId: p1 } },
  });
  mark(
    "17_test_upload",
    testSub.status === "CONFIRMED" && testSub.fotorankEntryId != null && testSub.registrationId === testReg.id,
  );

  // ============================================================
  // FASE 3 — captura cerrada, carga aún abierta (gracia post-captura).
  // ============================================================
  await setEditionWindow(prisma, editionId, {
    reveal: -70,
    captureStart: -70,
    captureEnd: -10,
    uploadStart: -70,
    uploadEnd: 180,
  });
  const config3 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({ where: { editionId } });
  const schedule3 = resolveEditionSchedule(config3);
  const windows3 = resolveEffectiveWindows(promptsPhase2[1] as never, config3);
  mark(
    "04_capture_closed_upload_open",
    getCapturePhase(schedule3) === "CLOSED" &&
      getUploadPhase(schedule3) === "OPEN" &&
      getUploadWindowState(windows3) === "OPEN",
  );

  // 05: con captura cerrada pero carga abierta, un reemplazo debe ser aceptado.
  const shaBefore05 = sub2.sha256;
  const buf2c = await jpeg({ withExif: false, seed: 22 });
  const replace05 = await ensureUpload({
    registrationId: reg1,
    promptId: p2,
    userId: user1,
    buffer: buf2c,
    fileName: "fixture-12-p2-v2.jpg",
    isReplace: true,
  });
  const sub2After05 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { registrationId_promptId: { registrationId: reg1, promptId: p2 } },
  });
  mark(
    "05_upload_open_accepts",
    Boolean(replace05.submissionId) && sub2After05.sha256 !== shaBefore05 && sub2After05.status === "CONFIRMED",
  );

  // 18: plan de cleanup (dry-run) — SOLO cálculo, sin borrar nada.
  const cleanupPlanFixture = {
    editionId,
    contestId,
    registrations: await prisma.clickatonRegistration.count({ where: { editionId } }),
    prompts: await prisma.clickatonPrompt.count({ where: { editionId } }),
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
    frEntries: await prisma.fotorankContestEntry.count({ where: { contestId } }),
  };
  const cleanupPlanTestMode = {
    registrationId: testReg.id,
    submissions: await prisma.clickatonPhotoSubmission.count({ where: { registrationId: testReg.id } }),
    isOpsTest: testReg.isOpsTest,
  };
  mark(
    "18_cleanup_test_dry",
    cleanupPlanFixture.registrations === 2 &&
      cleanupPlanFixture.prompts === PROMPT_COUNT &&
      cleanupPlanFixture.editionId !== COMMERCIAL_EDITION_ID &&
      cleanupPlanTestMode.isOpsTest === true &&
      cleanupPlanTestMode.submissions === 1,
  );

  // ============================================================
  // FASE 4 — captura y carga cerradas (fin de ventana de maratón).
  // ============================================================
  await setEditionWindow(prisma, editionId, {
    reveal: -140,
    captureStart: -140,
    captureEnd: -80,
    uploadStart: -140,
    uploadEnd: -5,
  });

  // 06: intento nuevo tras cierre de carga -> rechazado.
  const buf3Late = await jpeg({ withExif: false, seed: 33 });
  const attempt06 = await expectThrow(() =>
    processPromptUpload({
      registrationId: reg1,
      promptId: p3,
      userId: user1,
      buffer: buf3Late,
      originalFileName: "fixture-12-p3-late.jpg",
      declaredMime: "image/jpeg",
    }),
  );
  mark("06_upload_closed_rejects", attempt06.threw && attempt06.code === "UPLOAD_WINDOW_CLOSED");

  // 11: reemplazo tras cierre -> bloqueado.
  const buf1Late = await jpeg({ withExif: false, seed: 44 });
  const attempt11 = await expectThrow(() =>
    processPromptUpload({
      registrationId: reg1,
      promptId: p1,
      userId: user1,
      buffer: buf1Late,
      originalFileName: "fixture-12-p1-late.jpg",
      declaredMime: "image/jpeg",
      isReplace: true,
    }),
  );
  mark(
    "11_replace_after_close_blocked",
    attempt11.threw && (attempt11.code === "UPLOAD_WINDOW_CLOSED" || attempt11.code === "REPLACE_DEADLINE"),
  );

  // 19 / 20: edición comercial ("Santa Fe") intacta y no es la edición fixture.
  const commercialAfter = await commercialCount();
  mark(
    "19_commercial_counts_intact",
    commercialAfter.regs === commercialBefore.regs &&
      commercialAfter.approved === commercialBefore.approved &&
      commercialAfter.paidOrders === commercialBefore.paidOrders,
  );

  const commercialEdition = await prisma.clickatonEdition.findUnique({
    where: { id: COMMERCIAL_EDITION_ID },
    select: { id: true, isOpsFixture: true },
  });
  mark(
    "20_santa_fe_untouched",
    commercialEdition?.id === COMMERCIAL_EDITION_ID &&
      commercialEdition.isOpsFixture !== true &&
      editionId !== COMMERCIAL_EDITION_ID &&
      commercialAfter.regs === commercialBefore.regs &&
      commercialAfter.approved === commercialBefore.approved &&
      commercialAfter.paidOrders === commercialBefore.paidOrders,
  );

  // Persistir referencias del Modo Test para el cleanup posterior.
  writeFileSync(
    credsPath,
    readFileSync(credsPath, "utf8") +
      [
        `SFEF12_TEST_USER_ID=${testUser.id}`,
        `SFEF12_TEST_USER_EMAIL=${testUser.email}`,
        `SFEF12_TEST_REG_ID=${testReg.id}`,
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
    total: MATRIX_KEYS.length,
    matrix,
    editionId,
    contestId,
    commercialBefore,
    commercialAfter,
    testRegistrationId: testReg.id,
    testUserEmail: testUser.email,
  };
  writeFileSync("/tmp/clickaton-12-e2e-matrix.json", JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await prisma.$disconnect();
  if (!out.ok) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
