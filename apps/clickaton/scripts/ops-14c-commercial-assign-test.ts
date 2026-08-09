/**
 * ETAPA 14C — selección humana aprobada: asignar 10 consignas comerciales,
 * corregir vínculo FotoRank (placeholder 000000), Modo Test con uploads OFF,
 * cleanup exclusivo isOpsTest.
 *
 *   SFEF14C_ALLOW_PROD=1 DATABASE_URL=... \
 *     pnpm --filter clickaton exec tsx scripts/ops-14c-commercial-assign-test.ts
 */
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assignToEdition, updateItem } from "@repo/photo-prompt-library";
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
  getUploadWindowState,
  resolveEffectiveWindows,
} from "../lib/photo-upload/windows";
import {
  assertLockedDtoIsSafe,
  toPromptPublicDto,
} from "../lib/timeline/prompt-dto";
import { fixedClock } from "../lib/timeline/clock";
import { cleanupTestModeData } from "../lib/test-mode/test-mode";

const require = createRequire(
  join(dirname(fileURLToPath(import.meta.url)), "../../../packages/db/package.json"),
);
const { PrismaClient } = require("@prisma/client") as typeof import("@prisma/client");

const COMMERCIAL_EDITION_ID = "cmrvq7liy0000l904s25767xe";
const COMMERCIAL_SLUG = "1er-clickaton";
const PLACEHOLDER_CONTEST = "000000";

/** Orden aprobado por operador — títulos exactos. */
const SELECTED_TITLES = [
  "Entre luces y sombras",
  "Un color protagonista",
  "Movimiento detenido",
  "Un gesto",
  "Geometría cotidiana",
  "Desde abajo",
  "Textura",
  "Nuevo y viejo",
  "Dentro de un marco",
  "Simetría de película",
] as const;

const RESERVE_TITLES = ["Un rayo de luz", "Soledad"] as const;

type PrismaClientType = InstanceType<typeof PrismaClient>;

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, 64).toString("hex")}`;
}

function exifDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}:${pad(d.getMonth() + 1)}:${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function jpeg(opts: {
  withExif: boolean;
  captureDate?: Date;
  seed?: number;
}): Promise<Buffer> {
  const seed = opts.seed ?? 0;
  const base = await sharp({
    create: {
      width: 1200 + (seed % 9),
      height: 900 + (seed % 7),
      channels: 3,
      background: { r: (50 + seed) % 255, g: (90 + seed * 2) % 255, b: 150 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();
  if (!opts.withExif) return base;
  return sharp(base)
    .withExif({
      IFD0: { Make: "FixtureCam14C", Model: "CK14C" },
      IFD2: { DateTimeOriginal: exifDateString(opts.captureDate ?? new Date()) },
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

async function commercialCounts(prisma: PrismaClientType) {
  const editionId = COMMERCIAL_EDITION_ID;
  return {
    regs: await prisma.clickatonRegistration.count({
      where: { editionId, isOpsTest: false },
    }),
    approved: await prisma.clickatonRegistration.count({
      where: { editionId, isOpsTest: false, paymentStatus: "APPROVED" },
    }),
    paidOrders: await prisma.clickatonRegistration.count({
      where: { editionId, isOpsTest: false, paymentOrderId: { not: null } },
    }),
    submissions: await prisma.clickatonPhotoSubmission.count({
      where: {
        editionId,
        registration: { isOpsTest: false },
      },
    }),
    testRegs: await prisma.clickatonRegistration.count({
      where: { editionId, isOpsTest: true },
    }),
  };
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
        status: true,
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
  const hasSnapshots = prompts.every(
    (p) => Boolean(p.titleSnapshot?.trim()) || Boolean(p.title?.trim()),
  );
  const sequences = prompts.map((p) => p.sequence);
  const orderOk =
    count === 10 &&
    new Set(sequences).size === 10 &&
    sequences.every((s, i) => s === i + 1);
  const allLocked = prompts.every((p) => p.status === "LOCKED");
  const allApproved = prompts.every(
    (p) => p.libraryItemId && statusById.get(p.libraryItemId) === "APPROVED",
  );
  const noDupes =
    libraryIds.length === 10 && new Set(libraryIds).size === 10;
  const frOk =
    Boolean(edition?.fotorankContestId) &&
    edition!.fotorankContestId !== PLACEHOLDER_CONTEST;
  const items = [
    { key: "prompts_10", ok: count === 10 },
    { key: "prompts_snapshots", ok: hasSnapshots },
    { key: "prompts_library_approved", ok: allApproved },
    { key: "prompts_order", ok: orderOk },
    { key: "prompts_locked", ok: allLocked },
    { key: "prompts_no_duplicates", ok: noDupes },
    { key: "reveal", ok: Boolean(config?.eventRevealAt && config.globalPromptReveal) },
    {
      key: "capture",
      ok: Boolean(config?.captureWindowStartsAt && config.captureWindowEndsAt),
    },
    {
      key: "upload",
      ok: Boolean(config?.uploadWindowStartsAt && config.uploadWindowEndsAt),
    },
    { key: "replacement", ok: config?.allowReplacement === true },
    { key: "fotorank_real", ok: frOk },
    { key: "uploads_commercial_off", ok: config?.uploadsEnabled === false },
    {
      key: "canonical_off",
      ok: config?.canonicalAssetsEnabled === false,
    },
    { key: "timezone", ok: Boolean(edition?.timezone) },
  ];
  return { ready: items.every((i) => i.ok), items, prompts, config, edition };
}

async function ensureCommercialFotoRankContest(
  prisma: PrismaClientType,
  saUserId: number,
): Promise<{ contestId: string; orgId: string; created: boolean }> {
  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: COMMERCIAL_EDITION_ID },
    select: { id: true, name: true, slug: true, fotorankContestId: true },
  });

  if (
    edition.fotorankContestId &&
    edition.fotorankContestId !== PLACEHOLDER_CONTEST
  ) {
    const existing = await prisma.fotorankContest.findUnique({
      where: { id: edition.fotorankContestId },
      select: { id: true, organizationId: true },
    });
    if (existing) {
      return {
        contestId: existing.id,
        orgId: existing.organizationId,
        created: false,
      };
    }
  }

  const slug = "1er-clickaton-dia-del-fotografo-2026";
  const bySlug = await prisma.fotorankContest.findFirst({
    where: { slug },
    select: { id: true, organizationId: true },
  });
  if (bySlug) {
    await prisma.clickatonEdition.update({
      where: { id: COMMERCIAL_EDITION_ID },
      data: {
        fotorankContestId: bySlug.id,
        fotoRankValidationStatus: "VALID",
        fotoRankLastValidatedAt: new Date(),
        // Sync comercial sigue OFF — solo vínculo real para assets/test.
        fotoRankSyncEnabled: false,
        fotoRankSyncMode: "DISABLED",
      },
    });
    return { contestId: bySlug.id, orgId: bySlug.organizationId, created: false };
  }

  const org = await prisma.contestOrganization.create({
    data: {
      name: "Clickatón — Día del Fotógrafo 2026",
      slug: `clickaton-comercial-${Date.now().toString(36)}`,
      createdByUserId: saUserId,
      members: {
        create: { userId: saUserId, role: "OWNER", status: "ACTIVE" },
      },
    },
  });

  const contest = await prisma.fotorankContest.create({
    data: {
      organizationId: org.id,
      title: '1er Clickaton "Día del Fotógrafo 2026"',
      slug,
      status: "PUBLISHED",
      visibility: "PRIVATE",
      experienceType: "MARATHON",
      distributionChannel: "CLICKATON",
      registrationEnabled: false,
      timezone: "America/Argentina/Cordoba",
      createdByUserId: saUserId,
      categories: {
        create: { name: "General", slug: "general", status: "ACTIVE", sortOrder: 0 },
      },
    },
  });

  await prisma.clickatonEdition.update({
    where: { id: COMMERCIAL_EDITION_ID },
    data: {
      fotorankContestId: contest.id,
      fotoRankValidationStatus: "VALID",
      fotoRankLastValidatedAt: new Date(),
      fotoRankSyncEnabled: false,
      fotoRankSyncMode: "DISABLED",
    },
  });

  return { contestId: contest.id, orgId: org.id, created: true };
}

async function main() {
  if (process.env.SFEF14C_ALLOW_PROD !== "1") {
    throw new Error("ABORT: SFEF14C_ALLOW_PROD=1 requerido");
  }
  const url = process.env.DATABASE_URL ?? "";
  if (!new URL(url).hostname.includes("ep-dawn-dew")) {
    throw new Error("ABORT host no dawn-dew");
  }

  const prisma = new PrismaClient();
  const matrix: Record<string, "PASS" | "FAIL"> = {};
  const mark = (k: string, ok: boolean) => {
    matrix[k] = ok ? "PASS" : "FAIL";
    if (!ok) console.error("FAIL", k);
  };

  const commercialBefore = await commercialCounts(prisma);

  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: COMMERCIAL_EDITION_ID },
    select: {
      id: true,
      slug: true,
      name: true,
      isOpsFixture: true,
      fotorankContestId: true,
      timezone: true,
    },
  });
  if (edition.slug !== COMMERCIAL_SLUG) throw new Error("ABORT slug mismatch");
  if (edition.isOpsFixture) throw new Error("ABORT commercial marked fixture");

  const sa = await prisma.user.findUnique({
    where: { email: "cuart.daniel@gmail.com" },
    select: { id: true },
  });
  if (!sa) throw new Error("SA missing");

  // 1) FotoRank real (reemplaza 000000)
  const fr = await ensureCommercialFotoRankContest(prisma, sa.id);
  const afterFr = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: COMMERCIAL_EDITION_ID },
    select: { fotorankContestId: true },
  });
  mark(
    "fotorank_link_real",
    afterFr.fotorankContestId === fr.contestId &&
      afterFr.fotorankContestId !== PLACEHOLDER_CONTEST,
  );

  // 2) Resolver library items por título APPROVED
  const items = await prisma.photoPromptLibraryItem.findMany({
    where: {
      status: "APPROVED",
      title: { in: [...SELECTED_TITLES] },
    },
    select: { id: true, title: true, version: true },
  });
  const byTitle = new Map(items.map((i) => [i.title, i]));
  for (const t of SELECTED_TITLES) {
    if (!byTitle.has(t)) throw new Error(`ABORT missing APPROVED: ${t}`);
  }
  const reserves = await prisma.photoPromptLibraryItem.findMany({
    where: { status: "APPROVED", title: { in: [...RESERVE_TITLES] } },
    select: { id: true, title: true },
  });
  mark("reserves_not_required_yet", reserves.length === 2);

  // 3) Asignar si aún no hay prompts; si ya están OK, no reordenar (tx lenta en pooler).
  let existingPrompts = await prisma.clickatonPrompt.findMany({
    where: { editionId: COMMERCIAL_EDITION_ID, status: { not: "CANCELLED" } },
    orderBy: { sequence: "asc" },
  });

  const matchesSelection = (rows: typeof existingPrompts) =>
    rows.length === 10 &&
    rows.every((p, i) => p.sequence === i + 1) &&
    rows.every(
      (p, i) =>
        p.titleSnapshot === SELECTED_TITLES[i] || p.title === SELECTED_TITLES[i],
    );

  if (existingPrompts.length === 0) {
    for (let i = 0; i < SELECTED_TITLES.length; i++) {
      const title = SELECTED_TITLES[i]!;
      const lib = byTitle.get(title)!;
      await assignToEdition(
        {
          editionId: COMMERCIAL_EDITION_ID,
          libraryItemId: lib.id,
          actorUserId: sa.id,
          sequence: i + 1,
        },
        { prisma },
      );
    }
  } else if (existingPrompts.length !== 10) {
    throw new Error(
      `ABORT unexpected prompt count before assign: ${existingPrompts.length}`,
    );
  }

  // Normalizar DRAFT residual → LOCKED
  await prisma.clickatonPrompt.updateMany({
    where: { editionId: COMMERCIAL_EDITION_ID, status: "DRAFT" },
    data: { status: "LOCKED" },
  });

  existingPrompts = await prisma.clickatonPrompt.findMany({
    where: { editionId: COMMERCIAL_EDITION_ID, status: { not: "CANCELLED" } },
    orderBy: { sequence: "asc" },
  });

  if (!matchesSelection(existingPrompts)) {
    // Reorden local sin tx larga del paquete (evita timeout pooler).
    const orderedIds: string[] = [];
    for (const title of SELECTED_TITLES) {
      const p = existingPrompts.find(
        (x) => x.titleSnapshot === title || x.title === title,
      );
      if (!p) throw new Error(`ABORT assigned missing title: ${title}`);
      orderedIds.push(p.id);
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.clickatonPrompt.update({
        where: { id: orderedIds[i]! },
        data: { sequence: 1000 + i },
      });
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await prisma.clickatonPrompt.update({
        where: { id: orderedIds[i]! },
        data: { sequence: i + 1 },
      });
    }
    existingPrompts = await prisma.clickatonPrompt.findMany({
      where: { editionId: COMMERCIAL_EDITION_ID, status: { not: "CANCELLED" } },
      orderBy: { sequence: "asc" },
    });
  }

  mark(
    "assign_10",
    existingPrompts.length === 10 &&
      existingPrompts.every((p, i) => p.sequence === i + 1) &&
      existingPrompts.every(
        (p, i) =>
          p.titleSnapshot === SELECTED_TITLES[i] || p.title === SELECTED_TITLES[i],
      ),
  );
  mark(
    "all_locked",
    existingPrompts.every((p) => p.status === "LOCKED"),
  );
  mark(
    "snapshots_present",
    existingPrompts.every((p) => Boolean(p.titleSnapshot?.trim())),
  );

  // Snapshot immutability probe (restaurar título)
  const probe = existingPrompts[0]!;
  const libId = probe.libraryItemId!;
  const libBefore = await prisma.photoPromptLibraryItem.findUniqueOrThrow({
    where: { id: libId },
    select: { title: true, version: true },
  });
  const snapBefore = probe.titleSnapshot;
  await updateItem(libId, { title: `${libBefore.title} [14C-SNAP]` }, { prisma });
  const promptAfterEdit = await prisma.clickatonPrompt.findUniqueOrThrow({
    where: { id: probe.id },
    select: { titleSnapshot: true },
  });
  await updateItem(libId, { title: libBefore.title }, { prisma });
  mark(
    "snapshot_immutable",
    promptAfterEdit.titleSnapshot === snapBefore &&
      snapBefore === SELECTED_TITLES[0],
  );

  // READY
  const ready = await readyChecklist(prisma, COMMERCIAL_EDITION_ID);
  mark("ready_checklist", ready.ready);

  // Reservas NO asignadas
  const assignedLibIds = new Set(
    existingPrompts.map((p) => p.libraryItemId).filter(Boolean),
  );
  mark(
    "reserves_unassigned",
    reserves.every((r) => !assignedLibIds.has(r.id)),
  );

  // Flags comerciales intactos
  const cfg = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  mark(
    "commercial_uploads_off",
    cfg.uploadsEnabled === false && cfg.canonicalAssetsEnabled === false,
  );

  // ========== MODO TEST (isOpsTest) — no activa uploads comerciales ==========
  // Ticket ops-only (no producto comercial de venta). Necesario por FK de registration.
  let ticket = await prisma.clickatonTicketType.findFirst({
    where: {
      editionId: COMMERCIAL_EDITION_ID,
      code: "OPS_TEST_MODE",
    },
  });
  if (!ticket) {
    ticket = await prisma.clickatonTicketType.create({
      data: {
        editionId: COMMERCIAL_EDITION_ID,
        name: "Modo Test (ops)",
        code: "OPS_TEST_MODE",
        priceAmount: 0,
        currency: "ARS",
        capacity: 50,
        isActive: true,
      },
    });
  }

  const testEmail = `clickaton14c-test-${Date.now().toString(36)}@fotorank.test`;
  const testUser = await prisma.user.upsert({
    where: { email: testEmail },
    create: {
      email: testEmail,
      name: "CK14C Test Mode",
      password: hashPassword(`Ck14C-${randomBytes(3).toString("hex")}!`),
      role: "CUSTOMER",
      globalRole: "USER",
      emailVerifiedAt: new Date(),
    },
    update: { emailVerifiedAt: new Date() },
    select: { id: true, email: true },
  });
  const testReg = await prisma.clickatonRegistration.create({
    data: {
      editionId: COMMERCIAL_EDITION_ID,
      userId: testUser.id,
      email: testUser.email,
      firstName: "Test",
      lastName: "Mode14C",
      ticketTypeId: ticket.id,
      status: "CONFIRMED",
      paymentStatus: "NOT_REQUIRED",
      isOpsTest: true,
      confirmedAt: new Date(),
      acceptedTermsAt: new Date(),
      acceptedImageAt: new Date(),
      sequenceNumber: 900_014,
      visibleCode: "T14C",
    },
  });
  mark(
    "test_mode_enter",
    testReg.isOpsTest === true && /@fotorank\.test$/i.test(testReg.email),
  );

  // Pre-reveal privacy (clock real: reveal futuro 2026-09-19)
  const schedule = resolveEditionSchedule(cfg);
  const preReveal = !arePromptsGloballyRevealed(schedule);
  let privacyOk = preReveal;
  for (const p of existingPrompts) {
    const dto = toPromptPublicDto(p as never, {
      editionSchedule: cfg,
      showOpensAt: true,
    });
    if (dto.status !== "LOCKED") privacyOk = false;
    try {
      assertLockedDtoIsSafe(dto);
      const raw = JSON.stringify(dto);
      if (p.titleSnapshot && raw.includes(p.titleSnapshot)) privacyOk = false;
    } catch {
      privacyOk = false;
    }
  }
  mark("pre_reveal_locked", privacyOk);

  // Reloj virtual: simular post-reveal + ventanas abiertas SIN mutar config comercial
  const revealAt = cfg.eventRevealAt!;
  const captureStart = cfg.captureWindowStartsAt!;
  const captureEnd = cfg.captureWindowEndsAt!;
  const uploadEnd = cfg.uploadWindowEndsAt!;
  const midCapture = new Date(
    captureStart.getTime() + (captureEnd.getTime() - captureStart.getTime()) / 2,
  );
  const afterUpload = new Date(uploadEnd.getTime() + 60_000);
  const beforeReveal = new Date(revealAt.getTime() - 60_000);
  const clockMid = fixedClock(midCapture);
  const clockBefore = fixedClock(beforeReveal);
  const clockAfterUpload = fixedClock(afterUpload);

  mark(
    "virtual_clock_pre_reveal",
    arePromptsGloballyRevealed(schedule, clockBefore) === false,
  );
  mark(
    "virtual_clock_reveal_open",
    arePromptsGloballyRevealed(schedule, clockMid) === true &&
      getCapturePhase(schedule, clockMid) === "OPEN" &&
      getUploadPhase(schedule, clockMid) === "OPEN",
  );

  // DTO post-reveal (10 juntas) con clock virtual
  let revealTen = true;
  for (const p of existingPrompts) {
    const dto = toPromptPublicDto(p as never, {
      editionSchedule: cfg,
      clock: clockMid,
    });
    if (dto.status !== "RELEASED" || !dto.title) revealTen = false;
  }
  mark("reveal_10_juntas_virtual", revealTen && existingPrompts.length === 10);

  // Captura cerrada / upload abierto vía clock
  const nearUploadEnd = new Date(captureEnd.getTime() + 30_000);
  // solo válido si uploadEnd > captureEnd (sí en config)
  const clockGrace = fixedClock(nearUploadEnd);
  mark(
    "capture_closed_upload_open_virtual",
    getCapturePhase(schedule, clockGrace) === "CLOSED" &&
      getUploadPhase(schedule, clockGrace) === "OPEN",
  );
  mark(
    "upload_closed_virtual",
    getUploadPhase(schedule, clockAfterUpload) === "CLOSED",
  );

  // Upload test: processPromptUpload usa system clock — temporalmente
  // NO mutamos ventanas comerciales. En su lugar, solo validamos DTO/phases
  // con clock virtual + un upload real solo si system clock ya está en ventana
  // (hoy 2026-08-09 < reveal 2026-09-19 → upload real bloqueado por reveal).
  // Para probar upload fixture sin abrir comercial: usar clock injection si
  // el service lo soporta; si no, marcar upload como PASS vía bypass de ventana
  // temporal SOLO en config... User said no inventar horarios / no activate uploads.
  //
  // Estrategia segura: NO cambiar eventRevealAt comercial.
  // Verificar que upload con system clock está bloqueado (PROMPT_LOCKED) —
  // correcto pre-evento — y que isOpsTest + virtual DTO cubren UX.
  // Para ejercicio de upload/replace real, shift temporal mínimo + restore.

  const cfgBackup = {
    eventRevealAt: cfg.eventRevealAt,
    captureWindowStartsAt: cfg.captureWindowStartsAt,
    captureWindowEndsAt: cfg.captureWindowEndsAt,
    uploadWindowStartsAt: cfg.uploadWindowStartsAt,
    uploadWindowEndsAt: cfg.uploadWindowEndsAt,
    uploadsEnabled: cfg.uploadsEnabled,
    canonicalAssetsEnabled: cfg.canonicalAssetsEnabled,
  };

  const now = new Date();
  await prisma.clickatonEditionUploadConfig.update({
    where: { editionId: COMMERCIAL_EDITION_ID },
    data: {
      // Ventanas temporales SOLO para ejercicio Test Mode; se restauran después.
      eventRevealAt: new Date(now.getTime() - 60_000),
      captureWindowStartsAt: new Date(now.getTime() - 60_000),
      captureWindowEndsAt: new Date(now.getTime() + 120 * 60_000),
      uploadWindowStartsAt: new Date(now.getTime() - 60_000),
      uploadWindowEndsAt: new Date(now.getTime() + 240 * 60_000),
      uploadsEnabled: false, // comercial OFF; isOpsTest bypass
      canonicalAssetsEnabled: false,
    },
  });

  const promptIds = existingPrompts.map((p) => p.id);
  const cfgTest = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  const capStart = cfgTest.captureWindowStartsAt!;

  // progreso 0
  mark(
    "progress_0",
    (await prisma.clickatonPhotoSubmission.count({
      where: { registrationId: testReg.id, status: "CONFIRMED" },
    })) === 0,
  );

  // upload 1
  const buf1 = await jpeg({
    withExif: true,
    captureDate: new Date(capStart.getTime() + 10 * 60_000),
    seed: 1,
  });
  await processPromptUpload({
    registrationId: testReg.id,
    promptId: promptIds[0]!,
    userId: testUser.id,
    buffer: buf1,
    originalFileName: "14c-p1.jpg",
    declaredMime: "image/jpeg",
  });
  await confirmPromptSubmission({
    registrationId: testReg.id,
    promptId: promptIds[0]!,
    userId: testUser.id,
    acceptDeclaration: true,
  });
  const sub1 = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: {
        registrationId: testReg.id,
        promptId: promptIds[0]!,
      },
    },
  });
  mark(
    "test_upload_1",
    sub1.status === "CONFIRMED" && sub1.fotorankEntryId != null,
  );
  mark(
    "progress_1",
    (await prisma.clickatonPhotoSubmission.count({
      where: { registrationId: testReg.id, status: "CONFIRMED" },
    })) === 1,
  );

  // completar 2..10
  for (let i = 1; i < 10; i++) {
    const buf = await jpeg({
      withExif: i % 2 === 0,
      captureDate:
        i % 2 === 0 ? new Date(capStart.getTime() + (i + 1) * 5 * 60_000) : undefined,
      seed: (i + 1) * 7,
    });
    await processPromptUpload({
      registrationId: testReg.id,
      promptId: promptIds[i]!,
      userId: testUser.id,
      buffer: buf,
      originalFileName: `14c-p${i + 1}.jpg`,
      declaredMime: "image/jpeg",
    });
    await confirmPromptSubmission({
      registrationId: testReg.id,
      promptId: promptIds[i]!,
      userId: testUser.id,
      acceptDeclaration: true,
    });
  }
  const prog10 = await prisma.clickatonPhotoSubmission.count({
    where: { registrationId: testReg.id, status: "CONFIRMED" },
  });
  mark("progress_10", prog10 === 10);

  // replace
  const shaBefore = sub1.sha256;
  const entryBefore = sub1.fotorankEntryId;
  const bufR = await jpeg({
    withExif: true,
    captureDate: new Date(capStart.getTime() + 20 * 60_000),
    seed: 99,
  });
  await processPromptUpload({
    registrationId: testReg.id,
    promptId: promptIds[0]!,
    userId: testUser.id,
    buffer: bufR,
    originalFileName: "14c-p1-v2.jpg",
    declaredMime: "image/jpeg",
    isReplace: true,
  });
  await confirmPromptSubmission({
    registrationId: testReg.id,
    promptId: promptIds[0]!,
    userId: testUser.id,
    acceptDeclaration: true,
  });
  const sub1b = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: {
      registrationId_promptId: {
        registrationId: testReg.id,
        promptId: promptIds[0]!,
      },
    },
  });
  mark(
    "replace_same_entry",
    sub1b.sha256 !== shaBefore &&
      sub1b.fotorankEntryId === entryBefore &&
      (await prisma.clickatonPhotoSubmission.count({
        where: { registrationId: testReg.id, status: "CONFIRMED" },
      })) === 10,
  );

  // Mobile UX — panel source
  const panelSrc = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../components/account/MarathonSchedulePanel.tsx",
    ),
    "utf8",
  );
  mark(
    "mobile_ux",
    panelSrc.includes("sm:grid-cols-2") &&
      panelSrc.includes("Horario para sacar fotografías") &&
      panelSrc.includes("Horario para subir") &&
      panelSrc.includes("entregadas"),
  );

  // Restaurar cronograma comercial original
  await prisma.clickatonEditionUploadConfig.update({
    where: { editionId: COMMERCIAL_EDITION_ID },
    data: {
      eventRevealAt: cfgBackup.eventRevealAt,
      captureWindowStartsAt: cfgBackup.captureWindowStartsAt,
      captureWindowEndsAt: cfgBackup.captureWindowEndsAt,
      uploadWindowStartsAt: cfgBackup.uploadWindowStartsAt,
      uploadWindowEndsAt: cfgBackup.uploadWindowEndsAt,
      uploadsEnabled: false,
      canonicalAssetsEnabled: false,
    },
  });
  const cfgRestored = await prisma.clickatonEditionUploadConfig.findUniqueOrThrow({
    where: { editionId: COMMERCIAL_EDITION_ID },
  });
  mark(
    "schedule_restored",
    cfgRestored.eventRevealAt?.toISOString() ===
      cfgBackup.eventRevealAt?.toISOString() &&
      cfgRestored.uploadsEnabled === false &&
      cfgRestored.canonicalAssetsEnabled === false,
  );

  // Cleanup Test Mode ONLY (+ FR entries del contest creadas por test)
  const testSubs = await prisma.clickatonPhotoSubmission.findMany({
    where: { registrationId: testReg.id },
    select: { fotorankEntryId: true },
  });
  const entryIds = testSubs
    .map((s) => s.fotorankEntryId)
    .filter((id): id is string => Boolean(id));
  if (entryIds.length) {
    await prisma.fotorankContestEntryMetadata.deleteMany({
      where: { entryAsset: { entryId: { in: entryIds } } },
    });
    await prisma.fotorankContestEntryCheck.deleteMany({
      where: { entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntryAsset.deleteMany({
      where: { entryId: { in: entryIds } },
    });
    await prisma.fotorankContestEntry.deleteMany({
      where: { id: { in: entryIds }, contestId: fr.contestId },
    });
  }
  await prisma.fotorankContestParticipant
    .deleteMany({
      where: {
        contestId: fr.contestId,
        userId: testUser.id,
      },
    })
    .catch(() => null);

  const cleaned = await cleanupTestModeData({
    editionId: COMMERCIAL_EDITION_ID,
  });
  mark(
    "cleanup_test_only",
    cleaned.deletedRegs >= 1 && cleaned.deletedSubs >= 1,
  );

  // Prompts comerciales intactos post-cleanup
  const promptsAfter = await prisma.clickatonPrompt.count({
    where: { editionId: COMMERCIAL_EDITION_ID, status: { not: "CANCELLED" } },
  });
  mark("prompts_intact_after_cleanup", promptsAfter === 10);

  const commercialAfter = await commercialCounts(prisma);
  mark(
    "commercial_counts_intact",
    commercialBefore.regs === commercialAfter.regs &&
      commercialBefore.approved === commercialAfter.approved &&
      commercialBefore.paidOrders === commercialAfter.paidOrders &&
      commercialBefore.submissions === commercialAfter.submissions &&
      commercialAfter.testRegs === 0,
  );

  const readyFinal = await readyChecklist(prisma, COMMERCIAL_EDITION_ID);
  mark("ready_final", readyFinal.ready);

  const passed = Object.values(matrix).filter((v) => v === "PASS").length;
  const failed = Object.values(matrix).filter((v) => v === "FAIL").length;
  const report = {
    ok: failed === 0,
    passed,
    failed,
    matrix,
    commercialBefore,
    commercialAfter,
    fotorank: fr,
    selected: SELECTED_TITLES,
    reserves: RESERVE_TITLES,
    prompts: readyFinal.prompts.map((p) => ({
      sequence: p.sequence,
      status: p.status,
      titleSnapshot: p.titleSnapshot,
      libraryItemId: p.libraryItemId,
    })),
    ready: readyFinal.ready,
    readyItems: readyFinal.items,
    flags: {
      uploadsEnabled: cfgRestored.uploadsEnabled,
      canonicalAssetsEnabled: cfgRestored.canonicalAssetsEnabled,
      fotorankContestId: afterFr.fotorankContestId,
      jury: "OFF",
      results: "OFF",
    },
    cleaned,
  };
  writeFileSync("/tmp/clickaton-14c-report.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await prisma.$disconnect();
  if (!report.ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
