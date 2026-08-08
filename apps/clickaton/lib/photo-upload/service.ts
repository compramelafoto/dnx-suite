import sharp from "sharp";
import { prisma } from "@/lib/admin/db";
import { systemClock, type EditionClock } from "@/lib/timeline/clock";
import { PhotoUploadError } from "./errors";
import { extractPhotoExif } from "./exif";
import {
  ensureFotorankEntryForPrompt,
  finalizeParticipantConfirmation,
} from "./fotorank-entry";
import {
  isCanonicalFotoRankAssetsEnabled,
  persistCanonicalAssetViaFotoRank,
} from "./fotorank-canonical-assets";
import { sha256Buffer, type DuplicateMatch } from "./hash";
import { detectImageMime, isAllowedMime } from "./mime";
import { getPrivateEntryStorage } from "./storage";

import {
  evaluateCaptureDate,
  evaluateGps,
  getUploadWindowState,
  isPromptReleasedForUpload,
  resolveEffectiveWindows,
} from "./windows";

function asStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  return ["image/jpeg", "image/png", "image/webp"];
}

function worst(
  ...results: Array<"PASS" | "WARNING" | "FAIL" | "MANUAL_REVIEW">
): "PASS" | "WARNING" | "FAIL" | "MANUAL_REVIEW" {
  if (results.includes("FAIL")) return "FAIL";
  if (results.includes("MANUAL_REVIEW")) return "MANUAL_REVIEW";
  if (results.includes("WARNING")) return "WARNING";
  return "PASS";
}

async function findDuplicate(input: {
  editionId: string;
  registrationId: string;
  promptId: string;
  sha256: string;
  submissionId: string;
}): Promise<DuplicateMatch> {
  const samePrompt = await prisma.clickatonPhotoSubmission.findFirst({
    where: {
      editionId: input.editionId,
      registrationId: input.registrationId,
      promptId: input.promptId,
      sha256: input.sha256,
      id: { not: input.submissionId },
      status: { notIn: ["WITHDRAWN", "FAILED"] },
    },
    select: { id: true },
  });
  if (samePrompt) {
    return { scope: "SAME_PROMPT", matchingSubmissionId: samePrompt.id };
  }

  const otherPrompt = await prisma.clickatonPhotoSubmission.findFirst({
    where: {
      editionId: input.editionId,
      registrationId: input.registrationId,
      promptId: { not: input.promptId },
      sha256: input.sha256,
      status: { notIn: ["WITHDRAWN", "FAILED"] },
    },
    select: { id: true },
  });
  if (otherPrompt) {
    return { scope: "OTHER_PROMPT_SAME_PARTICIPANT", matchingSubmissionId: otherPrompt.id };
  }

  const otherParticipant = await prisma.clickatonPhotoSubmission.findFirst({
    where: {
      editionId: input.editionId,
      registrationId: { not: input.registrationId },
      sha256: input.sha256,
      status: { notIn: ["WITHDRAWN", "FAILED"] },
    },
    select: { id: true },
  });
  if (otherParticipant) {
    return { scope: "OTHER_PARTICIPANT", matchingSubmissionId: otherParticipant.id };
  }
  return { scope: "NONE", matchingSubmissionId: null };
}

async function loadEligibleContext(input: {
  registrationId: string;
  promptId: string;
  userId: number;
  clock?: EditionClock;
}) {
  const clock = input.clock ?? systemClock();
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: input.registrationId },
    include: {
      edition: { include: { uploadConfig: true } },
    },
  });
  if (!registration) throw new PhotoUploadError("NOT_FOUND", "Inscripción no encontrada.", 404);
  if (registration.userId !== input.userId) {
    throw new PhotoUploadError("FORBIDDEN", "No podés cargar en esta inscripción.", 403);
  }
  if (
    registration.status !== "CONFIRMED" ||
    (registration.paymentStatus !== "APPROVED" && registration.paymentStatus !== "NOT_REQUIRED")
  ) {
    throw new PhotoUploadError("NOT_PAID", "La inscripción debe estar confirmada y pagada.", 403);
  }

  const config = registration.edition.uploadConfig;
  if (!config?.uploadsEnabled) {
    throw new PhotoUploadError("UPLOADS_DISABLED", "La carga de fotografías no está habilitada.", 403);
  }

  const prompt = await prisma.clickatonPrompt.findFirst({
    where: { id: input.promptId, editionId: registration.editionId },
  });
  if (!prompt) throw new PhotoUploadError("PROMPT_NOT_FOUND", "Consigna no encontrada.", 404);
  if (!isPromptReleasedForUpload(prompt.status)) {
    throw new PhotoUploadError("PROMPT_LOCKED", "La consigna aún no está liberada.", 403);
  }
  if (prompt.status === "CLOSED" && !prompt.allowReplacement) {
    throw new PhotoUploadError("PROMPT_CLOSED", "La consigna está cerrada.", 403);
  }

  const windows = resolveEffectiveWindows(prompt);
  const uploadState = getUploadWindowState(windows, clock);
  if (uploadState === "NOT_OPEN" || uploadState === "NOT_CONFIGURED") {
    throw new PhotoUploadError(
      "UPLOAD_WINDOW_NOT_OPEN",
      "La ventana de subida aún no está abierta.",
      403,
    );
  }
  if (uploadState === "CLOSED") {
    throw new PhotoUploadError(
      "UPLOAD_WINDOW_CLOSED",
      "Finalizó el período de entrega de fotografías.",
      403,
    );
  }

  if (!registration.edition.fotorankContestId) {
    throw new PhotoUploadError(
      "FOTORANK_NOT_LINKED",
      "La edición no tiene concurso FotoRank vinculado.",
      409,
    );
  }

  return { registration, prompt, config, windows, clock };
}

export async function requestPromptUpload(input: {
  registrationId: string;
  promptId: string;
  userId: number;
  isReplace?: boolean;
  clock?: EditionClock;
}) {
  const ctx = await loadEligibleContext(input);
  const existing = await prisma.clickatonPhotoSubmission.findUnique({
    where: {
      registrationId_promptId: {
        registrationId: input.registrationId,
        promptId: input.promptId,
      },
    },
  });

  if (existing?.status === "CONFIRMED" && !input.isReplace) {
    if (!ctx.prompt.allowReplacement) {
      throw new PhotoUploadError("REPLACE_NOT_ALLOWED", "Esta consigna no permite reemplazo.", 403);
    }
  }
  if (input.isReplace) {
    if (!ctx.prompt.allowReplacement) {
      throw new PhotoUploadError("REPLACE_NOT_ALLOWED", "Esta consigna no permite reemplazo.", 403);
    }
    if (ctx.prompt.replacementDeadline && ctx.prompt.replacementDeadline.getTime() < ctx.clock.now().getTime()) {
      throw new PhotoUploadError("REPLACE_DEADLINE", "Venció el plazo de reemplazo.", 403);
    }
  }

  const submission =
    existing ??
    (await prisma.clickatonPhotoSubmission.create({
      data: {
        editionId: ctx.registration.editionId,
        registrationId: input.registrationId,
        promptId: input.promptId,
        userId: input.userId,
        fotorankContestId: ctx.registration.edition.fotorankContestId,
        fotorankParticipantId: ctx.registration.fotoRankParticipantId,
        status: "UPLOAD_PENDING",
        captureWindowStartsAt: ctx.windows.captureStartsAt,
        captureWindowEndsAt: ctx.windows.captureEndsAt,
        uploadWindowStartsAt: ctx.windows.uploadStartsAt,
        uploadWindowEndsAt: ctx.windows.uploadEndsAt,
      },
    }));

  if (input.isReplace && existing) {
    await prisma.clickatonPhotoSubmission.update({
      where: { id: existing.id },
      data: {
        status: "UPLOAD_PENDING",
        replacedAt: new Date(),
        failureCode: null,
        failureMessage: null,
      },
    });
    await prisma.clickatonPhotoSubmissionAudit.create({
      data: {
        submissionId: existing.id,
        actorUserId: input.userId,
        action: "REPLACE_REQUESTED",
        payload: { previousStatus: existing.status },
      },
    });
  }

  return {
    submissionId: submission.id,
    uploadUrl: `/api/public/registrations/${input.registrationId}/prompts/${input.promptId}/upload`,
    maxFileSizeBytes: ctx.config.maxFileSizeBytes,
    allowedMimeTypes: asStringArray(ctx.config.allowedMimeTypes),
    windows: {
      captureStartsAt: ctx.windows.captureStartsAt?.toISOString() ?? null,
      captureEndsAt: ctx.windows.captureEndsAt?.toISOString() ?? null,
      uploadStartsAt: ctx.windows.uploadStartsAt?.toISOString() ?? null,
      uploadEndsAt: ctx.windows.uploadEndsAt?.toISOString() ?? null,
    },
    serverNow: ctx.clock.now().toISOString(),
  };
}

export async function processPromptUpload(input: {
  registrationId: string;
  promptId: string;
  userId: number;
  buffer: Buffer;
  originalFileName: string;
  declaredMime?: string;
  isReplace?: boolean;
  clock?: EditionClock;
}) {
  const intent = await requestPromptUpload(input);
  const ctx = await loadEligibleContext(input);
  const submission = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { id: intent.submissionId },
  });

  if (input.buffer.byteLength > ctx.config.maxFileSizeBytes) {
    throw new PhotoUploadError("FILE_TOO_LARGE", "El archivo supera el tamaño máximo.", 413);
  }

  const detected = detectImageMime(input.buffer, input.declaredMime);
  const allowed = asStringArray(ctx.config.allowedMimeTypes);
  if (!detected.valid || !isAllowedMime(detected.mime, allowed)) {
    throw new PhotoUploadError(
      "INVALID_MIME",
      "Formato no permitido. Usá JPEG, PNG o WEBP.",
      415,
    );
  }

  await prisma.clickatonPhotoSubmission.update({
    where: { id: submission.id },
    data: { status: "PROCESSING" },
  });

  const job = await prisma.clickatonPhotoSubmissionJob.create({
    data: {
      submissionId: submission.id,
      kind: "PROCESS_UPLOAD",
      status: "PROCESSING",
      attempts: 1,
      payload: { fileName: input.originalFileName.slice(0, 120) },
    },
  });

  try {
    const hash = sha256Buffer(input.buffer);
    const duplicate = await findDuplicate({
      editionId: ctx.registration.editionId,
      registrationId: input.registrationId,
      promptId: input.promptId,
      sha256: hash,
      submissionId: submission.id,
    });

    if (duplicate.scope === "SAME_PROMPT") {
      throw new PhotoUploadError("DUPLICATE_SAME_PROMPT", "Ya enviaste este archivo para esta consigna.", 409);
    }
    if (duplicate.scope === "OTHER_PROMPT_SAME_PARTICIPANT" && !ctx.config.allowCrossPromptDuplicate) {
      throw new PhotoUploadError(
        "DUPLICATE_OTHER_PROMPT",
        "Esta fotografía ya fue usada en otra consigna.",
        409,
      );
    }

    const exif = await extractPhotoExif(input.buffer);
    let width = 0;
    let height = 0;
    let decodable = false;
    let previewBuffer: Buffer | null = null;
    try {
      const meta = await sharp(input.buffer).rotate().metadata();
      width = meta.width ?? 0;
      height = meta.height ?? 0;
      decodable = width > 0 && height > 0;
      if (decodable) {
        previewBuffer = await sharp(input.buffer)
          .rotate()
          .resize({ width: 1280, height: 1280, fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 82 })
          .toBuffer();
      }
    } catch {
      decodable = false;
    }

    if (!decodable) {
      throw new PhotoUploadError("CORRUPT_IMAGE", "No pudimos leer la imagen.", 422);
    }
    if (width < ctx.config.minWidth || height < ctx.config.minHeight) {
      throw new PhotoUploadError("DIMENSIONS_TOO_SMALL", "Resolución insuficiente.", 422);
    }

    const tolerance =
      ctx.prompt.captureClockToleranceMinutes ?? ctx.config.captureClockToleranceMinutes;
    const captureEval = evaluateCaptureDate({
      captureDate: exif.captureDate,
      windows: ctx.windows,
      toleranceMinutes: tolerance,
      timezone: ctx.registration.edition.timezone ?? "America/Argentina/Cordoba",
    });
    const gpsEval = evaluateGps({
      mode: ctx.prompt.gpsMode,
      latitude: exif.gpsLatitude,
      longitude: exif.gpsLongitude,
    });

    let validation = worst(captureEval.result, gpsEval.result);
    if (duplicate.scope === "OTHER_PARTICIPANT") {
      if (ctx.config.blockCrossParticipantDuplicate) {
        throw new PhotoUploadError("DUPLICATE_OTHER_PARTICIPANT", "Archivo en revisión.", 409);
      }
      if (ctx.config.reviewCrossParticipantDuplicate) {
        validation = worst(validation, "MANUAL_REVIEW");
      }
    }

    const storage = getPrivateEntryStorage();
    const original = await storage.put({
      editionId: ctx.registration.editionId,
      submissionId: submission.id,
      kind: "original",
      extension: detected.extension,
      body: input.buffer,
      contentType: detected.mime,
    });
    let previewKey: string | null = null;
    if (previewBuffer) {
      const preview = await storage.put({
        editionId: ctx.registration.editionId,
        submissionId: submission.id,
        kind: "preview",
        extension: "jpg",
        body: previewBuffer,
        contentType: "image/jpeg",
      });
      previewKey = preview.key;
    }

    const { entryId } = await ensureFotorankEntryForPrompt({
      contestId: ctx.registration.edition.fotorankContestId!,
      authorUserId: input.userId,
      editionId: ctx.registration.editionId,
      registrationId: input.registrationId,
      promptId: input.promptId,
      fotorankParticipantId: ctx.registration.fotoRankParticipantId,
      clickatonParticipantNumber: ctx.registration.visibleCode,
      preferredCategoryId: ctx.prompt.categoryId,
      windows: ctx.windows,
    });

    // SoT de assets: FotoRank (flag). Dual-write: CK conserva key legado para rollback/lectura.
    let canonicalAsset: {
      activeAssetId: string;
      storageKey: string;
      versionNumber: number;
      idempotent: boolean;
    } | null = null;
    if (
      isCanonicalFotoRankAssetsEnabled({
        editionCanonicalAssetsEnabled: ctx.config.canonicalAssetsEnabled,
      })
    ) {
      canonicalAsset = await persistCanonicalAssetViaFotoRank({
        contestId: ctx.registration.edition.fotorankContestId!,
        entryId,
        buffer: input.buffer,
        originalFileName: input.originalFileName,
        declaredMime: detected.mime,
        isReplace: Boolean(submission.originalStorageKey),
        legacyStorageKey: original.key,
      });
    }

    await prisma.fotorankContestEntry.update({
      where: { id: entryId },
      data: {
        status: "PROCESSING",
        technicalSummaryJson: {
          sha256: hash,
          mime: detected.mime,
          width,
          height,
          exifStatus: exif.metadataStatus,
          gpsStatus: gpsEval.status,
          captureEval,
          source: "CLICKATON",
          originalStorageKey: original.key,
          assetOwner: canonicalAsset ? "FOTORANK" : "CLICKATON_LEGACY",
          canonicalAssetId: canonicalAsset?.activeAssetId ?? null,
          canonicalStorageKey: canonicalAsset?.storageKey ?? null,
          canonicalVersionNumber: canonicalAsset?.versionNumber ?? null,
        },
        captureWindowStartsAtSnapshot: ctx.windows.captureStartsAt,
        captureWindowEndsAtSnapshot: ctx.windows.captureEndsAt,
        uploadWindowStartsAtSnapshot: ctx.windows.uploadStartsAt,
        uploadWindowEndsAtSnapshot: ctx.windows.uploadEndsAt,
      },
    });

    const nextStatus =
      validation === "FAIL" ? "REJECTED" : "PENDING_CONFIRMATION";

    const updated = await prisma.clickatonPhotoSubmission.update({
      where: { id: submission.id },
      data: {
        status: nextStatus,
        validationResult: validation,
        sha256: hash,
        originalStorageKey: original.key,
        previewStorageKey: previewKey,
        fotorankEntryId: entryId,
        captureDateInterpreted: exif.captureDate,
        captureTimezoneAssumed: captureEval.assumedTimezone,
        captureDeltaMinutes: captureEval.deltaMinutes,
        gpsStatus: gpsEval.status,
        gpsLatitude: exif.gpsLatitude,
        gpsLongitude: exif.gpsLongitude,
        exifStatus: exif.metadataStatus,
        technicalSummaryJson: {
          mime: detected.mime,
          width,
          height,
          cameraMake: exif.cameraMake,
          cameraModel: exif.cameraModel,
          software: exif.software,
          captureEval,
          gpsEval,
          duplicate,
          privateOriginal: true,
        },
        failureCode: validation === "FAIL" ? captureEval.reason : null,
        failureMessage: validation === "FAIL" ? "Validación técnica fallida." : null,
      },
    });

    await prisma.clickatonPhotoSubmissionJob.update({
      where: { id: job.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    await prisma.clickatonPhotoSubmissionAudit.create({
      data: {
        submissionId: submission.id,
        actorUserId: input.userId,
        action: "PROCESSED",
        payload: { validation, sha256Prefix: hash.slice(0, 12), entryId },
      },
    });

    // No Social Publisher en carga.
    return {
      submissionId: updated.id,
      status: updated.status,
      validationResult: updated.validationResult,
      checklist: {
        fileReceived: true,
        width,
        height,
        captureDate: exif.captureDate?.toISOString() ?? null,
        camera: [exif.cameraMake, exif.cameraModel].filter(Boolean).join(" ") || null,
        gps: gpsEval.status,
        warnings: [
          captureEval.result !== "PASS" ? captureEval.reason : null,
          gpsEval.result !== "PASS" ? gpsEval.status : null,
          duplicate.scope !== "NONE" ? `DUPLICATE_${duplicate.scope}` : null,
        ].filter(Boolean),
      },
      serverNow: ctx.clock.now().toISOString(),
      fotorankEntryId: entryId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "PROCESSING_FAILED";
    const code = error instanceof PhotoUploadError ? error.code : "PROCESSING_FAILED";
    await prisma.clickatonPhotoSubmission.update({
      where: { id: submission.id },
      data: {
        status: "FAILED",
        failureCode: code,
        failureMessage: message.slice(0, 240),
      },
    });
    await prisma.clickatonPhotoSubmissionJob.update({
      where: { id: job.id },
      data: {
        status: code === "INVALID_MIME" || code === "CORRUPT_IMAGE" ? "FAILED" : "RETRY_PENDING",
        lastError: message.slice(0, 240),
        nextRetryAt: new Date(Date.now() + 60_000),
      },
    });
    throw error;
  }
}

export async function confirmPromptSubmission(input: {
  registrationId: string;
  promptId: string;
  userId: number;
  acceptDeclaration: boolean;
}) {
  if (!input.acceptDeclaration) {
    throw new PhotoUploadError("DECLARATION_REQUIRED", "Debés aceptar la declaración del reglamento.", 400);
  }
  const ctx = await loadEligibleContext(input);
  const submission = await prisma.clickatonPhotoSubmission.findUnique({
    where: {
      registrationId_promptId: {
        registrationId: input.registrationId,
        promptId: input.promptId,
      },
    },
  });
  if (!submission || submission.userId !== input.userId) {
    throw new PhotoUploadError("NOT_FOUND", "Envío no encontrado.", 404);
  }
  if (submission.status !== "PENDING_CONFIRMATION" && submission.status !== "READY_FOR_REVIEW") {
    throw new PhotoUploadError("NOT_CONFIRMABLE", "El envío no está listo para confirmar.", 409);
  }
  if (submission.validationResult === "FAIL") {
    throw new PhotoUploadError("VALIDATION_FAILED", "No se puede confirmar un envío rechazado.", 409);
  }
  if (!submission.fotorankEntryId) {
    throw new PhotoUploadError("ENTRY_MISSING", "Falta vínculo FotoRank.", 409);
  }

  const declaredAt = new Date();
  const version = ctx.config.rulesDeclarationVersion;

  await prisma.clickatonPhotoSubmission.update({
    where: { id: submission.id },
    data: {
      status: "CONFIRMED",
      confirmedAt: declaredAt,
      participantDeclarationAcceptedAt: declaredAt,
      participantDeclarationVersion: version,
    },
  });

  const tech =
    submission.validationResult === "MANUAL_REVIEW"
      ? "REQUIRES_REVIEW"
      : submission.validationResult === "WARNING"
        ? "APPROVED_WITH_WARNINGS"
        : "APPROVED";

  await finalizeParticipantConfirmation({
    entryId: submission.fotorankEntryId,
    technicalSummaryStatus: tech,
  });

  await prisma.fotorankContestEntry.update({
    where: { id: submission.fotorankEntryId },
    data: {
      participantDeclarationAcceptedAt: declaredAt,
      participantDeclarationVersion: version,
      // Snapshots inmutables al confirmar
      captureWindowStartsAtSnapshot: submission.captureWindowStartsAt,
      captureWindowEndsAtSnapshot: submission.captureWindowEndsAt,
      uploadWindowStartsAtSnapshot: submission.uploadWindowStartsAt,
      uploadWindowEndsAtSnapshot: submission.uploadWindowEndsAt,
    },
  });

  await prisma.clickatonPhotoSubmissionAudit.create({
    data: {
      submissionId: submission.id,
      actorUserId: input.userId,
      action: "CONFIRMED",
      payload: { declarationVersion: version, fotorankEntryId: submission.fotorankEntryId },
    },
  });

  return { submissionId: submission.id, status: "CONFIRMED" as const };
}

export async function listRegistrationPromptSubmissions(registrationId: string, userId: number) {
  const registration = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { userId: true, editionId: true },
  });
  if (!registration || registration.userId !== userId) {
    throw new PhotoUploadError("FORBIDDEN", "Sin acceso.", 403);
  }
  return prisma.clickatonPhotoSubmission.findMany({
    where: { registrationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      promptId: true,
      status: true,
      validationResult: true,
      confirmedAt: true,
      captureWindowStartsAt: true,
      captureWindowEndsAt: true,
      uploadWindowStartsAt: true,
      uploadWindowEndsAt: true,
      exifStatus: true,
      gpsStatus: true,
      technicalSummaryJson: true,
      fotorankEntryId: true,
    },
  });
}
