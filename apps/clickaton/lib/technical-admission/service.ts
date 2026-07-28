import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/admin/db";
import { hasEditionCapability } from "@/lib/timeline/permissions";
import { getEditionTemporalState } from "@/lib/timeline/prisma-timeline";
import { isWithinUploadWindow, resolveEffectiveWindows } from "@/lib/photo-upload/windows";
import { systemClock } from "@/lib/timeline/clock";
import { buildAnonymousJuryCode } from "./anonymity";
import { AdmissionError } from "./errors";
import {
  CAPABILITY_ADMIT_ENTRIES,
  CAPABILITY_CLOSE_BATCH,
  CAPABILITY_EXCLUDE_ENTRIES,
  CAPABILITY_REJECT_ENTRIES,
  CAPABILITY_REOPEN_BATCH,
  CAPABILITY_REVIEW_ADMISSION,
  CAPABILITY_VIEW_ADMISSION,
} from "./permissions";
import { evaluateTechnicalAdmission, publicReasonForStatus } from "./rules";
import {
  ADMISSION_ENGINE_VERSION,
  ADMISSION_RULES_DRAFT_VERSION,
  type AccreditationAdmissionPolicy,
  type AdmissionStatus,
  type ReasonCode,
} from "./types";

type Actor = { id: number; email: string; globalRole: string };

function newId() {
  return `a${randomBytes(12).toString("hex")}`;
}

async function requireCap(actor: Actor, editionId: string, capability: string) {
  const ok = await hasEditionCapability({
    userId: actor.id,
    email: actor.email,
    globalRole: actor.globalRole,
    editionId,
    capability,
  });
  if (!ok) throw new AdmissionError("FORBIDDEN", "Sin permiso para esta acción.", 403);
}

async function writeAudit(input: {
  editionId: string;
  submissionId?: string | null;
  fotorankEntryId?: string | null;
  admissionBatchId?: string | null;
  action: string;
  actorUserId?: number | null;
  previousValue?: unknown;
  nextValue?: unknown;
  reason?: string | null;
  metadata?: unknown;
}) {
  await prisma.clickatonAdmissionAudit.create({
    data: {
      editionId: input.editionId,
      submissionId: input.submissionId ?? null,
      fotorankEntryId: input.fotorankEntryId ?? null,
      admissionBatchId: input.admissionBatchId ?? null,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      previousValue: (input.previousValue as object) ?? undefined,
      nextValue: (input.nextValue as object) ?? undefined,
      reason: input.reason ?? null,
      metadata: (input.metadata as object) ?? undefined,
    },
  });
}

export async function ensureAdmissionConfig(editionId: string) {
  return prisma.clickatonEditionAdmissionConfig.upsert({
    where: { editionId },
    create: {
      editionId,
      admissionEnabled: false,
      accreditationRequiredForAdmission: "NOT_REQUIRED",
      rulesVersion: ADMISSION_RULES_DRAFT_VERSION,
      engineVersion: ADMISSION_ENGINE_VERSION,
      requireDeclaration: true,
      allowAppealOnReject: false,
    },
    update: {},
  });
}

async function loadSubmissionContext(submissionId: string) {
  return prisma.clickatonPhotoSubmission.findUnique({
    where: { id: submissionId },
    include: {
      registration: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          editionId: true,
          checkIns: {
            where: { reversedAt: null },
            take: 1,
            select: { id: true, exceptionReason: true },
          },
        },
      },
      prompt: {
        select: {
          id: true,
          status: true,
          sequence: true,
          gpsMode: true,
          captureStartsAt: true,
          captureEndsAt: true,
          uploadStartsAt: true,
          uploadEndsAt: true,
          releasedAt: true,
        },
      },
      edition: {
        select: {
          id: true,
          fotorankContestId: true,
          admissionConfig: true,
          uploadConfig: true,
        },
      },
    },
  });
}

export async function evaluateSubmission(input: {
  editionId: string;
  submissionId: string;
  actor: Actor;
  uploadExceptionApproved?: boolean;
  reason?: string | null;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_REVIEW_ADMISSION);
  const config = await ensureAdmissionConfig(input.editionId);
  const submission = await loadSubmissionContext(input.submissionId);
  if (!submission || submission.editionId !== input.editionId) {
    throw new AdmissionError("NOT_FOUND", "Envío no encontrado.", 404);
  }

  const temporal = await getEditionTemporalState(input.editionId);
  const clock = systemClock();
  const windows = resolveEffectiveWindows({
    status: submission.prompt.status,
    releasedAt: submission.prompt.releasedAt,
    captureStartsAt: submission.prompt.captureStartsAt,
    captureEndsAt: submission.prompt.captureEndsAt,
    uploadStartsAt: submission.prompt.uploadStartsAt,
    uploadEndsAt: submission.prompt.uploadEndsAt,
  });
  const uploadOk = isWithinUploadWindow(windows, clock);

  let entryStatus: string | null = null;
  if (submission.fotorankEntryId) {
    const entry = await prisma.fotorankContestEntry.findUnique({
      where: { id: submission.fotorankEntryId },
      select: { status: true },
    });
    entryStatus = entry?.status ?? null;
  }

  const tech = (submission.technicalSummaryJson ?? {}) as {
    duplicateBlocking?: boolean;
    duplicateReview?: boolean;
    mimeValid?: boolean;
  };

  const decision = evaluateTechnicalAdmission({
    submissionId: submission.id,
    submissionStatus: submission.status,
    paymentStatus: submission.registration.paymentStatus,
    registrationStatus: submission.registration.status,
    editionId: submission.editionId,
    expectedEditionId: input.editionId,
    fotorankContestId: submission.fotorankContestId,
    expectedContestId: submission.edition.fotorankContestId,
    fotorankEntryId: submission.fotorankEntryId,
    fotorankEntryStatus: entryStatus,
    originalStorageKey: submission.originalStorageKey,
    sha256: submission.sha256,
    validationResult: submission.validationResult,
    exifStatus: submission.exifStatus,
    gpsStatus: submission.gpsStatus,
    gpsMode: (submission.prompt.gpsMode ??
      submission.edition.uploadConfig?.defaultGpsMode ??
      "OPTIONAL") as "OPTIONAL" | "REQUIRED" | "NOT_REQUIRED" | "GEOFENCE",
    declarationAcceptedAt: submission.participantDeclarationAcceptedAt,
    requireDeclaration: config.requireDeclaration,
    promptStatus: submission.prompt.status,
    uploadWithinWindow: uploadOk,
    captureWithinWindow: null,
    captureFailOutsideWindow: false,
    uploadExceptionApproved: Boolean(input.uploadExceptionApproved),
    duplicateBlocking: Boolean(tech.duplicateBlocking),
    duplicateReview: Boolean(tech.duplicateReview),
    accreditationPolicy:
      config.accreditationRequiredForAdmission as AccreditationAdmissionPolicy,
    isCheckedIn: submission.registration.checkIns.length > 0,
    accreditationException: Boolean(submission.registration.checkIns[0]?.exceptionReason),
    processingComplete: ["CONFIRMED", "REJECTED", "WITHDRAWN", "REPLACED"].includes(
      submission.status,
    ) || Boolean(submission.sha256 && submission.originalStorageKey),
    mimeValid: tech.mimeValid !== false,
    timelineVersion: temporal.timelineVersion,
    rulesVersion: config.rulesVersion,
    evaluatorVersion: config.engineVersion,
  });

  const previous = await prisma.clickatonTechnicalAdmissionDecision.findFirst({
    where: { submissionId: submission.id },
    orderBy: { evaluatedAt: "desc" },
  });

  const row = await prisma.clickatonTechnicalAdmissionDecision.create({
    data: {
      id: newId(),
      editionId: input.editionId,
      submissionId: submission.id,
      fotorankEntryId: submission.fotorankEntryId,
      eligible: decision.eligible,
      status: decision.status,
      blockingReasons: decision.blockingReasons,
      warningReasons: decision.warningReasons,
      manualReviewReasons: decision.manualReviewReasons,
      evaluatedAt: new Date(decision.evaluatedAt),
      evaluatorVersion: decision.evaluatorVersion,
      timelineVersion: decision.timelineVersion,
      rulesVersion: decision.rulesVersion,
      sourceSubmissionId: submission.id,
      sourceEntryId: submission.fotorankEntryId,
      actorUserId: input.actor.id,
      reason: input.reason ?? null,
      publicRejectionReason:
        decision.status === "REJECTED"
          ? publicReasonForStatus(decision.status, decision.blockingReasons)
          : null,
      internalRejectionReason:
        decision.blockingReasons.length > 0 ? decision.blockingReasons.join(",") : null,
      previousDecisionId: previous?.id ?? null,
      metadata: {
        warnings: decision.warningReasons,
        manual: decision.manualReviewReasons,
      },
    },
  });

  if (submission.fotorankEntryId) {
    await prisma.fotorankContestEntry.update({
      where: { id: submission.fotorankEntryId },
      data: {
        admissionStatus: decision.status,
        publicRejectionReason: row.publicRejectionReason,
        internalRejectionReason: row.internalRejectionReason,
        appealAllowed: config.allowAppealOnReject && decision.status === "REJECTED",
      },
    });
  }

  await writeAudit({
    editionId: input.editionId,
    submissionId: submission.id,
    fotorankEntryId: submission.fotorankEntryId,
    action: previous ? "REEVALUATED" : "EVALUATED",
    actorUserId: input.actor.id,
    previousValue: previous
      ? { status: previous.status, blockingReasons: previous.blockingReasons }
      : null,
    nextValue: {
      status: decision.status,
      blockingReasons: decision.blockingReasons,
      decisionId: row.id,
    },
    reason: input.reason,
  });

  return { decision, decisionId: row.id };
}

export async function admitSubmission(input: {
  editionId: string;
  submissionId: string;
  actor: Actor;
  batchId?: string | null;
  reason?: string | null;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_ADMIT_ENTRIES);
  const { decision, decisionId } = await evaluateSubmission({
    editionId: input.editionId,
    submissionId: input.submissionId,
    actor: input.actor,
    reason: input.reason,
  });
  if (!decision.eligible && decision.status !== "PENDING_MANUAL_REVIEW") {
    throw new AdmissionError(
      "NOT_ELIGIBLE",
      "La obra no es elegible para admisión automática.",
      409,
    );
  }
  if (decision.status === "PENDING_MANUAL_REVIEW") {
    throw new AdmissionError(
      "MANUAL_REVIEW_REQUIRED",
      "Resolvé la revisión manual antes de admitir.",
      409,
    );
  }

  const submission = await prisma.clickatonPhotoSubmission.findUniqueOrThrow({
    where: { id: input.submissionId },
  });
  if (!submission.fotorankEntryId) {
    throw new AdmissionError("ENTRY_MISSING", "Sin entry FotoRank.", 409);
  }

  await prisma.clickatonTechnicalAdmissionDecision.create({
    data: {
      id: newId(),
      editionId: input.editionId,
      submissionId: submission.id,
      fotorankEntryId: submission.fotorankEntryId,
      admissionBatchId: input.batchId ?? null,
      eligible: true,
      status: "ADMITTED",
      blockingReasons: [],
      warningReasons: decision.warningReasons,
      manualReviewReasons: [],
      evaluatorVersion: ADMISSION_ENGINE_VERSION,
      timelineVersion: decision.timelineVersion,
      rulesVersion: decision.rulesVersion,
      sourceSubmissionId: submission.id,
      sourceEntryId: submission.fotorankEntryId,
      actorUserId: input.actor.id,
      reason: input.reason ?? "ADMIT",
      previousDecisionId: decisionId,
    },
  });

  await prisma.fotorankContestEntry.update({
    where: { id: submission.fotorankEntryId },
    data: {
      admissionStatus: "ADMITTED",
      admissionBatchId: input.batchId ?? undefined,
      status: "CONFIRMED",
      confirmedAt: new Date(),
    },
  });

  await writeAudit({
    editionId: input.editionId,
    submissionId: submission.id,
    fotorankEntryId: submission.fotorankEntryId,
    admissionBatchId: input.batchId,
    action: "ADMITTED",
    actorUserId: input.actor.id,
    reason: input.reason,
  });

  await enqueueNotificationIntent(input.editionId, submission.id, "WORK_ADMITTED");
  return { status: "ADMITTED" as const };
}

export async function rejectSubmission(input: {
  editionId: string;
  submissionId: string;
  actor: Actor;
  publicReason: string;
  internalReason: string;
  exclude?: boolean;
}) {
  const capability = input.exclude ? CAPABILITY_EXCLUDE_ENTRIES : CAPABILITY_REJECT_ENTRIES;
  await requireCap(input.actor, input.editionId, capability);
  if (!input.publicReason.trim()) {
    throw new AdmissionError("REASON_REQUIRED", "Motivo público obligatorio.", 400);
  }

  const submission = await prisma.clickatonPhotoSubmission.findFirst({
    where: { id: input.submissionId, editionId: input.editionId },
  });
  if (!submission) throw new AdmissionError("NOT_FOUND", "Envío no encontrado.", 404);

  const status: AdmissionStatus = input.exclude ? "EXCLUDED" : "REJECTED";
  await prisma.clickatonTechnicalAdmissionDecision.create({
    data: {
      id: newId(),
      editionId: input.editionId,
      submissionId: submission.id,
      fotorankEntryId: submission.fotorankEntryId,
      eligible: false,
      status,
      blockingReasons: [input.exclude ? "ADMIN_EXCEPTION" : "EXIF_FAIL"],
      warningReasons: [],
      manualReviewReasons: [],
      evaluatorVersion: ADMISSION_ENGINE_VERSION,
      rulesVersion: ADMISSION_RULES_DRAFT_VERSION,
      sourceSubmissionId: submission.id,
      sourceEntryId: submission.fotorankEntryId,
      actorUserId: input.actor.id,
      publicRejectionReason: input.publicReason.slice(0, 280),
      internalRejectionReason: input.internalReason.slice(0, 500),
      reason: input.exclude ? "EXCLUDE" : "REJECT",
    },
  });

  if (submission.fotorankEntryId) {
    await prisma.fotorankContestEntry.update({
      where: { id: submission.fotorankEntryId },
      data: {
        admissionStatus: status,
        status: "REJECTED",
        publicRejectionReason: input.publicReason.slice(0, 280),
        internalRejectionReason: input.internalReason.slice(0, 500),
      },
    });
  }
  await prisma.clickatonPhotoSubmission.update({
    where: { id: submission.id },
    data: {
      status: "REJECTED",
      failureMessage: input.publicReason.slice(0, 280),
    },
  });

  await writeAudit({
    editionId: input.editionId,
    submissionId: submission.id,
    fotorankEntryId: submission.fotorankEntryId,
    action: input.exclude ? "EXCLUDED" : "REJECTED",
    actorUserId: input.actor.id,
    reason: input.publicReason,
    metadata: { internalReason: input.internalReason },
  });
  await enqueueNotificationIntent(input.editionId, submission.id, "WORK_REJECTED");
  return { status };
}

export async function resolveManualReview(input: {
  editionId: string;
  submissionId: string;
  actor: Actor;
  decision: "ADMIT" | "REJECT" | "KEEP_REVIEW";
  notes: string;
  publicReason?: string;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_REVIEW_ADMISSION);
  if (input.decision === "ADMIT") {
    return admitSubmission({
      editionId: input.editionId,
      submissionId: input.submissionId,
      actor: input.actor,
      reason: input.notes || "manual-admit",
    });
  }
  if (input.decision === "REJECT") {
    return rejectSubmission({
      editionId: input.editionId,
      submissionId: input.submissionId,
      actor: input.actor,
      publicReason: input.publicReason || "No cumple requisitos técnicos.",
      internalReason: input.notes,
    });
  }
  await writeAudit({
    editionId: input.editionId,
    submissionId: input.submissionId,
    action: "MANUAL_REVIEW_NOTE",
    actorUserId: input.actor.id,
    reason: input.notes,
  });
  return { status: "PENDING_MANUAL_REVIEW" as const };
}

export async function getOrCreateDraftBatch(input: {
  editionId: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_VIEW_ADMISSION);
  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: input.editionId },
    select: { fotorankContestId: true },
  });
  if (!edition.fotorankContestId) {
    throw new AdmissionError("CONTEST_MISSING", "Edición sin concurso FotoRank.", 409);
  }
  const config = await ensureAdmissionConfig(input.editionId);
  const temporal = await getEditionTemporalState(input.editionId);

  const existing = await prisma.fotorankAdmissionBatch.findFirst({
    where: {
      contestId: edition.fotorankContestId,
      editionId: input.editionId,
      status: { in: ["DRAFT", "PROCESSING", "REVIEW_REQUIRED", "READY_TO_CLOSE"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.fotorankAdmissionBatch.create({
    data: {
      id: newId(),
      contestId: edition.fotorankContestId,
      editionId: input.editionId,
      timelineVersion: temporal.timelineVersion,
      rulesVersion: config.rulesVersion,
      engineVersion: config.engineVersion,
      status: "DRAFT",
      createdByUserId: input.actor.id,
    },
  });
}

export async function ensureJuryAssetForEntry(input: {
  editionId: string;
  entryId: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_ADMIT_ENTRIES);
  const submission = await prisma.clickatonPhotoSubmission.findFirst({
    where: { editionId: input.editionId, fotorankEntryId: input.entryId },
  });
  if (!submission?.previewStorageKey && !submission?.originalStorageKey) {
    throw new AdmissionError("ASSET_MISSING", "Sin preview/original para jurado.", 409);
  }

  const entry = await prisma.fotorankContestEntry.findUniqueOrThrow({
    where: { id: input.entryId },
    select: { contestId: true, id: true },
  });

  const existing = await prisma.fotorankContestEntryAsset.findFirst({
    where: { entryId: entry.id, kind: "JURY_PREVIEW", isActive: true },
  });
  if (existing) {
    await writeAudit({
      editionId: input.editionId,
      fotorankEntryId: entry.id,
      action: "JURY_ASSET_REUSED",
      actorUserId: input.actor.id,
      metadata: { assetId: existing.id },
    });
    return existing;
  }

  const storageKey = submission.previewStorageKey ?? submission.originalStorageKey!;
  const shaJury = createHash("sha256")
    .update(`jury-preview:${storageKey}:${submission.sha256 ?? ""}`)
    .digest("hex");

  const asset = await prisma.fotorankContestEntryAsset.create({
    data: {
      id: newId(),
      contestId: entry.contestId,
      entryId: entry.id,
      versionNumber: 1,
      kind: "JURY_PREVIEW",
      storageProvider: "clickaton_private",
      storageKey,
      mimeType: "image/jpeg",
      originalFileName: null,
      sha256: shaJury,
      isActive: true,
      processedAt: new Date(),
      metadataJson: {
        source: "clickaton-admission",
        sha256Original: submission.sha256,
        strippedIdentity: true,
        strippedGps: true,
        processingVersion: "jury-preview-soft-v1",
      },
    },
  });

  await writeAudit({
    editionId: input.editionId,
    submissionId: submission.id,
    fotorankEntryId: entry.id,
    action: "JURY_ASSET_GENERATED",
    actorUserId: input.actor.id,
    nextValue: { assetId: asset.id, sha256Jury: shaJury },
  });
  return asset;
}

export async function freezeAdmittedEntries(input: {
  editionId: string;
  batchId: string;
  actor: Actor;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_CLOSE_BATCH);
  const batch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { id: input.batchId, editionId: input.editionId },
  });
  if (!batch) throw new AdmissionError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);
  if (batch.status === "FROZEN") {
    return { alreadyFrozen: true as const, batchId: batch.id };
  }
  if (batch.status !== "CLOSED" && batch.status !== "READY_TO_CLOSE") {
    throw new AdmissionError("BATCH_NOT_READY", "Cerrá el lote antes de congelar.", 409);
  }

  const admitted = await prisma.fotorankContestEntry.findMany({
    where: {
      contestId: batch.contestId,
      admissionBatchId: batch.id,
      admissionStatus: "ADMITTED",
      withdrawnAt: null,
    },
    include: {
      category: { select: { id: true, slug: true } },
    },
  });

  let frozen = 0;
  for (const entry of admitted) {
    const asset = await ensureJuryAssetForEntry({
      editionId: input.editionId,
      entryId: entry.id,
      actor: input.actor,
    });
    const anonymousCode =
      entry.anonymousJuryCode ??
      buildAnonymousJuryCode({
        contestId: entry.contestId,
        categoryId: entry.categoryId,
        entryId: entry.id,
        batchId: batch.id,
        categorySlug: entry.category.slug,
      });

    await prisma.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        admissionStatus: "FROZEN_FOR_JURY",
        anonymousJuryCode: anonymousCode,
        entryNumber: entry.entryNumber ?? anonymousCode,
        status: "CONFIRMED",
      },
    });

    await prisma.fotorankJuryEntrySnapshot.upsert({
      where: {
        admissionBatchId_entryId: {
          admissionBatchId: batch.id,
          entryId: entry.id,
        },
      },
      create: {
        id: newId(),
        contestId: entry.contestId,
        entryId: entry.id,
        admissionBatchId: batch.id,
        originalAssetId: entry.activeAssetId,
        juryAssetId: asset.id,
        sha256: asset.sha256,
        sha256Jury: asset.sha256,
        categoryId: entry.categoryId,
        promptExternalId: entry.externalPromptId,
        participantId: entry.externalParticipantId,
        anonymousCode,
        admittedAt: entry.confirmedAt,
        frozenAt: new Date(),
        metadataSnapshot: {
          noIdentity: true,
          technicalSummaryStatus: entry.technicalSummaryStatus,
        },
        validationSnapshot: entry.technicalSummaryJson ?? undefined,
        processingVersion: "jury-preview-soft-v1",
      },
      update: {
        juryAssetId: asset.id,
        sha256Jury: asset.sha256,
        frozenAt: new Date(),
      },
    });
    frozen += 1;
  }

  await prisma.fotorankAdmissionBatch.update({
    where: { id: batch.id },
    data: {
      status: "FROZEN",
      frozenAt: new Date(),
      frozenEntries: frozen,
    },
  });

  await writeAudit({
    editionId: input.editionId,
    admissionBatchId: batch.id,
    action: "BATCH_FROZEN",
    actorUserId: input.actor.id,
    nextValue: { frozen },
  });
  await enqueueNotificationIntent(input.editionId, null, "BATCH_CLOSED", { batchId: batch.id });
  return { alreadyFrozen: false as const, batchId: batch.id, frozen };
}

export async function closeAdmissionBatch(input: {
  editionId: string;
  batchId: string;
  actor: Actor;
  force?: boolean;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_CLOSE_BATCH);
  const batch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { id: input.batchId, editionId: input.editionId },
  });
  if (!batch) throw new AdmissionError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);

  const pending = await prisma.fotorankContestEntry.count({
    where: {
      contestId: batch.contestId,
      admissionBatchId: batch.id,
      admissionStatus: { in: ["PENDING_MANUAL_REVIEW", "PENDING_AUTOMATIC_REVIEW", "NOT_EVALUATED"] },
    },
  });
  if (pending > 0 && !input.force) {
    throw new AdmissionError(
      "PENDING_BLOCKING",
      `Hay ${pending} obras pendientes de revisión; no se puede cerrar.`,
      409,
    );
  }

  const counts = await recountBatch(batch.id, batch.contestId);
  await prisma.fotorankAdmissionBatch.update({
    where: { id: batch.id },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedByUserId: input.actor.id,
      ...counts,
    },
  });
  await writeAudit({
    editionId: input.editionId,
    admissionBatchId: batch.id,
    action: "BATCH_CLOSED",
    actorUserId: input.actor.id,
    nextValue: counts,
  });
  return { status: "CLOSED" as const, ...counts };
}

export async function reopenAdmissionBatch(input: {
  editionId: string;
  batchId: string;
  actor: Actor;
  reason: string;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_REOPEN_BATCH);
  if (!input.reason.trim()) {
    throw new AdmissionError("REASON_REQUIRED", "Motivo obligatorio para reabrir.", 400);
  }
  const batch = await prisma.fotorankAdmissionBatch.findFirst({
    where: { id: input.batchId, editionId: input.editionId },
  });
  if (!batch) throw new AdmissionError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);
  if (batch.status === "FROZEN") {
    throw new AdmissionError(
      "FROZEN",
      "Un lote congelado no se reabre silenciosamente; crear nueva versión.",
      409,
    );
  }
  await prisma.fotorankAdmissionBatch.update({
    where: { id: batch.id },
    data: { status: "DRAFT", closedAt: null, closedByUserId: null },
  });
  await writeAudit({
    editionId: input.editionId,
    admissionBatchId: batch.id,
    action: "BATCH_REOPENED",
    actorUserId: input.actor.id,
    reason: input.reason,
  });
  return { status: "DRAFT" as const };
}

async function recountBatch(batchId: string, contestId: string) {
  const grouped = await prisma.fotorankContestEntry.groupBy({
    by: ["admissionStatus"],
    where: { contestId, admissionBatchId: batchId },
    _count: { _all: true },
  });
  const map = Object.fromEntries(
    grouped.map((g) => [g.admissionStatus ?? "NULL", g._count._all]),
  ) as Record<string, number>;
  return {
    totalEntries: Object.values(map).reduce((a, b) => a + b, 0),
    eligibleEntries: map.ELIGIBLE ?? 0,
    admittedEntries: (map.ADMITTED ?? 0) + (map.FROZEN_FOR_JURY ?? 0),
    rejectedEntries: (map.REJECTED ?? 0) + (map.EXCLUDED ?? 0),
    pendingReviewEntries:
      (map.PENDING_MANUAL_REVIEW ?? 0) + (map.PENDING_AUTOMATIC_REVIEW ?? 0),
    frozenEntries: map.FROZEN_FOR_JURY ?? 0,
  };
}

export async function evaluatePendingBulk(input: {
  editionId: string;
  actor: Actor;
  requestId: string;
  limit?: number;
}) {
  await requireCap(input.actor, input.editionId, CAPABILITY_REVIEW_ADMISSION);
  const existingJob = await prisma.clickatonAdmissionJob.findUnique({
    where: { requestId: input.requestId },
  });
  if (existingJob?.status === "COMPLETED") {
    return { idempotent: true as const, jobId: existingJob.id, processed: 0 };
  }

  const job = existingJob
    ? existingJob
    : await prisma.clickatonAdmissionJob.create({
        data: {
          id: newId(),
          editionId: input.editionId,
          kind: "EVALUATE_PENDING",
          status: "PROCESSING",
          requestId: input.requestId,
          payload: { limit: input.limit ?? 100 },
        },
      });

  const batch = await getOrCreateDraftBatch({
    editionId: input.editionId,
    actor: input.actor,
  });

  const submissions = await prisma.clickatonPhotoSubmission.findMany({
    where: { editionId: input.editionId, status: "CONFIRMED" },
    take: input.limit ?? 100,
    orderBy: { confirmedAt: "asc" },
  });

  let processed = 0;
  for (const s of submissions) {
    const { decision } = await evaluateSubmission({
      editionId: input.editionId,
      submissionId: s.id,
      actor: input.actor,
    });
    if (s.fotorankEntryId) {
      await prisma.fotorankContestEntry.update({
        where: { id: s.fotorankEntryId },
        data: { admissionBatchId: batch.id },
      });
    }
    if (decision.eligible) {
      try {
        await admitSubmission({
          editionId: input.editionId,
          submissionId: s.id,
          actor: input.actor,
          batchId: batch.id,
          reason: "bulk-admit-eligible",
        });
      } catch {
        /* review required etc. */
      }
    }
    processed += 1;
  }

  const counts = await recountBatch(batch.id, batch.contestId);
  const status =
    counts.pendingReviewEntries > 0
      ? "REVIEW_REQUIRED"
      : counts.admittedEntries > 0
        ? "READY_TO_CLOSE"
        : "DRAFT";
  await prisma.fotorankAdmissionBatch.update({
    where: { id: batch.id },
    data: { status, ...counts },
  });

  await prisma.clickatonAdmissionJob.update({
    where: { id: job.id },
    data: { status: "COMPLETED", completedAt: new Date(), payload: { processed, batchId: batch.id } },
  });
  await writeAudit({
    editionId: input.editionId,
    admissionBatchId: batch.id,
    action: "BULK_EVALUATE",
    actorUserId: input.actor.id,
    nextValue: { processed, ...counts },
    metadata: { requestId: input.requestId },
  });
  return { idempotent: false as const, jobId: job.id, processed, batchId: batch.id, ...counts };
}

export async function getAdmissionDashboard(editionId: string, actor: Actor) {
  await requireCap(actor, editionId, CAPABILITY_VIEW_ADMISSION);
  const config = await ensureAdmissionConfig(editionId);
  const temporal = await getEditionTemporalState(editionId);

  const [
    total,
    confirmed,
    decisions,
    withoutEntry,
    batch,
  ] = await Promise.all([
    prisma.clickatonPhotoSubmission.count({ where: { editionId } }),
    prisma.clickatonPhotoSubmission.count({ where: { editionId, status: "CONFIRMED" } }),
    prisma.clickatonTechnicalAdmissionDecision.findMany({
      where: { editionId },
      distinct: ["submissionId"],
      orderBy: { evaluatedAt: "desc" },
      select: { status: true, submissionId: true },
    }),
    prisma.clickatonPhotoSubmission.count({
      where: { editionId, status: "CONFIRMED", fotorankEntryId: null },
    }),
    prisma.fotorankAdmissionBatch.findFirst({
      where: { editionId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const d of decisions) {
    byStatus[d.status] = (byStatus[d.status] ?? 0) + 1;
  }

  return {
    config,
    window: {
      timelineVersion: temporal.timelineVersion,
      serverNow: temporal.serverNow,
      canCheckIn: temporal.canCheckIn,
    },
    totals: {
      submissions: total,
      confirmed,
      withoutEntry,
      eligible: byStatus.ELIGIBLE ?? 0,
      admitted: (byStatus.ADMITTED ?? 0) + (byStatus.FROZEN_FOR_JURY ?? 0),
      pendingReview: byStatus.PENDING_MANUAL_REVIEW ?? 0,
      rejected: byStatus.REJECTED ?? 0,
      excluded: byStatus.EXCLUDED ?? 0,
      replaced: byStatus.REPLACED ?? 0,
      withdrawn: byStatus.WITHDRAWN ?? 0,
      frozen: byStatus.FROZEN_FOR_JURY ?? 0,
    },
    batch,
  };
}

export async function exportAdmissionCsv(editionId: string, actor: Actor, mode: "admin" | "jury") {
  await requireCap(actor, editionId, CAPABILITY_VIEW_ADMISSION);
  const edition = await prisma.clickatonEdition.findUniqueOrThrow({
    where: { id: editionId },
    select: { fotorankContestId: true },
  });
  if (!edition.fotorankContestId) return "empty\n";

  if (mode === "jury") {
    const snaps = await prisma.fotorankJuryEntrySnapshot.findMany({
      where: { contestId: edition.fotorankContestId, batch: { status: "FROZEN" } },
      include: { batch: { select: { id: true, status: true } } },
      orderBy: { anonymousCode: "asc" },
    });
    const header = ["codigo_anonimo", "categoria", "consigna", "jury_asset", "batch", "sha256"].join(",");
    const lines = snaps.map((s) =>
      [
        s.anonymousCode,
        s.categoryId,
        s.promptExternalId ?? "",
        s.juryAssetId ?? "",
        s.admissionBatchId,
        s.sha256Jury ?? s.sha256 ?? "",
      ].join(","),
    );
    return [header, ...lines].join("\n");
  }

  const rows = await prisma.clickatonPhotoSubmission.findMany({
    where: { editionId },
    include: {
      registration: { select: { visibleCode: true, firstName: true, lastName: true } },
      prompt: { select: { sequence: true, title: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const header = [
    "submission_id",
    "participante",
    "numero",
    "consigna",
    "estado_envio",
    "entry",
    "sha256",
    "exif",
    "gps",
  ].join(",");
  const lines = rows.map((r) =>
    [
      r.id,
      csv(`${r.registration.firstName} ${r.registration.lastName}`),
      r.registration.visibleCode ?? "",
      r.prompt.sequence,
      r.status,
      r.fotorankEntryId ?? "",
      r.sha256 ?? "",
      r.exifStatus ?? "",
      r.gpsStatus ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csv(v: string) {
  if (v.includes(",") || v.includes('"')) return `"${v.replaceAll('"', '""')}"`;
  return v;
}

async function enqueueNotificationIntent(
  editionId: string,
  submissionId: string | null,
  kind: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.clickatonAdmissionJob.create({
    data: {
      id: newId(),
      editionId,
      kind: `NOTIFY_${kind}`,
      status: "PENDING",
      requestId: `notify:${kind}:${submissionId ?? "batch"}:${Date.now()}`,
      payload: { submissionId, ...metadata, live: false },
    },
  });
}

/** Consumo futuro Etapa 14 — solo batch FROZEN + snapshots. */
export async function listFrozenJuryRoster(input: {
  contestId: string;
  batchId?: string;
}) {
  const batch = await prisma.fotorankAdmissionBatch.findFirst({
    where: {
      contestId: input.contestId,
      status: "FROZEN",
      ...(input.batchId ? { id: input.batchId } : {}),
    },
    orderBy: { frozenAt: "desc" },
  });
  if (!batch) return { batch: null, entries: [] as const };

  const snapshots = await prisma.fotorankJuryEntrySnapshot.findMany({
    where: { admissionBatchId: batch.id },
    orderBy: { anonymousCode: "asc" },
    select: {
      entryId: true,
      anonymousCode: true,
      categoryId: true,
      promptExternalId: true,
      juryAssetId: true,
      sha256Jury: true,
      frozenAt: true,
    },
  });
  return { batch, entries: snapshots };
}

export type { ReasonCode, AdmissionStatus };
