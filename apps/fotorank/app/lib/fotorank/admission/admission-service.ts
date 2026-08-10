import { randomBytes } from "node:crypto";
import { prisma, type Prisma } from "@repo/db";
import { redactArgraForLog } from "../eligibility/argra";
import type { ArgraVerificationStatus, RegistrationAnswers } from "../eligibility/types";
import { writeAdmissionAudit } from "./audit";
import {
  assertAnonymousPayloadClean,
  buildAnonymousJuryCode,
  buildAnonymousJuryPayload,
} from "./anonymity";
import { AdmissionError } from "./errors";
import {
  assertAdmissionReasonCode,
  publicMessageForReason,
  type AdmissionReasonCode,
} from "./reason-codes";
import { assertSelectionHashMatch, buildFreezeSelectionHash } from "./selection-hash";
import { toLogicalAdmissionState, toPublicParticipantAdmissionView } from "./state-mapping";
import {
  ADMISSION_ENGINE_VERSION,
  ADMISSION_RULES_VERSION,
  type AdmissionOpsMetadata,
  type AdmissionQueueFilter,
  type EvidenceRequestRecord,
  type EvidenceType,
} from "./types";
import { getContestEntryStorage } from "../storage/provider";

function newId(prefix = "adm") {
  return `${prefix}${randomBytes(10).toString("hex")}`;
}

async function requireContestOrganizer(contestId: string, userId: number) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: contestId },
    select: { id: true, organizationId: true, slug: true, status: true },
  });
  if (!contest) throw new AdmissionError("CONTEST_NOT_FOUND", "Concurso no encontrado.", 404);
  const member = await prisma.contestOrganizationMember.findFirst({
    where: {
      organizationId: contest.organizationId,
      userId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN", "EDITOR"] },
    },
  });
  if (!member) throw new AdmissionError("FORBIDDEN", "Sin permiso de admisión en este concurso.", 403);
  return contest;
}

function parseAdmissionOps(metadataJson: unknown): AdmissionOpsMetadata {
  if (!metadataJson || typeof metadataJson !== "object" || Array.isArray(metadataJson)) return {};
  const ops = (metadataJson as { admissionOps?: AdmissionOpsMetadata }).admissionOps;
  return ops && typeof ops === "object" ? ops : {};
}

function mergeAdmissionOps(
  metadataJson: unknown,
  patch: Partial<AdmissionOpsMetadata>,
): Prisma.InputJsonValue {
  const base =
    metadataJson && typeof metadataJson === "object" && !Array.isArray(metadataJson)
      ? { ...(metadataJson as Record<string, unknown>) }
      : {};
  const prev = parseAdmissionOps(metadataJson);
  base.admissionOps = { ...prev, ...patch };
  return base as Prisma.InputJsonValue;
}

function pushNotificationIntent(
  ops: AdmissionOpsMetadata,
  type: NonNullable<AdmissionOpsMetadata["notificationIntents"]>[number]["type"],
  entryId: string,
): AdmissionOpsMetadata {
  const intents = [...(ops.notificationIntents ?? [])];
  intents.push({ type, at: new Date().toISOString(), entryId });
  return { ...ops, notificationIntents: intents.slice(-40) };
}

export async function listAdmissionQueue(input: {
  contestId: string;
  organizerUserId: number;
  filter?: AdmissionQueueFilter;
  page?: number;
  pageSize?: number;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 25));
  const filter = input.filter ?? "all";

  const where: Prisma.FotorankContestEntryWhereInput = {
    contestId: input.contestId,
    withdrawnAt: null,
  };

  switch (filter) {
    case "requires_review":
      where.OR = [
        { admissionStatus: "PENDING_MANUAL_REVIEW" },
        { status: "REQUIRES_REVIEW" },
        { technicalSummaryStatus: "REQUIRES_REVIEW" },
        { manualReviewStatus: "PENDING" },
      ];
      break;
    case "ready_to_admit":
      where.admissionStatus = "ELIGIBLE";
      where.status = { in: ["READY_TO_CONFIRM", "CONFIRMED"] };
      where.manualReviewStatus = { in: ["NONE", "APPROVED", "CLEARED_WARNING"] };
      break;
    case "rejected":
      where.OR = [{ admissionStatus: "REJECTED" }, { status: "REJECTED" }];
      break;
    case "admitted":
      where.admissionStatus = "ADMITTED";
      break;
    case "frozen":
      where.admissionStatus = "FROZEN_FOR_JURY";
      break;
    case "replacement_pending":
      where.manualReviewStatus = "REPLACEMENT_REQUESTED";
      break;
    case "evidence_requested":
    case "date_observed":
    case "territory_observed":
    case "device_observed":
    case "argra_pending":
    case "drone_unidentified":
    case "possible_duplicate":
      // Filtros semánticos vía JSON / checks — post-filter en página ampliada
      where.OR = [
        { admissionStatus: "PENDING_MANUAL_REVIEW" },
        { technicalSummaryStatus: "REQUIRES_REVIEW" },
        { manualReviewStatus: "PENDING" },
      ];
      break;
    default:
      break;
  }

  const [total, rows] = await Promise.all([
    prisma.fotorankContestEntry.count({ where }),
    prisma.fotorankContestEntry.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        registration: {
          select: {
            id: true,
            registrationNumber: true,
            answersJson: true,
            participant: { select: { id: true, name: true, email: true } },
          },
        },
        checks: { select: { checkCode: true, status: true, title: true } },
        activeAsset: {
          select: {
            id: true,
            uploadedAt: true,
            exifMetadata: {
              select: {
                captureDate: true,
                cameraMake: true,
                cameraModel: true,
                metadataStatus: true,
                gpsLatitude: true,
              },
            },
          },
        },
        assets: {
          where: { isActive: true, kind: { in: ["THUMBNAIL", "JURY_PREVIEW"] } },
          select: { kind: true, storageKey: true },
          take: 2,
        },
      },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize * (filter === "all" || filter === "requires_review" || filter === "ready_to_admit" || filter === "rejected" || filter === "admitted" || filter === "frozen" || filter === "replacement_pending" ? 1 : 3),
    }),
  ]);

  const storage = getContestEntryStorage();
  const mappedRaw = await Promise.all(
    rows.map(async (e) => {
      const ops = parseAdmissionOps(e.metadataJson);
      const eligibility =
        e.metadataJson && typeof e.metadataJson === "object" && !Array.isArray(e.metadataJson)
          ? ((e.metadataJson as { eligibility?: Record<string, unknown> }).eligibility ?? {})
          : {};
      const answers = (e.registration?.answersJson ?? null) as RegistrationAnswers | null;
      const argraStatus = answers?.argraVerificationStatus ?? "NOT_REQUIRED";
      const checkCodes = new Set(e.checks.map((c) => c.checkCode));
      const reasonHints = [
        ...(Array.isArray(ops.lastReasonCodes) ? ops.lastReasonCodes : []),
        typeof eligibility.deviceReasonCode === "string" ? eligibility.deviceReasonCode : "",
      ].filter(Boolean);

      const logicalState = toLogicalAdmissionState({
        status: e.status,
        technicalSummaryStatus: e.technicalSummaryStatus,
        manualReviewStatus: e.manualReviewStatus,
        admissionStatus: e.admissionStatus,
        withdrawnAt: e.withdrawnAt,
        admissionOps: ops,
      });

      const thumb =
        e.assets.find((a) => a.kind === "THUMBNAIL") ??
        e.assets.find((a) => a.kind === "JURY_PREVIEW");
      let thumbnailUrl: string | null = null;
      if (thumb?.storageKey) {
        try {
          thumbnailUrl = await storage.getSignedUrl(thumb.storageKey, "read", 300);
        } catch {
          thumbnailUrl = null;
        }
      }

      const failCount = e.checks.filter((c) => c.status === "FAIL").length;
      const warnCount = e.checks.filter(
        (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
      ).length;
      const passCount = e.checks.filter((c) => c.status === "PASS").length;

      return {
        entryId: e.id,
        entryNumber: e.entryNumber,
        categoryName: e.category.name,
        categorySlug: e.category.slug,
        participantName: e.registration?.participant.name ?? null,
        participantEmail: e.registration?.participant.email ?? null,
        submittedAt: e.submittedAt?.toISOString() ?? null,
        technicalSummaryStatus: e.technicalSummaryStatus,
        manualReviewStatus: e.manualReviewStatus,
        admissionStatus: e.admissionStatus,
        logicalState,
        declaredDeviceKind: (eligibility.declaredDeviceKind as string) ?? null,
        detectedDevice:
          [e.activeAsset?.exifMetadata?.cameraMake, e.activeAsset?.exifMetadata?.cameraModel]
            .filter(Boolean)
            .join(" ") || null,
        captureDate: e.activeAsset?.exifMetadata?.captureDate?.toISOString() ?? null,
        captureWindowStatus: (eligibility.captureWindowStatus as string) ?? null,
        locality: (eligibility.captureLocality as string) ?? null,
        territoryStatus: (eligibility.territoryStatus as string) ?? null,
        gpsPresent: Boolean(
          eligibility.gpsPresent === true || e.activeAsset?.exifMetadata?.gpsLatitude != null,
        ),
        argraRedacted: redactArgraForLog(answers?.argraMembershipNumber ?? null),
        argraStatus,
        exifAvailable: e.activeAsset?.exifMetadata?.metadataStatus === "EXTRACTED" ||
          e.activeAsset?.exifMetadata?.metadataStatus === "PARTIAL",
        originalAvailable: Boolean(e.activeAssetId),
        reasonCodes: reasonHints,
        evidenceOpen: ops.evidenceRequest?.status === "OPEN",
        checkCodes: [...checkCodes],
        checkSummary: { passCount, warnCount, failCount },
        thumbnailUrl,
        // Nunca exponer storageKey en la cola
        priority: computeQueuePriority({
          logicalState,
          admissionStatus: e.admissionStatus,
          submittedAt: e.submittedAt,
          evidenceOpen: ops.evidenceRequest?.status === "OPEN",
          hasCritical: failCount > 0,
        }),
      };
    }),
  );

  const mapped = mappedRaw
    .filter((row) => matchesSemanticFilter(row, filter))
    .sort((a, b) => a.priority - b.priority || String(a.submittedAt).localeCompare(String(b.submittedAt)))
    .slice(0, pageSize);

  return {
    page,
    pageSize,
    total: filter === "all" ? total : mapped.length < pageSize && page === 1 ? mapped.length : total,
    filter,
    items: mapped,
  };
}

function computeQueuePriority(input: {
  logicalState: string;
  admissionStatus: string | null;
  submittedAt: Date | null;
  evidenceOpen: boolean;
  hasCritical: boolean;
}): number {
  if (input.hasCritical) return 1;
  if (input.logicalState === "MANUAL_REVIEW_REQUIRED" && input.submittedAt) {
    const ageH = (Date.now() - input.submittedAt.getTime()) / 3600000;
    if (ageH > 48) return 2;
  }
  if (input.evidenceOpen) return 3;
  if (input.admissionStatus === "ELIGIBLE") return 4;
  return 5;
}

function matchesSemanticFilter(
  row: {
    logicalState: string;
    captureWindowStatus: string | null;
    territoryStatus: string | null;
    declaredDeviceKind: string | null;
    argraStatus: string;
    categorySlug: string;
    detectedDevice: string | null;
    checkCodes: string[];
    evidenceOpen: boolean;
    reasonCodes: string[];
  },
  filter: AdmissionQueueFilter,
): boolean {
  switch (filter) {
    case "date_observed":
      return (
        Boolean(row.captureWindowStatus?.includes("REVIEW") || row.captureWindowStatus?.includes("OUTSIDE") || row.captureWindowStatus?.includes("MISSING")) ||
        row.reasonCodes.some((c) => c.startsWith("CAPTURE_"))
      );
    case "territory_observed":
      return (
        Boolean(row.territoryStatus?.includes("REVIEW") || row.territoryStatus?.includes("REJECTED")) ||
        row.reasonCodes.some((c) => c.includes("GPS") || c.includes("TERRITORY"))
      );
    case "device_observed":
      return (
        row.reasonCodes.some((c) => c.includes("DEVICE") || c.includes("PHONE") || c.includes("DRONE") || c.includes("AERIAL") || c.includes("PROFESSIONAL")) ||
        row.declaredDeviceKind === "UNKNOWN"
      );
    case "argra_pending":
      return row.argraStatus === "PENDING_VERIFICATION" || row.argraStatus === "EVIDENCE_REQUESTED";
    case "drone_unidentified":
      return (
        row.categorySlug === "fotografia-aerea" &&
        (row.reasonCodes.includes("AERIAL_DEVICE_NOT_IDENTIFIED") ||
          row.declaredDeviceKind === "DRONE" && !row.detectedDevice)
      );
    case "possible_duplicate":
      return row.checkCodes.includes("DUPLICATE") || row.reasonCodes.includes("DUPLICATE_FILE_SUSPECTED");
    case "evidence_requested":
      return row.evidenceOpen || row.logicalState === "EVIDENCE_REQUESTED";
    default:
      return true;
  }
}

export async function getAdmissionEntryDetail(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  revealArgra?: boolean;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
    include: {
      category: true,
      registration: { include: { participant: { select: { id: true, name: true, email: true } } } },
      checks: { orderBy: [{ checkGroup: "asc" }, { checkCode: "asc" }] },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        take: 20,
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      },
      activeAsset: { include: { exifMetadata: true } },
      assets: {
        where: { kind: { in: ["THUMBNAIL", "JURY_PREVIEW", "ORIGINAL"] }, isActive: true },
        select: { id: true, kind: true, versionNumber: true, originalFileName: true },
      },
    },
  });
  if (!entry) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);

  const ops = parseAdmissionOps(entry.metadataJson);
  const answers = (entry.registration?.answersJson ?? null) as RegistrationAnswers | null;
  const eligibility =
    entry.metadataJson && typeof entry.metadataJson === "object" && !Array.isArray(entry.metadataJson)
      ? ((entry.metadataJson as { eligibility?: Record<string, unknown> }).eligibility ?? null)
      : null;

  const exif = entry.activeAsset?.exifMetadata;
  const sanitizedExif = exif
    ? {
        cameraMake: exif.cameraMake,
        cameraModel: exif.cameraModel,
        lensModel: exif.lensModel,
        captureDate: exif.captureDate?.toISOString() ?? null,
        digitizedDate: exif.digitizedDate?.toISOString() ?? null,
        software: exif.software,
        iso: exif.iso,
        aperture: exif.aperture,
        shutterSpeed: exif.shutterSpeed,
        focalLength: exif.focalLength,
        metadataStatus: exif.metadataStatus,
        gpsPresent: typeof exif.gpsLatitude === "number" && typeof exif.gpsLongitude === "number",
        // Coordenadas exactas omitidas por defecto (privacidad)
      }
    : null;

  const logicalState = toLogicalAdmissionState({
    status: entry.status,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    manualReviewStatus: entry.manualReviewStatus,
    admissionStatus: entry.admissionStatus,
    withdrawnAt: entry.withdrawnAt,
    admissionOps: ops,
  });

  return {
    entryId: entry.id,
    entryNumber: entry.entryNumber,
    status: entry.status,
    technicalSummaryStatus: entry.technicalSummaryStatus,
    manualReviewStatus: entry.manualReviewStatus,
    admissionStatus: entry.admissionStatus,
    logicalState,
    category: { id: entry.category.id, name: entry.category.name, slug: entry.category.slug },
    participant: {
      name: entry.registration?.participant.name ?? null,
      email: entry.registration?.participant.email ?? null,
    },
    eligibility,
    argra: {
      redacted: redactArgraForLog(answers?.argraMembershipNumber ?? null),
      status: answers?.argraVerificationStatus ?? "NOT_REQUIRED",
      full:
        input.revealArgra === true
          ? answers?.argraMembershipNumber ?? null
          : null,
      legalFlags: ["PENDING_INSTITUTIONAL_APPROVAL", "LEGAL REVIEW REQUIRED"] as const,
    },
    sanitizedExif,
    checks: entry.checks,
    reviews: entry.reviews.map((r) => ({
      id: r.id,
      decision: r.decision,
      reason: r.reason,
      notes: r.notes,
      reviewedAt: r.reviewedAt.toISOString(),
      reviewerName: r.reviewer.name,
    })),
    admissionOps: ops,
    assets: entry.assets,
    publicView: toPublicParticipantAdmissionView({
      status: entry.status,
      technicalSummaryStatus: entry.technicalSummaryStatus,
      manualReviewStatus: entry.manualReviewStatus,
      admissionStatus: entry.admissionStatus,
      withdrawnAt: entry.withdrawnAt,
      admissionOps: ops,
    }),
    privacyWarning:
      "GPS exacto y ARGRA completo están restringidos. No registrar en analytics ni logs.",
  };
}

export async function admitEntry(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  reasonCode?: string;
  notes?: string;
  requestId?: string;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const reasonCode = assertAdmissionReasonCode(input.reasonCode ?? "ADMISSION_APPROVED");
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
    include: { registration: true, category: true },
  });
  if (!entry) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);

  if (entry.admissionStatus === "ADMITTED" || entry.admissionStatus === "FROZEN_FOR_JURY") {
    return { idempotent: true as const, admissionStatus: entry.admissionStatus };
  }
  if (entry.status === "REJECTED" || entry.admissionStatus === "REJECTED") {
    throw new AdmissionError("INVALID_TRANSITION", "No se puede admitir una obra rechazada.", 409);
  }
  if (
    entry.admissionStatus === "PENDING_MANUAL_REVIEW" &&
    entry.manualReviewStatus === "PENDING" &&
    !input.notes
  ) {
    // permitir admitir cerrando revisión si reason válido
  }

  const answers = (entry.registration?.answersJson ?? null) as RegistrationAnswers | null;
  if (
    entry.category.slug === "reportero-grafico" &&
    answers?.argraVerificationStatus !== "VERIFIED" &&
    answers?.argraVerificationStatus !== "NOT_REQUIRED"
  ) {
    throw new AdmissionError(
      "ARGRA_PENDING",
      "ARGRA debe estar VERIFIED antes de admitir Reportero Gráfico.",
      409,
    );
  }
  if (entry.manualReviewStatus === "REPLACEMENT_REQUESTED") {
    throw new AdmissionError(
      "REPLACEMENT_PENDING",
      "Hay un reemplazo pendiente; resolvelo antes de admitir.",
      409,
    );
  }
  const ops = parseAdmissionOps(entry.metadataJson);
  if (ops.evidenceRequest?.status === "OPEN") {
    throw new AdmissionError("EVIDENCE_OPEN", "Hay evidencia solicitada sin resolver.", 409);
  }

  const prev = entry.admissionStatus;
  const nextOps = pushNotificationIntent(
    {
      ...ops,
      lastReasonCodes: [reasonCode],
      rulesVersion: ADMISSION_RULES_VERSION,
    },
    "ADMITTED",
    entry.id,
  );

  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestEntryReview.create({
      data: {
        entryId: entry.id,
        reviewerUserId: input.organizerUserId,
        decision: "APPROVED",
        reason: reasonCode,
        notes: input.notes ?? publicMessageForReason(reasonCode),
      },
    });
    await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        admissionStatus: "ADMITTED",
        status: entry.status === "READY_TO_CONFIRM" || entry.status === "REQUIRES_REVIEW" ? "CONFIRMED" : entry.status,
        confirmedAt: entry.confirmedAt ?? new Date(),
        manualReviewStatus: "APPROVED",
        metadataJson: mergeAdmissionOps(entry.metadataJson, nextOps),
      },
    });
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: entry.id,
    action: "ADMIT",
    previousStatus: prev,
    nextStatus: "ADMITTED",
    reasonCode,
    note: input.notes,
    requestId: input.requestId,
  });

  return { idempotent: false as const, admissionStatus: "ADMITTED" as const, reasonCode };
}

export async function rejectEntry(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  reasonCode: string;
  publicMessage?: string;
  internalNote?: string;
  allowAppeal?: boolean;
  allowReplacement?: boolean;
  requestId?: string;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  if (!input.reasonCode?.trim()) {
    throw new AdmissionError("REASON_REQUIRED", "El rechazo requiere reason code.", 400);
  }
  const reasonCode = assertAdmissionReasonCode(input.reasonCode);
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
  });
  if (!entry) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  if (entry.admissionStatus === "FROZEN_FOR_JURY") {
    throw new AdmissionError("FROZEN", "No se puede rechazar una obra congelada sin acción extraordinaria.", 409);
  }
  if (entry.admissionStatus === "REJECTED" && entry.status === "REJECTED") {
    return { idempotent: true as const, admissionStatus: "REJECTED" as const };
  }

  const publicMessage = input.publicMessage?.trim() || publicMessageForReason(reasonCode);
  const ops = pushNotificationIntent(
    {
      ...parseAdmissionOps(entry.metadataJson),
      lastReasonCodes: [reasonCode],
    },
    "REJECTED",
    entry.id,
  );

  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestEntryReview.create({
      data: {
        entryId: entry.id,
        reviewerUserId: input.organizerUserId,
        decision: "REJECTED",
        reason: reasonCode,
        notes: input.internalNote ?? null,
      },
    });
    await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        status: "REJECTED",
        admissionStatus: "REJECTED",
        manualReviewStatus: input.allowReplacement ? "REPLACEMENT_REQUESTED" : "REJECTED",
        appealAllowed: Boolean(input.allowAppeal),
        publicRejectionReason: publicMessage,
        internalRejectionReason: input.internalNote ?? reasonCode,
        metadataJson: mergeAdmissionOps(entry.metadataJson, ops),
      },
    });
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: entry.id,
    action: "REJECT",
    previousStatus: entry.admissionStatus,
    nextStatus: "REJECTED",
    reasonCode,
    note: input.internalNote,
    requestId: input.requestId,
  });

  return { idempotent: false as const, admissionStatus: "REJECTED" as const, publicMessage, reasonCode };
}

export async function requestEvidence(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  types: EvidenceType[];
  reasonCode: string;
  publicMessage?: string;
  internalNote?: string;
  deadlineAt?: string | null;
  requestId?: string;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const reasonCode = assertAdmissionReasonCode(input.reasonCode);
  if (!input.types?.length) {
    throw new AdmissionError("EVIDENCE_TYPE_REQUIRED", "Indicá al menos un tipo de evidencia.", 400);
  }
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
  });
  if (!entry) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  if (entry.admissionStatus === "FROZEN_FOR_JURY") {
    throw new AdmissionError("FROZEN", "Obra congelada.", 409);
  }

  const ops = parseAdmissionOps(entry.metadataJson);
  if (ops.evidenceRequest?.status === "OPEN" && ops.evidenceRequest.id) {
    return { idempotent: true as const, evidenceRequest: ops.evidenceRequest };
  }

  const evidence: EvidenceRequestRecord = {
    id: newId("ev"),
    types: input.types,
    reasonCode,
    publicMessage: input.publicMessage?.trim() || publicMessageForReason(reasonCode),
    internalNote: input.internalNote ?? null,
    requestedAt: new Date().toISOString(),
    deadlineAt: input.deadlineAt ?? null,
    status: "OPEN",
    requestedByUserId: input.organizerUserId,
  };
  const next = pushNotificationIntent(
    { ...ops, evidenceRequest: evidence, lastReasonCodes: [reasonCode, "EVIDENCE_REQUESTED"] },
    "EVIDENCE_REQUESTED",
    entry.id,
  );

  await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      admissionStatus: "PENDING_MANUAL_REVIEW",
      status: "REQUIRES_REVIEW",
      technicalSummaryStatus: "REQUIRES_REVIEW",
      manualReviewStatus: "PENDING",
      metadataJson: mergeAdmissionOps(entry.metadataJson, next),
    },
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: entry.id,
    action: "REQUEST_EVIDENCE",
    previousStatus: entry.admissionStatus,
    nextStatus: "PENDING_MANUAL_REVIEW",
    reasonCode,
    note: input.internalNote,
    requestId: input.requestId,
    metadata: { evidenceTypes: input.types },
  });

  return { idempotent: false as const, evidenceRequest: evidence };
}

export async function allowReplacement(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  reasonCode?: string;
  publicMessage?: string;
  internalNote?: string;
  deadlineAt?: string | null;
  requestId?: string;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const reasonCode = assertAdmissionReasonCode(input.reasonCode ?? "REPLACEMENT_ALLOWED");
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
  });
  if (!entry) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);
  if (entry.admissionStatus === "FROZEN_FOR_JURY") {
    throw new AdmissionError("FROZEN", "No hay reemplazo después del freeze.", 409);
  }
  if (entry.manualReviewStatus === "REPLACEMENT_REQUESTED") {
    return { idempotent: true as const, manualReviewStatus: "REPLACEMENT_REQUESTED" as const };
  }

  const ops = pushNotificationIntent(
    {
      ...parseAdmissionOps(entry.metadataJson),
      lastReasonCodes: [reasonCode],
    },
    "REPLACEMENT_ALLOWED",
    entry.id,
  );

  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestEntryReview.create({
      data: {
        entryId: entry.id,
        reviewerUserId: input.organizerUserId,
        decision: "REPLACEMENT_REQUESTED",
        reason: reasonCode,
        notes: input.internalNote ?? input.publicMessage ?? null,
      },
    });
    await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        manualReviewStatus: "REPLACEMENT_REQUESTED",
        admissionStatus: "PENDING_MANUAL_REVIEW",
        status: entry.status === "REJECTED" ? "REQUIRES_REVIEW" : entry.status,
        metadataJson: mergeAdmissionOps(entry.metadataJson, {
          ...ops,
          evidenceRequest: ops.evidenceRequest
            ? { ...ops.evidenceRequest, deadlineAt: input.deadlineAt ?? ops.evidenceRequest.deadlineAt }
            : ops.evidenceRequest,
        }),
      },
    });
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: entry.id,
    action: "ALLOW_REPLACEMENT",
    previousStatus: entry.admissionStatus,
    nextStatus: "PENDING_MANUAL_REVIEW",
    reasonCode,
    note: input.internalNote,
    requestId: input.requestId,
  });

  return { idempotent: false as const, manualReviewStatus: "REPLACEMENT_REQUESTED" as const };
}

export async function verifyArgra(input: {
  contestId: string;
  entryId: string;
  organizerUserId: number;
  status: ArgraVerificationStatus;
  internalNote?: string;
  requestId?: string;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const allowed: ArgraVerificationStatus[] = [
    "VERIFIED",
    "REJECTED",
    "PENDING_VERIFICATION",
    "EVIDENCE_REQUESTED",
    "NOT_REQUIRED",
  ];
  if (!allowed.includes(input.status)) {
    throw new AdmissionError("INVALID_ARGRA_STATUS", "Estado ARGRA inválido.", 400);
  }

  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
    include: { registration: true, category: true },
  });
  if (!entry?.registration) throw new AdmissionError("ENTRY_NOT_FOUND", "Obra no encontrada.", 404);

  const prev = (entry.registration.answersJson ?? {}) as RegistrationAnswers;
  const nextAnswers: RegistrationAnswers = {
    ...prev,
    argraVerificationStatus: input.status,
  };

  const ops = parseAdmissionOps(entry.metadataJson);
  await prisma.$transaction(async (tx) => {
    await tx.fotorankContestRegistration.update({
      where: { id: entry.registration!.id },
      data: { answersJson: nextAnswers as Prisma.InputJsonValue },
    });
    await tx.fotorankContestEntry.update({
      where: { id: entry.id },
      data: {
        metadataJson: mergeAdmissionOps(entry.metadataJson, {
          ...ops,
          argraAdminNote: input.internalNote ?? ops.argraAdminNote ?? null,
          lastReasonCodes: [
            input.status === "VERIFIED"
              ? "ADMISSION_APPROVED"
              : input.status === "REJECTED"
                ? "ARGRA_VERIFICATION_REJECTED"
                : "ARGRA_VERIFICATION_PENDING",
          ],
        }),
      },
    });
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: entry.id,
    action: "ARGRA_VERIFY",
    previousStatus: prev.argraVerificationStatus,
    nextStatus: input.status,
    reasonCode:
      input.status === "VERIFIED" ? "ARGRA_VERIFICATION_PENDING" : "ARGRA_VERIFICATION_REJECTED",
    note: input.internalNote,
    requestId: input.requestId,
    metadata: { argraStatus: input.status, legal: "PENDING_INSTITUTIONAL_APPROVAL" },
  });

  return {
    argraStatus: input.status,
    argraRedacted: redactArgraForLog(prev.argraMembershipNumber ?? null),
    legalFlags: ["PENDING_INSTITUTIONAL_APPROVAL", "LEGAL REVIEW REQUIRED"],
  };
}

export async function getOrCreateAdmissionBatch(input: {
  contestId: string;
  organizerUserId: number;
}) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  const existing = await prisma.fotorankAdmissionBatch.findFirst({
    where: {
      contestId: input.contestId,
      status: { in: ["DRAFT", "PROCESSING", "REVIEW_REQUIRED", "READY_TO_CLOSE", "CLOSED"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;

  return prisma.fotorankAdmissionBatch.create({
    data: {
      id: newId("bat"),
      contestId: input.contestId,
      status: "DRAFT",
      engineVersion: ADMISSION_ENGINE_VERSION,
      rulesVersion: ADMISSION_RULES_VERSION,
      createdByUserId: input.organizerUserId,
    },
  });
}

export type FreezeSelectionInput = {
  contestId: string;
  organizerUserId: number;
  /** Obligatorio: al menos categorySlugs o entryIds (alcance explícito). */
  categorySlugs?: string[];
  entryIds?: string[];
  dryRun?: boolean;
  /** Requerido en apply; debe coincidir con dry-run. */
  selectionHash?: string;
  /** Requerido en apply. */
  expectedCount?: number;
  /** Confirmación opcional: `CONGELAR ${n} OBRAS`. */
  confirmPhrase?: string;
  batchId?: string;
  requestId?: string;
};

function requireExplicitFreezeScope(input: {
  categorySlugs?: string[];
  entryIds?: string[];
}) {
  const hasCats = Boolean(input.categorySlugs?.length);
  const hasIds = Boolean(input.entryIds?.length);
  if (!hasCats && !hasIds) {
    throw new AdmissionError(
      "SELECTION_REQUIRED",
      "Freeze requiere alcance explícito: categorySlugs y/o entryIds. No se permite congelar todas las ADMITTED implícitamente.",
      400,
    );
  }
}

/**
 * Candidatos a freeze con exclusiones canónicas.
 * Solo ADMITTED; excluye pending/evidence/replace/rejected/withdrawn;
 * Reportero exige ARGRA VERIFIED.
 */
export async function resolveFreezeCandidates(input: {
  contestId: string;
  categorySlugs?: string[];
  entryIds?: string[];
}) {
  requireExplicitFreezeScope(input);
  const where: Prisma.FotorankContestEntryWhereInput = {
    contestId: input.contestId,
    admissionStatus: "ADMITTED",
    withdrawnAt: null,
    status: { notIn: ["REJECTED", "WITHDRAWN"] },
    manualReviewStatus: { notIn: ["PENDING", "REPLACEMENT_REQUESTED", "REJECTED"] },
  };
  if (input.entryIds?.length) {
    where.id = { in: [...new Set(input.entryIds)] };
  }
  if (input.categorySlugs?.length) {
    where.category = { slug: { in: [...new Set(input.categorySlugs)] } };
  }

  const rows = await prisma.fotorankContestEntry.findMany({
    where,
    include: {
      category: { select: { id: true, slug: true, name: true } },
      registration: { select: { answersJson: true } },
      assets: {
        where: { kind: "JURY_PREVIEW", isActive: true },
        take: 1,
        select: { id: true, sha256: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const excluded: Array<{ entryId: string; reason: string }> = [];
  const candidates = rows.filter((e) => {
    const ops = parseAdmissionOps(e.metadataJson);
    if (ops.evidenceRequest?.status === "OPEN") {
      excluded.push({ entryId: e.id, reason: "EVIDENCE_REQUESTED" });
      return false;
    }
    if (e.category.slug === "reportero-grafico") {
      const answers = (e.registration?.answersJson ?? null) as RegistrationAnswers | null;
      if (answers?.argraVerificationStatus !== "VERIFIED") {
        excluded.push({ entryId: e.id, reason: "ARGRA_NOT_VERIFIED" });
        return false;
      }
    }
    return true;
  });

  const [pendingReview, rejected, alreadyFrozen, eligibleNotAdmitted] = await Promise.all([
    prisma.fotorankContestEntry.count({
      where: {
        contestId: input.contestId,
        admissionStatus: { in: ["PENDING_MANUAL_REVIEW", "PENDING_AUTOMATIC_REVIEW"] },
      },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId: input.contestId, admissionStatus: "REJECTED" },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId: input.contestId, admissionStatus: "FROZEN_FOR_JURY" },
    }),
    prisma.fotorankContestEntry.count({
      where: { contestId: input.contestId, admissionStatus: "ELIGIBLE" },
    }),
  ]);

  const byCategory: Record<string, number> = {};
  for (const c of candidates) {
    byCategory[c.category.slug] = (byCategory[c.category.slug] ?? 0) + 1;
  }

  return {
    candidates,
    excluded,
    counts: {
      admittedSelected: candidates.length,
      omittedFromSelection: excluded.length,
      pendingReview,
      rejected,
      alreadyFrozen,
      eligibleNotAdmitted,
    },
    byCategory,
  };
}

export async function freezeAdmittedEntries(input: FreezeSelectionInput) {
  await requireContestOrganizer(input.contestId, input.organizerUserId);
  requireExplicitFreezeScope(input);
  const dryRun = input.dryRun !== false;

  const resolved = await resolveFreezeCandidates({
    contestId: input.contestId,
    categorySlugs: input.categorySlugs,
    entryIds: input.entryIds,
  });
  const entryIds = resolved.candidates.map((c) => c.id);
  const categorySlugs = [
    ...new Set([
      ...(input.categorySlugs ?? []),
      ...resolved.candidates.map((c) => c.category.slug),
    ]),
  ].sort();

  let selectionHash: string;
  try {
    selectionHash = buildFreezeSelectionHash({
      contestId: input.contestId,
      categorySlugs,
      entryIds,
      expectedCount: entryIds.length,
      rulesVersion: ADMISSION_RULES_VERSION,
    });
  } catch {
    throw new AdmissionError("SELECTION_HASH_BUILD_FAILED", "No se pudo construir selection hash.", 400);
  }

  const samplePayloads = resolved.candidates.slice(0, 5).map((e) => {
    const code = buildAnonymousJuryCode({
      contestId: e.contestId,
      categoryId: e.categoryId,
      entryId: e.id,
      batchId: "dry-run-batch",
      categorySlug: e.category.slug,
    });
    const payload = buildAnonymousJuryPayload({
      anonymousCode: code,
      categorySlug: e.category.slug,
      categoryName: e.category.name,
      title: e.title,
      description: e.description,
      hasJuryAsset: e.assets.length > 0,
      entryId: e.id,
    });
    return {
      entryId: e.id,
      entryNumber: e.entryNumber,
      categorySlug: e.category.slug,
      anonymousCode: code,
      payload,
      leaks: assertAnonymousPayloadClean(payload as unknown as Record<string, unknown>),
    };
  });
  const leakCount = samplePayloads.reduce((n, p) => n + p.leaks.length, 0);
  if (leakCount > 0) {
    throw new AdmissionError(
      "ANONYMIZATION_LEAK",
      `Dry-run detectó ${leakCount} leak(s) de anonimización. No se permite override.`,
      409,
    );
  }

  if (dryRun) {
    const batch = await getOrCreateAdmissionBatch({
      contestId: input.contestId,
      organizerUserId: input.organizerUserId,
    });
    await writeAdmissionAudit({
      contestId: input.contestId,
      actorUserId: input.organizerUserId,
      entryId: batch.id,
      action: "FREEZE_DRY_RUN",
      nextStatus: "DRAFT",
      reasonCode: "ENTRY_FROZEN",
      requestId: input.requestId,
      metadata: {
        selectionHash,
        expectedCount: entryIds.length,
        categorySlugs,
        counts: resolved.counts,
        byCategory: resolved.byCategory,
      },
    });
    return {
      dryRun: true as const,
      batchId: batch.id,
      selectionHash,
      expectedCount: entryIds.length,
      categorySlugs,
      entryIds,
      entryCodes: resolved.candidates.slice(0, 50).map((e) => e.entryNumber ?? e.id.slice(0, 8)),
      wouldFreeze: entryIds.length,
      counts: resolved.counts,
      byCategory: resolved.byCategory,
      excluded: resolved.excluded.slice(0, 50),
      samplePayloads,
      validationErrors: [] as string[],
      engineVersion: ADMISSION_ENGINE_VERSION,
      rulesVersion: ADMISSION_RULES_VERSION,
      confirmHint: entryIds.length
        ? `CONGELAR ${entryIds.length} OBRAS`
        : "Sin obras candidatas",
    };
  }

  // APPLY
  if (input.selectionHash == null || input.expectedCount == null) {
    throw new AdmissionError(
      "APPLY_REQUIRES_HASH",
      "Apply requiere selectionHash y expectedCount del dry-run.",
      400,
    );
  }
  try {
    assertSelectionHashMatch(input.selectionHash, selectionHash);
  } catch {
    throw new AdmissionError(
      "SELECTION_HASH_MISMATCH",
      "El conjunto cambió desde el dry-run. Ejecutá un nuevo dry-run.",
      409,
    );
  }
  if (input.expectedCount !== entryIds.length) {
    throw new AdmissionError(
      "EXPECTED_COUNT_MISMATCH",
      `Cantidad esperada ${input.expectedCount} ≠ candidatas actuales ${entryIds.length}.`,
      409,
    );
  }
  if (entryIds.length > 0) {
    const required = `CONGELAR ${entryIds.length} OBRAS`;
    if (input.confirmPhrase && input.confirmPhrase.trim() !== required) {
      throw new AdmissionError(
        "CONFIRM_PHRASE_MISMATCH",
        `Confirmación inválida. Esperado: ${required}`,
        400,
      );
    }
  }

  const batch = input.batchId
    ? await prisma.fotorankAdmissionBatch.findFirst({
        where: { id: input.batchId, contestId: input.contestId },
      })
    : await getOrCreateAdmissionBatch({
        contestId: input.contestId,
        organizerUserId: input.organizerUserId,
      });
  if (!batch) throw new AdmissionError("BATCH_NOT_FOUND", "Lote no encontrado.", 404);

  if (batch.status === "FROZEN" && entryIds.length === 0) {
    return {
      dryRun: false as const,
      alreadyFrozen: true as const,
      batchId: batch.id,
      selectionHash,
      expectedCount: 0,
      wouldFreeze: 0,
      frozen: 0,
      skipped: resolved.counts.pendingReview + resolved.counts.rejected,
      failures: [] as Array<{ entryId: string; error: string }>,
    };
  }

  let frozen = 0;
  const failures: Array<{ entryId: string; error: string }> = [];

  for (const entry of resolved.candidates) {
    try {
      const anonymousCode =
        entry.anonymousJuryCode ??
        buildAnonymousJuryCode({
          contestId: entry.contestId,
          categoryId: entry.categoryId,
          entryId: entry.id,
          batchId: batch.id,
          categorySlug: entry.category.slug,
        });
      const juryAsset = entry.assets[0];
      const ops = pushNotificationIntent(parseAdmissionOps(entry.metadataJson), "FROZEN", entry.id);

      await prisma.$transaction(async (tx) => {
        await tx.fotorankContestEntry.update({
          where: { id: entry.id },
          data: {
            admissionStatus: "FROZEN_FOR_JURY",
            admissionBatchId: batch.id,
            anonymousJuryCode: anonymousCode,
            entryNumber: entry.entryNumber ?? anonymousCode,
            status: "CONFIRMED",
            metadataJson: mergeAdmissionOps(entry.metadataJson, ops),
          },
        });
        await tx.fotorankJuryEntrySnapshot.upsert({
          where: {
            admissionBatchId_entryId: {
              admissionBatchId: batch.id,
              entryId: entry.id,
            },
          },
          create: {
            id: newId("snap"),
            contestId: entry.contestId,
            entryId: entry.id,
            admissionBatchId: batch.id,
            originalAssetId: entry.activeAssetId,
            juryAssetId: juryAsset?.id ?? null,
            sha256: juryAsset?.sha256 ?? null,
            sha256Jury: juryAsset?.sha256 ?? null,
            categoryId: entry.categoryId,
            // ETAPA 16B — consigna canónica para ranking/finalistas por prompt.
            promptExternalId: entry.externalPromptId ?? null,
            anonymousCode,
            admittedAt: entry.confirmedAt,
            frozenAt: new Date(),
            metadataSnapshot: {
              noIdentity: true,
              technicalSummaryStatus: entry.technicalSummaryStatus,
              title: entry.title,
              description: entry.description,
            },
          },
          update: {
            frozenAt: new Date(),
            anonymousCode,
            juryAssetId: juryAsset?.id ?? null,
            promptExternalId: entry.externalPromptId ?? null,
          },
        });
      });
      frozen += 1;
    } catch (err) {
      failures.push({
        entryId: entry.id,
        error: err instanceof Error ? err.message : "freeze_failed",
      });
    }
  }

  await prisma.fotorankAdmissionBatch.update({
    where: { id: batch.id },
    data: {
      status: "FROZEN",
      frozenAt: new Date(),
      frozenEntries: frozen,
      admittedEntries: frozen,
      totalEntries: entryIds.length,
      pendingReviewEntries: resolved.counts.pendingReview,
      rejectedEntries: resolved.counts.rejected,
      rulesVersion: ADMISSION_RULES_VERSION,
      engineVersion: ADMISSION_ENGINE_VERSION,
      metadata: {
        requestId: input.requestId ?? null,
        engineVersion: ADMISSION_ENGINE_VERSION,
        dryRun: false,
        selectionHash,
        expectedCount: entryIds.length,
        categorySlugs,
        entryIds,
        excludedCount: resolved.excluded.length,
        byCategory: resolved.byCategory,
        operatorUserId: input.organizerUserId,
      },
    },
  });

  await writeAdmissionAudit({
    contestId: input.contestId,
    actorUserId: input.organizerUserId,
    entryId: batch.id,
    action: "FREEZE_APPLY",
    previousStatus: batch.status,
    nextStatus: "FROZEN",
    reasonCode: "ENTRY_FROZEN",
    requestId: input.requestId,
    metadata: {
      frozen,
      failures: failures.length,
      selectionHash,
      expectedCount: entryIds.length,
      categorySlugs,
    },
  });

  return {
    dryRun: false as const,
    alreadyFrozen: false as const,
    batchId: batch.id,
    selectionHash,
    expectedCount: entryIds.length,
    categorySlugs,
    wouldFreeze: entryIds.length,
    frozen,
    skipped: resolved.counts.pendingReview + resolved.counts.rejected + resolved.excluded.length,
    failures,
    byCategory: resolved.byCategory,
  };
}

export async function respondEvidenceAsParticipant(input: {
  contestId: string;
  entryId: string;
  participantUserId: number;
  responseText: string;
}) {
  const entry = await prisma.fotorankContestEntry.findFirst({
    where: { id: input.entryId, contestId: input.contestId },
  });
  if (!entry || entry.authorUserId !== input.participantUserId) {
    throw new AdmissionError("FORBIDDEN", "No autorizado.", 403);
  }
  const ops = parseAdmissionOps(entry.metadataJson);
  if (!ops.evidenceRequest || ops.evidenceRequest.status !== "OPEN") {
    throw new AdmissionError("NO_EVIDENCE_OPEN", "No hay solicitud de evidencia abierta.", 409);
  }
  const text = input.responseText.trim().slice(0, 4000);
  if (!text) throw new AdmissionError("RESPONSE_REQUIRED", "La respuesta no puede estar vacía.", 400);

  const evidence = {
    ...ops.evidenceRequest,
    status: "RESPONDED" as const,
    participantResponse: text,
    respondedAt: new Date().toISOString(),
  };
  await prisma.fotorankContestEntry.update({
    where: { id: entry.id },
    data: {
      metadataJson: mergeAdmissionOps(entry.metadataJson, { ...ops, evidenceRequest: evidence }),
    },
  });
  return { evidenceRequest: evidence };
}

export type { AdmissionReasonCode };
