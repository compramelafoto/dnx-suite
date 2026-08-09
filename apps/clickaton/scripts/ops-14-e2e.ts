/**
 * ETAPA 14 — matriz E2E (26 claves): aprobación + 10 reales + Modo Test completo.
 *
 *   set -a && source /tmp/clickaton-14-fixture.env && set +a
 *   SFEF14_ALLOW_PROD_FIXTURE=1 DATABASE_URL=... \
 *     pnpm --filter clickaton exec tsx scripts/ops-14-e2e.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { INITIAL_SOURCE_PREFIX, updateItem } from "@repo/photo-prompt-library";
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

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const SLUG_PREFIX = "clickaton-fr-14-fixture-";
const FIXTURE_EMAIL_RE = /@fotorank\.test$/i;
const PROMPT_COUNT = 10;

const MATRIX_KEYS = [
  "01_biblioteca_55",
  "02_aprobar_consigna",
  "03_seleccionar_10",
  "04_snapshots",
  "05_READY",
  "06_pre_reveal",
  "07_reveal_10_juntas",
  "08_captura_abierta",
  "09_captura_cerrada_upload_abierto",
  "10_upload_abierto",
  "11_upload_cerrado",
  "12_progreso_0_10",
  "13_upload_consigna_1",
  "14_progreso_1_10",
  "15_upload_10",
  "16_progreso_10_10",
  "17_exif_valido",
  "18_sin_exif",
  "19_fuera_ventana",
  "20_replace",
  "21_misma_entry",
  "22_mobile",
  "23_admin_summary",
  "24_privacy",
  "25_cleanup_dry",
  "26_counts_comerciales_intactos",
] as const;

type MatrixKey = (typeof MATRIX_KEYS)[number];
type Matrix = Record<MatrixKey, "PASS" | "FAIL" | "SKIP">;
type PrismaClientType = InstanceType<typeof PrismaClient>;

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
        b: 140,
      },
    },
  })
    .jpeg({ quality: 84 + (seed % 8) })
    .toBuffer();
  if (!opts.withExif) return base;
  return sharp(base)
    .withExif({
      IFD0: { Make: opts.make ?? "FixtureCam14", Model: opts.model ?? "CK14-1" },
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

async function expectThrow(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
}

async function readyChecklist(prisma: PrismaClientType, editionId: string) {
  const [edition, prompts, config] = await Promise.all([
    prisma.clickatonEdition.findUnique({
      where: { id: editionId },
      select: { fotorankContestId: true, timezone: true },
    }),
    prisma.clickatonPrompt.findMany({
      where: { editionId, status: { not: "CANCELLED" } },
      select: {
        id: true,
        title: true,
        titleSnapshot: true,
        sequence: true,
        libraryItemId: true,
      },
      orderBy: { sequence: "asc" },
    }),
    prisma.clickatonEditionUploadConfig.findUnique({ where: { editionId } }),
  ]);
  const libraryIds = [
    ...new Set(
      prompts.map((p) => p.libraryItemId).filter((id): id is string => Boolean(id)),
    ),
  ];
  const libraryRows = libraryIds.length
    ? await prisma.photoPromptLibraryItem.findMany({
        where: { id: { in: libraryIds } },
        select: { id: true, status: true },
      })
    : [];
  const statusById = new Map(libraryRows.map((r) => [r.id, r.status]));
  const count = prompts.length;
  const hasTitleOrSnapshot = prompts.every(
    (p) => Boolean(p.titleSnapshot?.trim()) || Boolean(p.title?.trim()),
  );
  const sequences = prompts.map((p) => p.sequence);
  const orderOk =
    count > 0 &&
    new Set(sequences).size === count &&
    sequences.every((s, i) => s === i + 1);
  const linked = prompts.filter((p) => p.libraryItemId);
  const allApproved =
    linked.length === 0 ||
    linked.every((p) => statusById.get(p.libraryItemId!) === "APPROVED");
  const noDupes =
    linked.map((p) => p.libraryItemId!).length ===
    new Set(linked.map((p) => p.libraryItemId!)).size;
  const items = [
    { key: "prompts_10", ok: count === 10 },
    { key: "prompts_snapshots", ok: count === 10 && hasTitleOrSnapshot },
    { key: "prompts_library_approved", ok: allApproved },
    { key: "prompts_order", ok: orderOk },
    { key: "prompts_no_duplicates", ok: noDupes },
    { key: "reveal", ok: Boolean(config?.eventRevealAt) },
    {
      key: "capture",
      ok: Boolean(config?.captureWindowStartsAt && config?.captureWindowEndsAt),
    },
    {
      key: "upload",
      ok: Boolean(config?.uploadWindowStartsAt && config?.uploadWindowEndsAt),
    },
    { key: "replacement", ok: config?.allowReplacement != null },
    { key: "fotorank", ok: Boolean(edition?.fotorankContestId) },
    { key: "timezone", ok: Boolean(edition?.timezone) },
  ];
  return { ready: items.every((i) => i.ok), items };
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
) {
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
      uploadsEnabled: true,
    },
  });
}

async function main() {
  if (process.env.SFEF14_ALLOW_PROD_FIXTURE !== "1") {
    throw new Error("ABORT: SFEF14_ALLOW_PROD_FIXTURE=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no dawn-dew");
  }

  const credsPath = process.env.SFEF14_CREDS_PATH ?? "/tmp/clickaton-14-fixture.env";
  const file = loadEnv(credsPath);
  const execId = file.SFEF14_EXEC_ID!;
  const editionId = file.SFEF14_EDITION_ID!;
  const contestId = file.SFEF14_CONTEST_ID!;
  const ticketId = file.SFEF14_TICKET_ID!;
  const reg1 = file.SFEF14_REG_1!;
  const user1 = Number(file.SFEF14_USER_1_ID);
  const testRegId = file.SFEF14_TEST_REG!;
  const testUserId = Number(file.SFEF14_TEST_USER_ID);
  const snapshotProbeLibraryId = file.SFEF14_SNAPSHOT_PROBE_LIBRARY_ID!;
  if (!execId || !editionId || !contestId || !ticketId || !reg1 || !user1) {
    throw new Error("ABORT: creds incompletas en " + credsPath);
  }
  if (editionId === COMMERCIAL_EDITION_ID) {
    throw new Error("ABORT commercial edition");
  }

  const promptIds: string[] = [];
  for (let i = 1; i <= PROMPT_COUNT; i++) {
    const id = file[`SFEF14_PROMPT_${i}`];
    if (!id) throw new Error(`ABORT falta SFEF14_PROMPT_${i}`);
    promptIds.push(id);
  }

  const prisma = new PrismaClient();
  const matrix = {} as Matrix;
  for (const k of MATRIX_KEYS) matrix[k] = "SKIP";
  const mark = (k: MatrixKey, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { id: true, slug: true, isOpsFixture: true, timezone: true, fotorankContestId: true },
  });
  if (!edition.isOpsFixture || !edition.slug.startsWith(SLUG_PREFIX)) {
    throw new Error("ABORT edición no es fixture 14");
  }

  // Compat: asignaciones previas pudieron quedar en DRAFT; normalizar a LOCKED.
  await prisma.clickatonPrompt.updateMany({
    where: { editionId, status: "DRAFT" },
    data: { status: "LOCKED" },
  });

  const commercialCount = async () => ({
    regs: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId: COMMERCIAL_EDITION_ID, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: { editionId: COMMERCIAL_EDITION_ID },
    }),
  });
  const commercialBefore = await commercialCount();

  // 01 biblioteca 55
  const themes = await prisma.photoPromptTheme.count({ where: { active: true } });
  const initial = await prisma.photoPromptLibraryItem.count({
    where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
  });
  mark("01_biblioteca_55", themes === 11 && initial === 55);

  // 02 aprobar consigna — setup dejó APPROVED con approvedBy/At + audit
  const approvedSample = await prisma.photoPromptLibraryItem.findFirst({
    where: {
      id: snapshotProbeLibraryId,
      status: "APPROVED",
      sourceKey: { startsWith: INITIAL_SOURCE_PREFIX },
    },
    select: { id: true, approvedAt: true, approvedByUserId: true, version: true },
  });
  const auditApprove = approvedSample
    ? await prisma.photoPromptLibraryAuditEvent.findFirst({
        where: { libraryItemId: approvedSample.id, action: "APPROVE" },
      })
    : null;
  mark(
    "02_aprobar_consigna",
    Boolean(approvedSample?.approvedAt && approvedSample.approvedByUserId && auditApprove),
  );

  // 03 seleccionar 10
  const prompts = await prisma.clickatonPrompt.findMany({
    where: { editionId, status: { not: "CANCELLED" } },
    orderBy: { sequence: "asc" },
  });
  const libraryIds = prompts.map((p) => p.libraryItemId).filter(Boolean) as string[];
  mark(
    "03_seleccionar_10",
    prompts.length === 10 &&
      libraryIds.length === 10 &&
      new Set(libraryIds).size === 10,
  );

  // 04 snapshots — editar biblioteca no cambia snapshot edición
  const prompt0 = prompts[0]!;
  const snapBefore = {
    title: prompt0.titleSnapshot,
    description: prompt0.descriptionSnapshot,
    version: prompt0.libraryVersion,
  };
  const libBefore = await prisma.photoPromptLibraryItem.findUniqueOrThrow({
    where: { id: prompt0.libraryItemId! },
    select: { title: true, version: true },
  });
  await updateItem(
    prompt0.libraryItemId!,
    { title: `${libBefore.title} [OPS14-SNAP-PROBE]` },
    { prisma },
  );
  const libAfter = await prisma.photoPromptLibraryItem.findUniqueOrThrow({
    where: { id: prompt0.libraryItemId! },
    select: { title: true, version: true },
  });
  const prompt0After = await prisma.clickatonPrompt.findUniqueOrThrow({
    where: { id: prompt0.id },
    select: {
      titleSnapshot: true,
      descriptionSnapshot: true,
      libraryVersion: true,
    },
  });
  // restaurar título de biblioteca (sin tocar snapshot)
  await updateItem(
    prompt0.libraryItemId!,
    { title: libBefore.title },
    { prisma },
  );
  mark(
    "04_snapshots",
    Boolean(snapBefore.title) &&
      prompt0After.titleSnapshot === snapBefore.title &&
      prompt0After.descriptionSnapshot === snapBefore.description &&
      prompt0After.libraryVersion === snapBefore.version &&
      libAfter.title !== libBefore.title &&
      libAfter.version >= libBefore.version,
  );

  // Orden: secuencias 1..10 únicas; reorder edition-local ya aplicado en setup.
  const sequences = prompts.map((p) => p.sequence);
  const orderOk =
    sequences.length === 10 &&
    new Set(sequences).size === 10 &&
    sequences.every((s, i) => s === i + 1);

  // 05 READY
  const ready = await readyChecklist(prisma, editionId);
  mark(
    "05_READY",
    ready.ready === true &&
      ready.items.every((i) => i.ok) &&
      orderOk,
  );

  // 12 progreso 0/10 (antes de uploads)
  await prisma.clickatonPhotoSubmission.deleteMany({ where: { registrationId: reg1 } });
  const prog0 = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: reg1, status: "CONFIRMED" },
  });
  mark("12_progreso_0_10", prog0 === 0);

  // 06 pre-reveal + 24 privacy
  await setEditionWindow(prisma, editionId, {
    reveal: 60,
    captureStart: 60,
    captureEnd: 180,
    uploadStart: 60,
    uploadEnd: 300,
  });
  const config1 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId },
  });
  const prompts1 = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
  const schedule1 = resolveEditionSchedule(config1);
  let preOk = prompts1.length === 10 && !arePromptsGloballyRevealed(schedule1);
  let privacyOk = true;
  for (const p of prompts1) {
    try {
      const dto = toPromptPublicDto(p as never, {
        editionSchedule: config1,
        showOpensAt: true,
      });
      if (dto.status !== "LOCKED") preOk = false;
      assertLockedDtoIsSafe(dto);
      const raw = JSON.stringify(dto);
      if (raw.includes(p.title ?? "\u0000")) privacyOk = false;
      if (p.instructions && raw.includes(p.instructions)) privacyOk = false;
      if (p.titleSnapshot && raw.includes(p.titleSnapshot)) privacyOk = false;
    } catch {
      preOk = false;
      privacyOk = false;
    }
  }
  mark("06_pre_reveal", preOk);
  mark(
    "24_privacy",
    privacyOk &&
      FIXTURE_EMAIL_RE.test(file.SFEF14_USER_1_EMAIL ?? "") &&
      FIXTURE_EMAIL_RE.test(file.SFEF14_TEST_EMAIL ?? ""),
  );

  // Ventanas abiertas + reveal
  await setEditionWindow(prisma, editionId, {
    reveal: -1,
    captureStart: -1,
    captureEnd: 120,
    uploadStart: -1,
    uploadEnd: 240,
  });
  const config2 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId },
  });
  const prompts2 = await prisma.clickatonPrompt.findMany({
    where: { editionId },
    orderBy: { sequence: "asc" },
  });
  const schedule2 = resolveEditionSchedule(config2);
  let allReleased = prompts2.length === 10;
  for (const p of prompts2) {
    const dto = toPromptPublicDto(p as never, { editionSchedule: config2 });
    if (dto.status !== "RELEASED" || !dto.title) allReleased = false;
  }
  mark(
    "07_reveal_10_juntas",
    allReleased && arePromptsGloballyRevealed(schedule2),
  );
  mark(
    "08_captura_abierta",
    getCapturePhase(schedule2) === "OPEN" && getUploadPhase(schedule2) === "OPEN",
  );

  // Reloj virtual A–F (cubre pre/post vía fixedClock)
  const nowRef = new Date();
  const beforeClk = fixedClock(new Date(nowRef.getTime() - 30 * 60_000));
  const afterClk = fixedClock(new Date(nowRef.getTime() + 60_000));
  const virtualOk =
    arePromptsGloballyRevealed(schedule2, beforeClk) === false &&
    arePromptsGloballyRevealed(schedule2, afterClk) === true &&
    getCapturePhase(schedule2, beforeClk) === "NOT_OPEN" &&
    getCapturePhase(schedule2, afterClk) === "OPEN";

  // 22 mobile — componentes reales con clases responsive / mobile-first
  const panelSrc = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../components/account/MarathonSchedulePanel.tsx"),
    "utf8",
  );
  const mobileOk =
    panelSrc.includes("sm:grid-cols-2") &&
    panelSrc.includes("Horario para sacar fotografías") &&
    panelSrc.includes("Horario para subir") &&
    panelSrc.includes("entregadas") &&
    virtualOk;
  mark("22_mobile", mobileOk);

  const capStart2 = config2.captureWindowStartsAt!;
  const capEnd2 = config2.captureWindowEndsAt!;
  const windowsP1 = resolveEffectiveWindows(prompts2[0] as never, config2);

  // 13 + 17 upload consigna 1 EXIF válido
  const buf1 = await jpeg({
    withExif: true,
    captureDate: new Date(capStart2.getTime() + 10 * 60_000),
    make: "Canon",
    model: "Fixture14-R6",
    seed: 1,
  });
  await ensureUpload({
    registrationId: reg1,
    promptId: promptIds[0]!,
    userId: user1,
    buffer: buf1,
    fileName: "fixture-14-p1.jpg",
  });
  const sub1 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: { registrationId: reg1, promptId: promptIds[0]! },
    },
  });
  const directEval1 = evaluateCaptureDate({
    captureDate: new Date(capStart2.getTime() + 10 * 60_000),
    windows: windowsP1,
    toleranceMinutes: 5,
    timezone: edition.timezone ?? "America/Argentina/Buenos_Aires",
  });
  mark(
    "13_upload_consigna_1",
    sub1.status === "CONFIRMED" && sub1.sha256 != null,
  );
  mark(
    "17_exif_valido",
    sub1.validationResult === "PASS" && directEval1.result === "PASS",
  );
  mark(
    "14_progreso_1_10",
    (await prisma.clickatonPhotoSubmission.count({
      where: { registrationId: reg1, status: "CONFIRMED" },
    })) === 1,
  );

  // 18 sin EXIF
  const bufNoExif = await jpeg({ withExif: false, seed: 2 });
  await ensureUpload({
    registrationId: reg1,
    promptId: promptIds[1]!,
    userId: user1,
    buffer: bufNoExif,
    fileName: "fixture-14-p2-noexif.jpg",
  });
  const sub2 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: { registrationId: reg1, promptId: promptIds[1]! },
    },
  });
  const tech2 = (sub2.technicalSummaryJson ?? {}) as Record<string, unknown>;
  const captureEval2 = tech2.captureEval as { reason?: string } | undefined;
  mark(
    "18_sin_exif",
    sub2.validationResult === "MANUAL_REVIEW" &&
      captureEval2?.reason === "EXIF_CAPTURE_DATE_ABSENT",
  );

  // 19 fuera ventana
  const bufOut = await jpeg({
    withExif: true,
    captureDate: new Date(capEnd2.getTime() + 20 * 60_000),
    make: "Sony",
    model: "Fixture14-A7",
    seed: 3,
  });
  await ensureUpload({
    registrationId: reg1,
    promptId: promptIds[2]!,
    userId: user1,
    buffer: bufOut,
    fileName: "fixture-14-p3-out.jpg",
  });
  const sub3 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: { registrationId: reg1, promptId: promptIds[2]! },
    },
  });
  const tech3 = (sub3.technicalSummaryJson ?? {}) as Record<string, unknown>;
  const captureEval3 = tech3.captureEval as { reason?: string } | undefined;
  mark(
    "19_fuera_ventana",
    sub3.validationResult === "MANUAL_REVIEW" &&
      captureEval3?.reason === "CAPTURE_OUTSIDE_WINDOW",
  );

  // Completar 4..10
  for (let i = 3; i < PROMPT_COUNT; i++) {
    const withExif = i % 2 === 0;
    const buf = await jpeg({
      withExif,
      captureDate: withExif
        ? new Date(capStart2.getTime() + (i + 1) * 5 * 60_000)
        : undefined,
      make: withExif ? "FixtureCam14" : undefined,
      model: withExif ? `CK14-${i + 1}` : undefined,
      seed: (i + 1) * 10,
    });
    await ensureUpload({
      registrationId: reg1,
      promptId: promptIds[i]!,
      userId: user1,
      buffer: buf,
      fileName: `fixture-14-p${i + 1}.jpg`,
    });
  }
  const confirmedAll = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: reg1, status: "CONFIRMED" },
  });
  mark("15_upload_10", confirmedAll === 10);
  mark("16_progreso_10_10", confirmedAll === 10);

  // 20 + 21 replace misma entry
  const shaBefore = sub1.sha256;
  const entryBefore = sub1.fotorankEntryId;
  const bufReplace = await jpeg({
    withExif: true,
    captureDate: new Date(capStart2.getTime() + 25 * 60_000),
    make: "Nikon",
    model: "Fixture14-Z9",
    seed: 77,
  });
  await ensureUpload({
    registrationId: reg1,
    promptId: promptIds[0]!,
    userId: user1,
    buffer: bufReplace,
    fileName: "fixture-14-p1-v2.jpg",
    isReplace: true,
  });
  const sub1After = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: { registrationId: reg1, promptId: promptIds[0]! },
    },
  });
  const confirmedAfterReplace = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: reg1, status: "CONFIRMED" },
  });
  mark(
    "20_replace",
    sub1After.status === "CONFIRMED" &&
      sub1After.sha256 !== shaBefore &&
      confirmedAfterReplace === 10,
  );
  mark(
    "21_misma_entry",
    Boolean(entryBefore) && sub1After.fotorankEntryId === entryBefore,
  );

  // 09 captura cerrada / upload abierto + 10 upload acepta
  await setEditionWindow(prisma, editionId, {
    reveal: -70,
    captureStart: -70,
    captureEnd: -10,
    uploadStart: -70,
    uploadEnd: 180,
  });
  const config3 = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId },
  });
  const schedule3 = resolveEditionSchedule(config3);
  const windows3 = resolveEffectiveWindows(prompts2[1] as never, config3);
  mark(
    "09_captura_cerrada_upload_abierto",
    getCapturePhase(schedule3) === "CLOSED" &&
      getUploadPhase(schedule3) === "OPEN" &&
      getUploadWindowState(windows3) === "OPEN",
  );
  const shaBefore10 = sub2.sha256;
  const bufGrace = await jpeg({ withExif: false, seed: 88 });
  const upGrace = await ensureUpload({
    registrationId: reg1,
    promptId: promptIds[1]!,
    userId: user1,
    buffer: bufGrace,
    fileName: "fixture-14-p2-grace.jpg",
    isReplace: true,
  });
  const sub2Grace = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: { registrationId: reg1, promptId: promptIds[1]! },
    },
  });
  mark(
    "10_upload_abierto",
    Boolean(upGrace.submissionId) &&
      sub2Grace.sha256 !== shaBefore10 &&
      sub2Grace.status === "CONFIRMED",
  );

  // 11 upload cerrado
  await setEditionWindow(prisma, editionId, {
    reveal: -200,
    captureStart: -200,
    captureEnd: -100,
    uploadStart: -200,
    uploadEnd: -5,
  });
  const blocked = await expectThrow(async () => {
    const buf = await jpeg({ withExif: false, seed: 99 });
    await processPromptUpload({
      registrationId: reg1,
      promptId: promptIds[3]!,
      userId: user1,
      buffer: buf,
      originalFileName: "fixture-14-blocked.jpg",
      declaredMime: "image/jpeg",
      isReplace: true,
    });
  });
  mark("11_upload_cerrado", blocked);

  // Restaurar ventanas abiertas para test mode upload residual
  await setEditionWindow(prisma, editionId, {
    reveal: -1,
    captureStart: -1,
    captureEnd: 120,
    uploadStart: -1,
    uploadEnd: 240,
  });

  // 23 admin summary
  const perPrompt = await prisma.clickatonPhotoSubmission.groupBy({
    by: ["promptId"],
    where: { editionId, status: "CONFIRMED" },
    _count: true,
  });
  const fixtureRegs = await prisma.clickatonRegistration.count({
    where: { editionId },
  });
  const testModeRegs = await prisma.clickatonRegistration.count({
    where: { editionId, isOpsTest: true },
  });
  mark(
    "23_admin_summary",
    perPrompt.length >= 10 &&
      fixtureRegs >= 2 &&
      testModeRegs >= 1 &&
      edition.fotorankContestId === contestId,
  );

  // Modo Test: reg isOpsTest ya existe; upload fixture
  const configOpen = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId },
  });
  const capOpen = configOpen.captureWindowStartsAt!;
  const bufTest = await jpeg({
    withExif: true,
    captureDate: new Date(capOpen.getTime() + 15 * 60_000),
    seed: 140,
  });
  // limpiar submission test previa si hubiera
  await prisma.clickatonPhotoSubmission.deleteMany({
    where: { registrationId: testRegId },
  });
  await ensureUpload({
    registrationId: testRegId,
    promptId: promptIds[0]!,
    userId: testUserId,
    buffer: bufTest,
    fileName: "fixture-14-test-mode-p1.jpg",
  });
  const testSub = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: {
        registrationId: testRegId,
        promptId: promptIds[0]!,
      },
    },
  });
  const testReg = await prisma.clickatonRegistration.findUniqueOrThrow({
    where: { id: testRegId },
  });
  const testModeOk =
    testReg.isOpsTest === true &&
    FIXTURE_EMAIL_RE.test(testReg.email) &&
    testSub.status === "CONFIRMED";

  // 25 cleanup dry — plan AND estricto sin apply
  const cleanupPlan = {
    editionId,
    isOpsFixture: edition.isOpsFixture,
    slugPrefixOk: edition.slug.startsWith(SLUG_PREFIX),
    catalogProtected: await prisma.photoPromptLibraryItem.count({
      where: { sourceKey: { startsWith: INITIAL_SOURCE_PREFIX } },
    }),
    wouldDeleteRegs: await prisma.clickatonRegistration.count({ where: { editionId } }),
    wouldDeletePrompts: await prisma.clickatonPrompt.count({ where: { editionId } }),
    wouldDeleteSubs: await prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
  };
  mark(
    "25_cleanup_dry",
    cleanupPlan.isOpsFixture &&
      cleanupPlan.slugPrefixOk &&
      cleanupPlan.catalogProtected === 55 &&
      cleanupPlan.wouldDeleteRegs >= 2 &&
      testModeOk,
  );

  const commercialAfter = await commercialCount();
  mark(
    "26_counts_comerciales_intactos",
    commercialBefore.regs === commercialAfter.regs &&
      commercialBefore.approved === commercialAfter.approved &&
      commercialBefore.paidOrders === commercialAfter.paidOrders &&
      commercialBefore.submissions === commercialAfter.submissions &&
      commercialBefore.regs === Number(file.SFEF14_COMMERCIAL_REG_COUNT_BEFORE ?? -1),
  );

  const passed = MATRIX_KEYS.filter((k) => matrix[k] === "PASS").length;
  const failed = MATRIX_KEYS.filter((k) => matrix[k] === "FAIL").length;
  const skipped = MATRIX_KEYS.filter((k) => matrix[k] === "SKIP").length;
  const report = {
    ok: failed === 0 && skipped === 0 && passed === 26,
    passed,
    failed,
    skipped,
    total: 26,
    matrix,
    editionId,
    contestId,
    commercialBefore,
    commercialAfter,
    testModeOk,
    ready: ready.ready,
  };
  writeFileSync("/tmp/clickaton-14-e2e-matrix.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
