import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { EntryError } from "./errors";
import { buildChecklist, CHECKLIST_RULE_VERSION, entryStatusFromSummary, summarizeChecklist } from "./checklist";
import { generateEntryDerivatives, readImageDimensions } from "./derivatives";
import { assessDeviceCompatibility, extractEntryExif } from "./exif";
import { sha256Buffer, type DuplicateMatch } from "./hash";
import { parseUploadPolicy } from "./upload-policy";
import {
  buildVersionedEntryStorageKey,
  storageKeyContainsPiiLeak,
} from "../storage/private-local-storage";
import { getContestEntryStorage } from "../storage/provider";

function newId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

/**
 * Ventana de carga de obras.
 * Preferimos `submissionOpensAt` / `submissionDeadline` explícitos.
 * Si `submissionOpensAt` es null, la carga permanece cerrada (fail-closed para RC con upload OFF).
 */
function assertUploadWindow(contest: {
  submissionOpensAt: Date | null;
  submissionDeadline: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startAt: Date | null;
  status: string;
}, now: Date): boolean {
  if (contest.status === "CLOSED" || contest.status === "ARCHIVED") return false;
  // Fail-closed: sin apertura explícita de submission, no hay carga.
  if (!contest.submissionOpensAt) return false;
  const opens = contest.submissionOpensAt;
  const closes = contest.submissionDeadline ?? contest.registrationClosesAt;
  if (opens.getTime() > now.getTime()) return false;
  if (closes && closes.getTime() < now.getTime()) return false;
  return true;
}

const UPLOAD_CLOSED_MESSAGE =
  "La carga de fotografías aún no está habilitada. Se comunicará por los canales oficiales del concurso.";

async function findDuplicate(input: {
  contestId: string;
  registrationId: string;
  entryId: string;
  sha256: string;
}): Promise<DuplicateMatch> {
  const sameReg = await prisma.fotorankContestEntryAsset.findFirst({
    where: {
      contestId: input.contestId,
      registrationId: input.registrationId,
      sha256: input.sha256,
      kind: "ORIGINAL",
      entryId: { not: input.entryId },
    },
    select: { id: true, entryId: true },
  });
  if (sameReg) {
    return { scope: "SAME_REGISTRATION", matchingAssetId: sameReg.id, matchingEntryId: sameReg.entryId };
  }

  const sameContest = await prisma.fotorankContestEntryAsset.findFirst({
    where: {
      contestId: input.contestId,
      sha256: input.sha256,
      kind: "ORIGINAL",
      isActive: true,
      entryId: { not: input.entryId },
    },
    select: { id: true, entryId: true },
  });
  if (sameContest) {
    return { scope: "SAME_CONTEST", matchingAssetId: sameContest.id, matchingEntryId: sameContest.entryId };
  }
  return { scope: "NONE", matchingAssetId: null, matchingEntryId: null };
}

/**
 * Obtiene o crea la obra (1 por inscripción).
 */
export async function ensureEntryForRegistration(input: {
  contestId: string;
  registrationId: string;
  participantUserId: number;
}): Promise<{ entryId: string; created: boolean }> {
  const reg = await prisma.fotorankContestRegistration.findUnique({
    where: { id: input.registrationId },
  });
  if (!reg || reg.contestId !== input.contestId) {
    throw new EntryError("REGISTRATION_REQUIRED", "Inscripción no encontrada.", 404);
  }
  if (reg.participantUserId !== input.participantUserId) {
    throw new EntryError("FORBIDDEN", "No podés cargar obras en esta inscripción.", 403);
  }
  if (reg.status !== "CONFIRMED") {
    throw new EntryError("REGISTRATION_NOT_CONFIRMED", "La inscripción debe estar confirmada.", 403);
  }

  const existing = await prisma.fotorankContestEntry.findUnique({
    where: { registrationId: reg.id },
    select: { id: true },
  });
  if (existing) return { entryId: existing.id, created: false };

  const created = await prisma.fotorankContestEntry.create({
    data: {
      contestId: reg.contestId,
      categoryId: reg.categoryId,
      authorUserId: reg.participantUserId,
      registrationId: reg.id,
      status: "DRAFT",
      imageUrl: "",
    },
    select: { id: true },
  });
  return { entryId: created.id, created: true };
}

export async function createUploadIntent(input: {
  contestId: string;
  participantUserId: number;
}): Promise<{
  entryId: string;
  registrationId: string;
  uploadUrl: string;
  maxFileSizeBytes: number;
  allowedMimeTypes: string[];
}> {
  const reg = await prisma.fotorankContestRegistration.findUnique({
    where: {
      contestId_participantUserId: {
        contestId: input.contestId,
        participantUserId: input.participantUserId,
      },
    },
  });
  if (!reg) throw new EntryError("REGISTRATION_REQUIRED", "Primero completá la inscripción.", 404);
  if (reg.status !== "CONFIRMED") {
    throw new EntryError("REGISTRATION_NOT_CONFIRMED", "La inscripción debe estar confirmada.", 403);
  }

  const contest = await prisma.fotorankContest.findUnique({ where: { id: input.contestId } });
  if (!contest) throw new EntryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  if (!assertUploadWindow(contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", UPLOAD_CLOSED_MESSAGE, 403);
  }

  const policy = parseUploadPolicy(contest.uploadPolicyJson);
  const { entryId } = await ensureEntryForRegistration({
    contestId: input.contestId,
    registrationId: reg.id,
    participantUserId: input.participantUserId,
  });

  return {
    entryId,
    registrationId: reg.id,
    uploadUrl: `/api/fotorank/contests/${input.contestId}/entries/${entryId}/upload`,
    maxFileSizeBytes: policy.maxFileSizeBytes,
    allowedMimeTypes: policy.allowedMimeTypes,
  };
}

export async function processUploadedFile(input: {
  contestId: string;
  entryId: string;
  participantUserId: number;
  buffer: Buffer;
  originalFileName: string;
  declaredMime: string;
  isReplace?: boolean;
}): Promise<{
  entryId: string;
  status: string;
  technicalSummaryStatus: string;
  versionNumber: number;
  checklistSummary: ReturnType<typeof summarizeChecklist>;
  warnings: string[];
}> {
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: input.entryId },
    include: {
      registration: true,
      category: true,
      contest: true,
    },
  });
  if (!entry || entry.contestId !== input.contestId) {
    throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  }
  if (entry.authorUserId !== input.participantUserId) {
    throw new EntryError("FORBIDDEN", "No podés modificar esta obra.", 403);
  }
  if (!entry.registration || entry.registration.status !== "CONFIRMED") {
    throw new EntryError("REGISTRATION_NOT_CONFIRMED", "Inscripción no confirmada.", 403);
  }
  if (!assertUploadWindow(entry.contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", UPLOAD_CLOSED_MESSAGE, 403);
  }

  const policy = parseUploadPolicy(entry.contest.uploadPolicyJson);
  if (input.isReplace && !policy.allowReplaceUntilSubmissionClose) {
    throw new EntryError("REPLACE_NOT_ALLOWED", "Este concurso no permite reemplazo.", 403);
  }

  await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: { status: "PROCESSING" },
  });

  const ext = (input.originalFileName.split(".").pop() || "jpg").toLowerCase().replace(/^\./, "");
  const mime = input.declaredMime || "application/octet-stream";
  // MIME real aproximado por magic bytes JPEG
  const isJpegMagic = input.buffer.length > 3 && input.buffer[0] === 0xff && input.buffer[1] === 0xd8;
  const realMime = isJpegMagic ? "image/jpeg" : mime;

  const dims = await readImageDimensions(input.buffer);
  const hash = sha256Buffer(input.buffer);
  const exif = await extractEntryExif(input.buffer);
  const duplicate = await findDuplicate({
    contestId: entry.contestId,
    registrationId: entry.registrationId!,
    entryId: entry.id,
    sha256: hash,
  });

  // Idempotencia: mismo hash activo en esta entry → devolver estado actual
  const existingSame = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: entry.id, kind: "ORIGINAL", sha256: hash, isActive: true },
  });
  if (existingSame && !input.isReplace) {
    const summary = (entry.technicalSummaryJson as ReturnType<typeof summarizeChecklist> | null) ?? summarizeChecklist([]);
    return {
      entryId: entry.id,
      status: entry.status,
      technicalSummaryStatus: entry.technicalSummaryStatus,
      versionNumber: existingSame.versionNumber,
      checklistSummary: summary,
      warnings: ["El archivo ya estaba cargado (idempotencia)."],
    };
  }

  const lastVersion = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: entry.id, kind: "ORIGINAL" },
    orderBy: { versionNumber: "desc" },
    select: { versionNumber: true },
  });
  const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;
  const originalAssetId = newId();
  const storage = getContestEntryStorage();

  const originalKey = buildVersionedEntryStorageKey({
    contestId: entry.contestId,
    entryId: entry.id,
    versionNumber,
    kind: "original",
    assetId: originalAssetId,
  });
  if (storageKeyContainsPiiLeak(originalKey)) {
    throw new EntryError("PROCESSING_FAILED", "Key de storage inválida.", 500);
  }

  await storage.putObject(originalKey, input.buffer, realMime);

  let derivatives: Awaited<ReturnType<typeof generateEntryDerivatives>> | null = null;
  if (dims.decodable) {
    try {
      derivatives = await generateEntryDerivatives(input.buffer);
    } catch {
      derivatives = null;
    }
  }

  const deviceCompatibility = assessDeviceCompatibility({
    categorySlug: entry.category.slug,
    make: exif.cameraMake,
    model: exif.cameraModel,
    software: exif.software,
  });

  const checks = buildChecklist({
    policy,
    mimeType: realMime,
    extension: ext,
    fileSizeBytes: input.buffer.byteLength,
    width: dims.width,
    height: dims.height,
    decodable: dims.decodable,
    registrationConfirmed: true,
    categoryMatches: entry.categoryId === entry.registration.categoryId,
    userMatches: true,
    contestActive: entry.contest.status === "PUBLISHED" || entry.contest.status === "ACTIVE",
    categoryActive: entry.category.status === "ACTIVE",
    withinUploadWindow: true,
    maxEntriesOk: policy.maxEntriesPerRegistration >= 1,
    exif,
    duplicate,
    deviceCompatibility,
    storagePrivate: storage.isPrivate,
    storageKeyValid: !storageKeyContainsPiiLeak(originalKey) && originalKey.startsWith("fotorank/"),
  });
  // MIME falso: si declara image/png pero es jpeg magic ok; si no es jpeg y policy exige jpeg → FAIL ya cubierto
  if (!isJpegMagic && policy.allowedMimeTypes.includes("image/jpeg")) {
    checks.push({
      checkCode: "FILE_MAGIC",
      checkGroup: "SECURITY",
      status: "FAIL",
      severity: "blocking",
      title: "Firma de archivo",
      message: "El contenido no coincide con un JPEG válido.",
    });
  } else {
    checks.push({
      checkCode: "FILE_MAGIC",
      checkGroup: "SECURITY",
      status: "PASS",
      severity: null,
      title: "Firma de archivo",
      message: "Firma JPEG válida.",
    });
  }

  const summary = summarizeChecklist(checks);
  const nextStatus = entryStatusFromSummary(summary);

  const result = await prisma.$transaction(async (tx) => {
    // Desactivar originales previos
    await tx.fotorankContestEntryAsset.updateMany({
      where: { entryId: entry.id, kind: "ORIGINAL", isActive: true },
      data: { isActive: false, replacedAt: new Date() },
    });

    const original = await tx.fotorankContestEntryAsset.create({
      data: {
        id: originalAssetId,
        contestId: entry.contestId,
        registrationId: entry.registrationId,
        entryId: entry.id,
        versionNumber,
        kind: "ORIGINAL",
        storageProvider: "local_private",
        storageBucket: storage.bucket,
        storageKey: originalKey,
        mimeType: realMime,
        extension: ext,
        originalFileName: input.originalFileName.slice(0, 240),
        fileSizeBytes: input.buffer.byteLength,
        width: dims.width || null,
        height: dims.height || null,
        sha256: hash,
        isActive: true,
        uploadedAt: new Date(),
        processedAt: new Date(),
      },
    });

    await tx.fotorankContestEntryMetadata.create({
      data: {
        entryAssetId: original.id,
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        lensModel: exif.lensModel,
        captureDate: exif.captureDate,
        digitizedDate: exif.digitizedDate,
        software: exif.software,
        iso: exif.iso,
        aperture: exif.aperture,
        shutterSpeed: exif.shutterSpeed,
        focalLength: exif.focalLength,
        gpsLatitude: exif.gpsLatitude,
        gpsLongitude: exif.gpsLongitude,
        gpsAltitude: exif.gpsAltitude,
        orientation: exif.orientation,
        colorSpace: exif.colorSpace,
        metadataStatus: exif.metadataStatus,
        rawMetadataJson: (exif.rawMetadataJson as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });

    if (derivatives) {
      const thumbId = newId();
      const juryId = newId();
      const thumbKey = buildVersionedEntryStorageKey({
        contestId: entry.contestId,
        entryId: entry.id,
        versionNumber,
        kind: "thumbnail",
        assetId: thumbId,
      });
      const juryKey = buildVersionedEntryStorageKey({
        contestId: entry.contestId,
        entryId: entry.id,
        versionNumber,
        kind: "jury",
        assetId: juryId,
      });
      await storage.putObject(thumbKey, derivatives.thumbnail.buffer, "image/jpeg");
      await storage.putObject(juryKey, derivatives.juryPreview.buffer, "image/jpeg");

      await tx.fotorankContestEntryAsset.createMany({
        data: [
          {
            id: thumbId,
            contestId: entry.contestId,
            registrationId: entry.registrationId,
            entryId: entry.id,
            versionNumber,
            kind: "THUMBNAIL",
            storageProvider: "local_private",
            storageBucket: storage.bucket,
            storageKey: thumbKey,
            mimeType: "image/jpeg",
            extension: "jpg",
            fileSizeBytes: derivatives.thumbnail.buffer.byteLength,
            width: derivatives.thumbnail.width,
            height: derivatives.thumbnail.height,
            isActive: true,
            uploadedAt: new Date(),
            processedAt: new Date(),
            sourceOriginalAssetId: original.id,
          },
          {
            id: juryId,
            contestId: entry.contestId,
            registrationId: entry.registrationId,
            entryId: entry.id,
            versionNumber,
            kind: "JURY_PREVIEW",
            storageProvider: "local_private",
            storageBucket: storage.bucket,
            storageKey: juryKey,
            mimeType: "image/jpeg",
            extension: "jpg",
            fileSizeBytes: derivatives.juryPreview.buffer.byteLength,
            width: derivatives.juryPreview.width,
            height: derivatives.juryPreview.height,
            isActive: true,
            uploadedAt: new Date(),
            processedAt: new Date(),
            sourceOriginalAssetId: original.id,
          },
        ],
      });
    }

    await tx.fotorankContestEntryCheck.deleteMany({ where: { entryId: entry.id } });
    await tx.fotorankContestEntryCheck.createMany({
      data: checks.map((c) => ({
        entryId: entry.id,
        assetId: original.id,
        checkCode: c.checkCode,
        checkGroup: c.checkGroup,
        status: c.status,
        severity: c.severity,
        title: c.title,
        message: c.message,
        detailsJson: (c.detailsJson as Prisma.InputJsonValue | undefined) ?? undefined,
        ruleVersion: CHECKLIST_RULE_VERSION,
      })),
    });

    const updated = await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        status: nextStatus === "REJECTED" ? "REJECTED" : nextStatus,
        activeAssetId: original.id,
        submittedAt: new Date(),
        replacedAt: versionNumber > 1 ? new Date() : entry.replacedAt,
        confirmedAt: null, // requiere reconfirmación tras upload/replace
        technicalSummaryStatus: summary.status,
        technicalSummaryJson: summary as unknown as Prisma.InputJsonValue,
        imageUrl: "", // nunca URL pública del original
      },
    });

    return { updated, versionNumber };
  });

  const warnings = checks.filter((c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW").map((c) => c.message);

  return {
    entryId: entry.id,
    status: result.updated.status,
    technicalSummaryStatus: result.updated.technicalSummaryStatus,
    versionNumber: result.versionNumber,
    checklistSummary: summary,
    warnings,
  };
}

export async function confirmEntry(input: {
  contestId: string;
  entryId: string;
  participantUserId: number;
  acknowledgeWarnings?: boolean;
}): Promise<{ entryNumber: string; status: string }> {
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: input.entryId },
    include: { contest: true },
  });
  if (!entry || entry.contestId !== input.contestId) {
    throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  }
  if (entry.authorUserId !== input.participantUserId) {
    throw new EntryError("FORBIDDEN", "No autorizado.", 403);
  }
  if (!assertUploadWindow(entry.contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", UPLOAD_CLOSED_MESSAGE, 403);
  }
  if (entry.status === "REJECTED" || entry.technicalSummaryStatus === "TECHNICALLY_REJECTED") {
    throw new EntryError("CONFIRM_BLOCKED", "Hay fallos técnicos bloqueantes. Reemplazá la fotografía.", 409);
  }
  if (entry.status !== "READY_TO_CONFIRM" && entry.status !== "REQUIRES_REVIEW" && entry.status !== "CONFIRMED") {
    throw new EntryError("NOT_READY", "La obra aún no está lista para confirmar.", 409);
  }
  if (entry.status === "REQUIRES_REVIEW" && !input.acknowledgeWarnings) {
    throw new EntryError(
      "CONFIRM_BLOCKED",
      "La fotografía necesita revisión. Podés confirmar asumiendo las advertencias o esperar revisión del organizador.",
      409,
    );
  }

  let entryNumber = entry.entryNumber;
  if (!entryNumber) {
    const count = await prisma.fotorankContestEntry.count({
      where: { contestId: entry.contestId, entryNumber: { not: null } },
    });
    const prefix = entry.contest.slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "FR";
    entryNumber = `${prefix}-E-${String(count + 1).padStart(6, "0")}`;
  }

  const updated = await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      entryNumber,
    },
  });

  return { entryNumber: updated.entryNumber!, status: updated.status };
}

export async function getMyEntry(contestId: string, participantUserId: number) {
  const reg = await prisma.fotorankContestRegistration.findUnique({
    where: { contestId_participantUserId: { contestId, participantUserId } },
  });
  if (!reg) return null;
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { registrationId: reg.id },
    include: {
      checks: { orderBy: { checkGroup: "asc" } },
      assets: {
        where: { isActive: true },
        orderBy: { versionNumber: "desc" },
      },
      category: { select: { id: true, name: true, slug: true } },
    },
  });
  return entry;
}

export async function listContestEntriesForOrganizer(input: {
  contestId: string;
  organizerUserId: number;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) throw new EntryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId: input.organizerUserId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR", "VIEWER"] },
    },
  });
  if (!member) throw new EntryError("FORBIDDEN", "Sin acceso a este concurso.", 403);

  const registrations = await prisma.fotorankContestRegistration.findMany({
    where: { contestId: input.contestId },
    include: {
      participant: { select: { id: true, name: true, email: true } },
      category: { select: { name: true } },
      entry: {
        include: {
          checks: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return registrations.map((r) => {
    const checks = r.entry?.checks ?? [];
    return {
      registrationId: r.id,
      registrationNumber: r.registrationNumber,
      registrationStatus: r.status,
      participantName: r.participant.name,
      participantEmail: r.participant.email,
      categoryName: r.category.name,
      entryId: r.entry?.id ?? null,
      entryStatus: r.entry?.status ?? null,
      entryNumber: r.entry?.entryNumber ?? null,
      technicalSummaryStatus: r.entry?.technicalSummaryStatus ?? null,
      submittedAt: r.entry?.submittedAt ?? null,
      confirmedAt: r.entry?.confirmedAt ?? null,
      warnings: checks.filter((c) => c.status === "WARNING").length,
      failures: checks.filter((c) => c.status === "FAIL").length,
      requiresReview: checks.filter((c) => c.status === "REQUIRES_REVIEW").length,
    };
  });
}

export async function withdrawEntry(input: {
  contestId: string;
  entryId: string;
  participantUserId: number;
}): Promise<{ status: string }> {
  const entry = await prisma.fotorankContestEntry.findUnique({
    where: { id: input.entryId },
    include: { contest: true },
  });
  if (!entry || entry.contestId !== input.contestId) {
    throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  }
  if (entry.authorUserId !== input.participantUserId) {
    throw new EntryError("FORBIDDEN", "No autorizado.", 403);
  }
  if (entry.status === "WITHDRAWN") {
    return { status: entry.status };
  }
  const policy = parseUploadPolicy(entry.contest.uploadPolicyJson);
  if (!policy.allowReplaceUntilSubmissionClose && entry.status === "CONFIRMED") {
    throw new EntryError("WITHDRAW_NOT_ALLOWED", "No se puede retirar esta obra.", 403);
  }

  const updated = await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      status: "WITHDRAWN",
      withdrawnAt: new Date(),
    },
  });
  return { status: updated.status };
}

export async function createManualReview(input: {
  contestId: string;
  entryId: string;
  reviewerUserId: number;
  decision: "APPROVED" | "REPLACEMENT_REQUESTED" | "REJECTED" | "CLEARED_WARNING";
  reason?: string;
  notes?: string;
}) {
  await listContestEntriesForOrganizer({
    contestId: input.contestId,
    organizerUserId: input.reviewerUserId,
  });

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
  });
  if (!entry) throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);

  const review = await prisma.fotorankContestEntryReview.create({
    data: {
      entryId: entry.id,
      reviewerUserId: input.reviewerUserId,
      decision: input.decision,
      reason: input.reason,
      notes: input.notes,
    },
  });

  const manualMap = {
    APPROVED: "APPROVED",
    REPLACEMENT_REQUESTED: "REPLACEMENT_REQUESTED",
    REJECTED: "REJECTED",
    CLEARED_WARNING: "CLEARED_WARNING",
  } as const;

  await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      manualReviewStatus: manualMap[input.decision],
      status:
        input.decision === "REJECTED"
          ? "REJECTED"
          : input.decision === "APPROVED" || input.decision === "CLEARED_WARNING"
            ? entry.status === "REQUIRES_REVIEW"
              ? "READY_TO_CONFIRM"
              : entry.status
            : entry.status,
    },
  });

  return review;
}
