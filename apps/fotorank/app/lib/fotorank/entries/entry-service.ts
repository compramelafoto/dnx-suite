import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import {
  categoryRequiresArgra,
  evaluateCaptureWindowEligibility,
  evaluateSantaFeCategoryDeviceEligibility,
  evaluateTerritoryEligibility,
  normalizeInstagramHandle,
  type ArgraVerificationStatus,
  type DeviceKind,
  type EntryEligibilityAnswers,
  type RegistrationAnswers,
} from "../eligibility";
import { evaluateAdmissionAutoMatrix } from "../admission/auto-matrix";
import { ADMISSION_RULES_VERSION } from "../admission/types";
import { EntryError } from "./errors";
import { canCreateEntry } from "./entry-quota";
import { buildChecklist, CHECKLIST_RULE_VERSION, entryStatusFromSummary, summarizeChecklist } from "./checklist";
import { generateEntryDerivatives, readImageDimensions } from "./derivatives";
import { assessDeviceCompatibility, extractEntryExif } from "./exif";
import { sha256Buffer, type DuplicateMatch } from "./hash";
import { isPublicUploadOpenFlag, parseUploadPolicy } from "./upload-policy";
import {
  buildVersionedEntryStorageKey,
  storageKeyContainsPiiLeak,
} from "../storage/private-local-storage";
import { getContestEntryStorage } from "../storage/provider";
import { enqueueTransactionalEmail } from "../notifications/outbox";
import {
  assertRegistrationAcceptedCurrentRules,
} from "../registration/rules-reacceptance";
import { RegistrationError } from "../registration/errors";

export type EntryEligibilityFormInput = {
  captureLocality?: string | null;
  captureDepartment?: string | null;
  territoryConfirmedSantaFe?: boolean;
  declaredDeviceKind?: DeviceKind | null;
  declaredDeviceMake?: string | null;
  declaredDeviceModel?: string | null;
  captureWithinPeriodDeclared?: boolean;
  authorshipDeclared?: boolean;
  editingPolicyDeclared?: boolean;
  noGenerativeAiDeclared?: boolean;
  droneRegulationAcknowledged?: boolean;
  /** Permite completar Instagram faltante en inscripciones previas a ETAPA 10. */
  instagramHandle?: string | null;
};

function newId(): string {
  return `c${randomBytes(12).toString("hex")}`;
}

async function assertCurrentRulesAccepted(input: {
  contestId: string;
  registrationId: string;
  acceptedRulesVersionId: string;
}): Promise<void> {
  try {
    await assertRegistrationAcceptedCurrentRules(input);
  } catch (err) {
    if (err instanceof RegistrationError && err.code === "RULES_VERSION_MISMATCH") {
      throw new EntryError("RULES_VERSION_MISMATCH", err.message, 409);
    }
    throw err;
  }
}

function assertUploadWindow(contest: {
  submissionOpensAt: Date | null;
  submissionDeadline: Date | null;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
  startAt: Date | null;
  status: string;
  uploadPolicyJson?: unknown;
}, now: Date): boolean {
  if (contest.status === "CLOSED" || contest.status === "ARCHIVED") return false;
  const flag = isPublicUploadOpenFlag(contest.uploadPolicyJson);
  if (flag === false) return false;
  const opens = contest.submissionOpensAt ?? contest.registrationOpensAt ?? contest.startAt;
  const closes = contest.submissionDeadline ?? contest.registrationClosesAt;
  if (opens && opens.getTime() > now.getTime()) return false;
  if (closes && closes.getTime() < now.getTime()) return false;
  return true;
}

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
 * Obtiene o crea una obra de la inscripción.
 *
 * El cupo lo define el concurso (`maxEntriesPerRegistration`) y, si hubo pago
 * por paquete, `purchasedEntriesCount`. Con el default de 1 obra el
 * comportamiento es idéntico al anterior: devuelve la obra existente.
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

  const existing = await prisma.fotorankContestEntry.findMany({
    where: { registrationId: reg.id },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  const contest = await prisma.fotorankContest.findUnique({
    where: { id: reg.contestId },
    select: { uploadPolicyJson: true },
  });
  const quota = canCreateEntry({
    policyMaxEntries: parseUploadPolicy(contest?.uploadPolicyJson).maxEntriesPerRegistration,
    purchasedEntriesCount: reg.purchasedEntriesCount,
    currentEntryCount: existing.length,
  });

  if (!quota.allowed) {
    // Sin cupo para una obra más. Con límite 1 esto reproduce el comportamiento
    // histórico: se devuelve la obra ya existente en lugar de fallar.
    if (existing.length > 0) {
      return { entryId: existing[0]!.id, created: false };
    }
    throw new EntryError("ENTRY_QUOTA_EXCEEDED", quota.message, 409);
  }

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
  await assertCurrentRulesAccepted({
    contestId: input.contestId,
    registrationId: reg.id,
    acceptedRulesVersionId: reg.rulesVersionId,
  });

  const contest = await prisma.fotorankContest.findUnique({ where: { id: input.contestId } });
  if (!contest) throw new EntryError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  if (!assertUploadWindow(contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", "La ventana de carga está cerrada.", 403);
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
  eligibility?: EntryEligibilityFormInput | null;
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
  await assertCurrentRulesAccepted({
    contestId: input.contestId,
    registrationId: entry.registration.id,
    acceptedRulesVersionId: entry.registration.rulesVersionId,
  });
  if (!assertUploadWindow(entry.contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", "La ventana de carga está cerrada.", 403);
  }
  if (entry.admissionStatus === "FROZEN_FOR_JURY") {
    throw new EntryError("FROZEN", "La obra está congelada; no se puede reemplazar.", 409);
  }
  if (
    input.isReplace &&
    entry.manualReviewStatus !== "REPLACEMENT_REQUESTED" &&
    entry.admissionStatus === "ADMITTED"
  ) {
    throw new EntryError(
      "REPLACE_NOT_ALLOWED",
      "Una obra admitida no admite reemplazo salvo habilitación del organizador.",
      403,
    );
  }

  const policy = parseUploadPolicy(entry.contest.uploadPolicyJson);
  if (input.isReplace && !policy.allowReplaceUntilSubmissionClose) {
    throw new EntryError("REPLACE_NOT_ALLOWED", "Este concurso no permite reemplazo.", 403);
  }
  // Completar ventana de captura desde configuración publicada si falta en uploadPolicyJson.
  if (!policy.captureWindowStartsAt || !policy.captureWindowEndsExclusiveAt) {
    const cfgRow = await prisma.fotorankContestConfigurationVersion.findFirst({
      where: { contestId: entry.contestId, status: "PUBLISHED" },
      orderBy: { versionNumber: "desc" },
      select: { configurationJson: true },
    });
    const cfg = cfgRow?.configurationJson as {
      schedule?: { captureWindowStartsAt?: string | null; captureWindowEndsExclusiveAt?: string | null };
    } | null;
    if (cfg?.schedule?.captureWindowStartsAt) {
      policy.captureWindowStartsAt = new Date(cfg.schedule.captureWindowStartsAt);
    }
    if (cfg?.schedule?.captureWindowEndsExclusiveAt) {
      policy.captureWindowEndsExclusiveAt = new Date(cfg.schedule.captureWindowEndsExclusiveAt);
    }
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

  const elig = input.eligibility ?? {};
  const deviceEval = evaluateSantaFeCategoryDeviceEligibility({
    categorySlug: entry.category.slug,
    declaredDeviceKind: elig.declaredDeviceKind ?? null,
    exifMake: exif.cameraMake,
    exifModel: exif.cameraModel,
    software: exif.software,
  });
  const territoryEval = evaluateTerritoryEligibility({
    territoryConfirmedSantaFe: elig.territoryConfirmedSantaFe === true,
    captureLocality: elig.captureLocality,
    captureDepartment: elig.captureDepartment,
    gpsLatitude: exif.gpsLatitude,
    gpsLongitude: exif.gpsLongitude,
  });
  const captureEval = evaluateCaptureWindowEligibility({
    captureDate: exif.captureDate,
    captureWindowStartsAt: policy.captureWindowStartsAt,
    captureWindowEndsExclusiveAt: policy.captureWindowEndsExclusiveAt,
    timezone: "America/Argentina/Cordoba",
  });

  const isSantaFeContest =
    entry.contest.slug === "santa-fe-en-foco" || entry.contest.slug.includes("santa-fe");
  const eligibilityFormProvided = Boolean(
    input.eligibility &&
      (input.eligibility.captureLocality ||
        input.eligibility.territoryConfirmedSantaFe ||
        (input.eligibility.declaredDeviceKind && input.eligibility.declaredDeviceKind !== "UNKNOWN")),
  );
  const enforceSantaFeEligibility = isSantaFeContest || eligibilityFormProvided;

  if (enforceSantaFeEligibility) {
    if (deviceEval.decision === "NOT_ELIGIBLE") {
      throw new EntryError("DEVICE_NOT_ELIGIBLE", deviceEval.publicMessage, 400);
    }
    if (territoryEval.decision === "NOT_ELIGIBLE") {
      throw new EntryError("TERRITORY_REQUIRED", territoryEval.publicMessage, 400);
    }
    if (!elig.authorshipDeclared || !elig.editingPolicyDeclared || !elig.noGenerativeAiDeclared) {
      throw new EntryError(
        "DECLARATIONS_REQUIRED",
        "Debés confirmar autoría, política de edición y ausencia de IA generativa antes de subir.",
        400,
      );
    }
    if (categoryRequiresArgra(entry.category.slug)) {
      const answers = (entry.registration.answersJson ?? null) as { argraMembershipNumber?: string } | null;
      if (!answers?.argraMembershipNumber?.trim()) {
        throw new EntryError(
          "ARGRA_REQUIRED",
          "Falta el número de socio ARGRA en la inscripción para esta categoría.",
          400,
        );
      }
    }
    let regAnswers = (entry.registration.answersJson ?? null) as RegistrationAnswers | null;
    if (!regAnswers?.instagramHandle?.trim()) {
      const ig = normalizeInstagramHandle(elig.instagramHandle);
      if (!ig) {
        throw new EntryError(
          "INSTAGRAM_REQUIRED",
          "Falta Instagram. Completá @usuario antes de cargar la fotografía.",
          400,
        );
      }
      const nextAnswers: RegistrationAnswers = {
        ...(regAnswers ?? {}),
        instagramHandle: ig,
        openParticipationAcknowledged: regAnswers?.openParticipationAcknowledged ?? true,
      };
      if (!entry.registrationId) {
        throw new EntryError("REGISTRATION_REQUIRED", "Falta la inscripción asociada a la obra.", 400);
      }
      await prisma.fotorankContestRegistration.update({
        where: { id: entry.registrationId },
        data: { answersJson: nextAnswers as Prisma.InputJsonValue },
      });
      regAnswers = nextAnswers;
    }
  }

  const eligibilityAnswers: EntryEligibilityAnswers = {
    captureLocality: (elig.captureLocality ?? "").trim(),
    captureDepartment: elig.captureDepartment ?? null,
    territoryConfirmedSantaFe: elig.territoryConfirmedSantaFe === true,
    declaredDeviceKind: elig.declaredDeviceKind ?? "UNKNOWN",
    declaredDeviceMake: elig.declaredDeviceMake ?? null,
    declaredDeviceModel: elig.declaredDeviceModel ?? null,
    captureWithinPeriodDeclared: elig.captureWithinPeriodDeclared === true,
    authorshipDeclared: elig.authorshipDeclared === true,
    editingPolicyDeclared: elig.editingPolicyDeclared === true,
    noGenerativeAiDeclared: elig.noGenerativeAiDeclared === true,
    droneRegulationAcknowledged: elig.droneRegulationAcknowledged === true,
    territoryStatus: territoryEval.territoryStatus,
    captureWindowStatus: captureEval.decision,
    deviceEligibilityStatus: deviceEval.decision,
    deviceReasonCode: deviceEval.reasonCode,
    gpsPresent: typeof exif.gpsLatitude === "number" && typeof exif.gpsLongitude === "number",
  };

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

  const registrationAnswers = (entry.registration.answersJson ?? null) as RegistrationAnswers | null;
  const argraStatus = (registrationAnswers?.argraVerificationStatus ??
    (categoryRequiresArgra(entry.category.slug) ? "PENDING_VERIFICATION" : "NOT_REQUIRED")) as ArgraVerificationStatus;

  const summaryPreview = summarizeChecklist(checks);
  const admissionDecision = enforceSantaFeEligibility
    ? evaluateAdmissionAutoMatrix({
        deviceEval,
        territoryEval,
        captureEval,
        argraStatus,
        categoryRequiresArgra: categoryRequiresArgra(entry.category.slug),
        checklistHasBlockingFail: summaryPreview.status === "TECHNICALLY_REJECTED",
        checklistRequiresReview:
          summaryPreview.status === "REQUIRES_REVIEW" ||
          checks.some((c) => c.status === "REQUIRES_REVIEW"),
        duplicateSuspected: Boolean(duplicate.matchingAssetId),
        exifMissing: !exif.captureDate && exif.metadataStatus !== "EXTRACTED",
        gpsPresent: eligibilityAnswers.gpsPresent === true,
        softwarePresent: Boolean(exif.software?.trim()),
      })
    : null;

  const needsManualReview =
    Boolean(admissionDecision?.requiresManualReview) ||
    (enforceSantaFeEligibility &&
      (deviceEval.decision === "MANUAL_REVIEW_REQUIRED" ||
        territoryEval.decision === "REVIEW_REQUIRED" ||
        captureEval.decision === "DATE_MISSING_REVIEW" ||
        captureEval.decision === "OUTSIDE_CAPTURE_WINDOW_REVIEW" ||
        captureEval.decision === "DATE_INVALID_REVIEW" ||
        captureEval.decision === "MANUAL_REVIEW_REQUIRED" ||
        (categoryRequiresArgra(entry.category.slug) && argraStatus !== "VERIFIED")));

  if (needsManualReview) {
    checks.push({
      checkCode: "ELIGIBILITY_REVIEW",
      checkGroup: "TIMING",
      status: "REQUIRES_REVIEW",
      severity: "warning",
      title: "Elegibilidad Santa Fe",
      message: [deviceEval.publicMessage, territoryEval.publicMessage, captureEval.publicMessage].join(" "),
      detailsJson: {
        deviceReason: deviceEval.reasonCode,
        territoryReason: territoryEval.reasonCode,
        captureReason: captureEval.reasonCode,
        // Nunca incluir GPS ni ARGRA aquí
        gpsPresent: eligibilityAnswers.gpsPresent === true,
        admissionReasonCodes: admissionDecision?.reasonCodes ?? [],
      },
    });
  }

  const summary = summarizeChecklist(checks);
  let nextStatus = entryStatusFromSummary(summary);
  if (needsManualReview && nextStatus !== "REJECTED") {
    nextStatus = "REQUIRES_REVIEW";
  }
  if (admissionDecision?.entryStatusHint === "REJECTED") {
    nextStatus = "REJECTED";
  }

  const previousActiveAssets = await prisma.fotorankContestEntryAsset.findMany({
    where: { entryId: entry.id, isActive: true },
    select: { id: true, storageKey: true, kind: true },
  });
  const storageProviderName = storage.providerName === "r2" ? "r2" : "local_private";

  const result = await prisma.$transaction(async (tx) => {
    // Desactivar assets previos (original + derivados)
    await tx.fotorankContestEntryAsset.updateMany({
      where: { entryId: entry.id, isActive: true },
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
        storageProvider: storageProviderName,
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
            storageProvider: storageProviderName,
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
            storageProvider: storageProviderName,
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

    const prevMeta =
      entry.metadataJson && typeof entry.metadataJson === "object" && !Array.isArray(entry.metadataJson)
        ? (entry.metadataJson as Record<string, unknown>)
        : {};
    const admissionOpsPrev =
      prevMeta.admissionOps && typeof prevMeta.admissionOps === "object"
        ? (prevMeta.admissionOps as Record<string, unknown>)
        : {};
    const nextAdmissionStatus = admissionDecision
      ? admissionDecision.admissionStatus
      : needsManualReview
        ? "PENDING_MANUAL_REVIEW"
        : "ELIGIBLE";
    const updated = await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        status: nextStatus === "REJECTED" ? "REJECTED" : nextStatus,
        activeAssetId: original.id,
        submittedAt: new Date(),
        replacedAt: versionNumber > 1 ? new Date() : entry.replacedAt,
        confirmedAt: null, // requiere reconfirmación tras upload/replace
        technicalSummaryStatus: needsManualReview
          ? "REQUIRES_REVIEW"
          : admissionDecision?.technicalSummaryHint ?? summary.status,
        technicalSummaryJson: summary as unknown as Prisma.InputJsonValue,
        imageUrl: "", // nunca URL pública del original
        admissionStatus: nextAdmissionStatus,
        metadataJson: (enforceSantaFeEligibility
          ? {
              ...prevMeta,
              eligibility: eligibilityAnswers,
              admissionOps: {
                ...admissionOpsPrev,
                lastReasonCodes: admissionDecision?.reasonCodes ?? [],
                rulesVersion: ADMISSION_RULES_VERSION,
                // Reemplazo invalida evidencia abierta previa
                evidenceRequest: versionNumber > 1 ? null : admissionOpsPrev.evidenceRequest ?? null,
              },
              // Nunca persistir coordenadas aquí; solo flag gpsPresent
            }
          : {
              ...prevMeta,
              admissionOps: {
                ...admissionOpsPrev,
                lastReasonCodes: admissionDecision?.reasonCodes ?? [],
                rulesVersion: ADMISSION_RULES_VERSION,
              },
            }) as Prisma.InputJsonValue,
        manualReviewStatus: needsManualReview
          ? "PENDING"
          : versionNumber > 1
            ? "NONE"
            : entry.manualReviewStatus,
      },
    });

    return { updated, versionNumber };
  });

  // Best-effort: borrar objetos R2/local previos tras replace (sin bloquear si falla).
  if (previousActiveAssets.length > 0) {
    for (const prev of previousActiveAssets) {
      try {
        await storage.deleteObject(prev.storageKey);
      } catch {
        // huérfano reportable por ops; no revertir la obra nueva
      }
    }
  }

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
    include: {
      contest: true,
      registration: { select: { id: true, rulesVersionId: true } },
    },
  });
  if (!entry || entry.contestId !== input.contestId) {
    throw new EntryError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  }
  if (entry.authorUserId !== input.participantUserId) {
    throw new EntryError("FORBIDDEN", "No autorizado.", 403);
  }
  if (entry.registration) {
    await assertCurrentRulesAccepted({
      contestId: input.contestId,
      registrationId: entry.registration.id,
      acceptedRulesVersionId: entry.registration.rulesVersionId,
    });
  }
  if (!assertUploadWindow(entry.contest, new Date())) {
    throw new EntryError("UPLOAD_WINDOW_CLOSED", "La ventana está cerrada.", 403);
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

  // Idempotencia: re-confirm sin cambios no reenvía email.
  if (entry.status === "CONFIRMED" && entry.confirmedAt) {
    return { entryNumber: entry.entryNumber!, status: entry.status };
  }

  let entryNumber = entry.entryNumber;
  if (!entryNumber) {
    const count = await prisma.fotorankContestEntry.count({
      where: { contestId: entry.contestId, entryNumber: { not: null } },
    });
    const prefix = entry.contest.slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "FR";
    entryNumber = `${prefix}-E-${String(count + 1).padStart(6, "0")}`;
  }

  // Confirmación del participante = archivo presentado; NO implica ADMITTED.
  const nextAdmission =
    entry.admissionStatus === "ADMITTED" || entry.admissionStatus === "FROZEN_FOR_JURY"
      ? entry.admissionStatus
      : entry.admissionStatus === "PENDING_MANUAL_REVIEW" || entry.status === "REQUIRES_REVIEW"
        ? "PENDING_MANUAL_REVIEW"
        : entry.admissionStatus ?? "ELIGIBLE";

  const updated = await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      entryNumber,
      admissionStatus: nextAdmission,
    },
  });

  void enqueueTransactionalEmail({
    kind: "PHOTO_RECEIVED",
    toUserId: input.participantUserId,
    contestId: entry.contestId,
    entryId: entry.id,
    registrationId: entry.registrationId ?? entry.registration?.id ?? undefined,
    payload: {
      contestTitle: entry.contest.title,
      entryNumber: updated.entryNumber,
      message: "Hemos recibido correctamente tu fotografía.",
    },
  }).catch(() => null);

  return { entryNumber: updated.entryNumber!, status: updated.status };
}

export async function getMyEntry(contestId: string, participantUserId: number) {
  const reg = await prisma.fotorankContestRegistration.findUnique({
    where: { contestId_participantUserId: { contestId, participantUserId } },
  });
  if (!reg) return null;
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { registrationId: reg.id },
    orderBy: { createdAt: "asc" },
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
      entries: {
        include: {
          checks: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return registrations.map((r) => {
    // Las columnas de obra describen la primera obra de la inscripción, que en
    // concursos de una sola obra es la única. `entriesCount` expone el resto.
    const entry = r.entries[0] ?? null;
    // Los contadores agregan los checks de TODAS las obras de la inscripción.
    const checks = r.entries.flatMap((e) => e.checks);
    return {
      registrationId: r.id,
      registrationNumber: r.registrationNumber,
      registrationStatus: r.status,
      participantName: r.participant.name,
      participantEmail: r.participant.email,
      categoryName: r.category.name,
      entryId: entry?.id ?? null,
      entryStatus: entry?.status ?? null,
      entryNumber: entry?.entryNumber ?? null,
      technicalSummaryStatus: entry?.technicalSummaryStatus ?? null,
      submittedAt: entry?.submittedAt ?? null,
      confirmedAt: entry?.confirmedAt ?? null,
      entriesCount: r.entries.length,
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
      admissionStatus: "WITHDRAWN",
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

  const admissionStatus =
    input.decision === "REJECTED"
      ? "REJECTED"
      : input.decision === "REPLACEMENT_REQUESTED"
        ? "PENDING_MANUAL_REVIEW"
        : input.decision === "APPROVED" || input.decision === "CLEARED_WARNING"
          ? entry.admissionStatus === "ADMITTED" || entry.admissionStatus === "FROZEN_FOR_JURY"
            ? entry.admissionStatus
            : "ELIGIBLE"
          : entry.admissionStatus;

  await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      manualReviewStatus: manualMap[input.decision],
      admissionStatus,
      status:
        input.decision === "REJECTED"
          ? "REJECTED"
          : input.decision === "APPROVED" || input.decision === "CLEARED_WARNING"
            ? entry.status === "REQUIRES_REVIEW"
              ? "READY_TO_CONFIRM"
              : entry.status
            : entry.status,
      publicRejectionReason:
        input.decision === "REJECTED" ? input.reason ?? "Rechazada en revisión manual." : entry.publicRejectionReason,
      internalRejectionReason:
        input.decision === "REJECTED" ? input.notes ?? input.reason ?? null : entry.internalRejectionReason,
    },
  });

  return review;
}
