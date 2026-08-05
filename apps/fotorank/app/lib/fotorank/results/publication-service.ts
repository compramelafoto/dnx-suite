import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { ResultError } from "./errors";
import { enqueueResultNotificationIntent } from "./notification-intents";
import { buildResultPublicationHash } from "./publication-hash";
import { evaluateResultPublicationReadiness } from "./publication-readiness";
import {
  emptyPublicationMeta,
  parsePublicationMeta,
  SANTA_FE_PUBLICATION_TZ,
  SANTA_FE_PUBLISH_CONFIRM_PHRASE,
  STAGING_TEST_PUBLICATION_PHRASE,
  type ApprovalStatus,
  type ConfigDecisionStatus,
  type FinalistSelectionStatus,
  type ResultPublicationMeta,
} from "./publication-types";

function newId() {
  return `rp${randomBytes(12).toString("hex")}`;
}

async function writeAudit(input: {
  contestId: string;
  actorUserId: number;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}) {
  const contest = await prisma.fotorankContest.findUnique({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  if (!contest) return;
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: contest.organizationId,
      contestId: input.contestId,
      actorType: "ADMIN",
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}

async function loadBatch(contestId: string, batchId: string) {
  const batch = await prisma.fotorankResultBatch.findFirst({
    where: { id: batchId, contestId },
    include: {
      entries: { orderBy: [{ categoryId: "asc" }, { preliminaryPosition: "asc" }] },
      ruleSet: true,
      scoringSession: true,
    },
  });
  if (!batch) throw new ResultError("BATCH_NOT_FOUND", "Batch no encontrado.", 404);
  return batch;
}

async function saveMeta(
  batchId: string,
  meta: ResultPublicationMeta,
  revision: { contestId: string; actorUserId: number; reason: string; before: unknown },
) {
  const revCount = await prisma.fotorankResultRevision.count({ where: { resultBatchId: batchId } });
  await prisma.$transaction([
    prisma.fotorankResultBatch.update({
      where: { id: batchId },
      data: { metadata: meta as object },
    }),
    prisma.fotorankResultRevision.create({
      data: {
        id: newId(),
        resultBatchId: batchId,
        revisionNumber: revCount + 1,
        reason: revision.reason.slice(0, 500),
        actorUserId: revision.actorUserId,
        beforeJson: revision.before as object,
        afterJson: meta as object,
      },
    }),
  ]);
}

export async function ensurePublicationMeta(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  const existing = batch.metadata;
  const already =
    existing &&
    typeof existing === "object" &&
    !Array.isArray(existing) &&
    "schemaVersion" in (existing as object) &&
    (existing as { schemaVersion?: number }).schemaVersion === 1;
  if (already) {
    return parsePublicationMeta(existing);
  }
  const meta = {
    ...(existing && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as object)
      : {}),
    ...emptyPublicationMeta(),
  } as ResultPublicationMeta;
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: "init publication meta",
    before: existing,
  });
  return meta;
}

export async function confirmRubricForPublication(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  status: ConfigDecisionStatus;
  note?: string;
}) {
  if (input.status === "CONFIRMED") {
    throw new ResultError(
      "PUBLICATION_BLOCKED",
      "Confirmación oficial de rúbrica requiere decisión humana fuera de staging. Usá STAGING_TEST_CONFIGURATION.",
      409,
    );
  }
  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.rubricConfirmation = {
    status: input.status,
    confirmedAt: new Date().toISOString(),
    confirmedByUserId: input.actorUserId,
    note: input.note,
  };
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: `rubric ${input.status}`,
    before,
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_RUBRIC_CONFIRMATION",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { status: input.status },
  });
  return meta;
}

export async function confirmAwardsConfig(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  status: ConfigDecisionStatus;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.awardsConfig = {
    ...meta.awardsConfig!,
    status: input.status,
    updatedAt: new Date().toISOString(),
    updatedByUserId: input.actorUserId,
  };
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: `awards ${input.status}`,
    before,
  });
  return meta;
}

export async function configureFinalists(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  status: ConfigDecisionStatus;
  mode: "AUTO_TOP_N" | "MANUAL" | "MIXED";
  defaultTopN: number;
  topNByCategorySlug?: Record<string, number>;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.finalistsConfig = {
    status: input.status,
    mode: input.mode,
    defaultTopN: Math.max(1, Math.min(50, input.defaultTopN)),
    topNByCategorySlug: input.topNByCategorySlug,
  };

  if (input.mode === "AUTO_TOP_N" || input.mode === "MIXED") {
    const cats = await prisma.fotorankContestCategory.findMany({
      where: { contestId: input.contestId, status: "ACTIVE" },
      select: { id: true, slug: true },
    });
    const selections: NonNullable<ResultPublicationMeta["finalistSelections"]> = [];
    for (const cat of cats) {
      const n = input.topNByCategorySlug?.[cat.slug] ?? input.defaultTopN;
      const ranked = batch.entries
        .filter(
          (e) =>
            e.categoryId === cat.id &&
            e.coverageStatus === "COMPLETE" &&
            e.resultStatus !== "DISQUALIFIED" &&
            e.resultStatus !== "TIED",
        )
        .sort((a, b) => (a.finalPosition ?? a.preliminaryPosition ?? 999) - (b.finalPosition ?? b.preliminaryPosition ?? 999));
      // no saltar empates: si hay TIED en top, no auto-seleccionar más allá
      for (let i = 0; i < ranked.length && selections.filter((s) => s.categoryId === cat.id).length < n; i++) {
        const e = ranked[i]!;
        selections.push({
          juryEntrySnapshotId: e.juryEntrySnapshotId,
          categoryId: cat.id,
          anonymousCode: e.anonymousCode,
          status: "AUTO_SELECTED",
          actorUserId: input.actorUserId,
          at: new Date().toISOString(),
        });
      }
    }
    meta.finalistSelections = selections;
  }

  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: "configure finalists",
    before,
  });
  await enqueueResultNotificationIntent({
    contestId: input.contestId,
    kind: "FINALIST_SELECTED",
    metadata: { batchId: batch.id, count: meta.finalistSelections?.length ?? 0 },
  }).catch(() => undefined);
  return meta;
}

export async function deriveWinnersFromRanking(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  if (batch.entries.some((e) => e.resultStatus === "TIED")) {
    throw new ResultError("TIES_UNRESOLVED", "Hay empates sin resolver (comité).", 409);
  }
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  const winners: NonNullable<ResultPublicationMeta["winnerSelections"]> = [];
  const byCat = new Map<string, typeof batch.entries>();
  for (const e of batch.entries) {
    if (e.resultStatus === "DISQUALIFIED" || e.coverageStatus !== "COMPLETE") continue;
    const list = byCat.get(e.categoryId) ?? [];
    list.push(e);
    byCat.set(e.categoryId, list);
  }
  for (const [categoryId, list] of byCat) {
    const sorted = [...list].sort(
      (a, b) => (a.finalPosition ?? a.preliminaryPosition ?? 999) - (b.finalPosition ?? b.preliminaryPosition ?? 999),
    );
    sorted.slice(0, 3).forEach((e, i) => {
      winners.push({
        juryEntrySnapshotId: e.juryEntrySnapshotId,
        categoryId,
        anonymousCode: e.anonymousCode,
        awardType: i === 0 ? "FIRST_PLACE" : i === 1 ? "SECOND_PLACE" : "THIRD_PLACE",
        source: "RANKING",
        actorUserId: input.actorUserId,
        at: new Date().toISOString(),
      });
    });
  }
  meta.winnerSelections = winners;
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: "derive winners from ranking",
    before,
  });
  return meta;
}

export async function recordCommitteeDecision(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  tieGroup: string;
  orderedSnapshotIds: string[];
  members: string[];
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new ResultError("REASON_REQUIRED", "Motivo del comité obligatorio.", 400);
  }
  if (!input.members.length) {
    throw new ResultError("REASON_REQUIRED", "Integrantes del comité obligatorios.", 400);
  }
  // Reutiliza desempate manual del motor (conserva scores).
  const { resolveTieManual } = await import("./result-service");
  await resolveTieManual({
    contestId: input.contestId,
    batchId: input.batchId,
    orderedSnapshotIds: input.orderedSnapshotIds,
    tieGroup: input.tieGroup,
    actorUserId: input.actorUserId,
    note: `COMMITTEE: ${input.reason} · members=${input.members.join(",")}`,
  });

  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.committeeDecisions = [
    ...(meta.committeeDecisions ?? []),
    {
      id: newId(),
      tieGroup: input.tieGroup,
      orderedSnapshotIds: input.orderedSnapshotIds,
      members: input.members,
      reason: input.reason.slice(0, 1000),
      decidedByUserId: input.actorUserId,
      at: new Date().toISOString(),
    },
  ];
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: "committee decision",
    before,
  });
  return meta;
}

export async function setInstitutionalReview(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  status: ApprovalStatus;
  notes?: string;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  const readiness = await evaluateResultPublicationReadiness({
    contestId: input.contestId,
    batchId: input.batchId,
  });
  const blockInstitutional = [
    "UNRESOLVED_TIE",
    "RUBRIC_NOT_CONFIRMED",
    "AWARDS_NOT_CONFIRMED",
    "INCOMPLETE_COVERAGE",
    "PRIVACY_CHECK_FAILED",
  ] as const;
  const hit = readiness.reasonCodes.filter((c) =>
    (blockInstitutional as readonly string[]).includes(c),
  );
  if (input.status === "APPROVED" && hit.length) {
    throw new ResultError(
      "PUBLICATION_BLOCKED",
      `No se puede aprobar institucionalmente: ${hit.join(", ")}`,
      409,
    );
  }
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.institutionalReview = {
    status: input.status,
    actorUserId: input.actorUserId,
    at: new Date().toISOString(),
    notes: input.notes,
  };
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: `institutional ${input.status}`,
    before,
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_INSTITUTIONAL_REVIEW",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { status: input.status },
  });
  return meta;
}

export async function setLegalReview(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  status: ApprovalStatus;
  notes?: string;
  basesVersionRef?: string;
  privacyVersionRef?: string;
}) {
  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.legalReview = {
    status: input.status,
    actorUserId: input.actorUserId,
    at: new Date().toISOString(),
    notes: input.notes,
    basesVersionRef: input.basesVersionRef,
    privacyVersionRef: input.privacyVersionRef,
  };
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: `legal ${input.status}`,
    before,
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_LEGAL_REVIEW",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { status: input.status },
  });
  return meta;
}

export async function buildPrivatePreviewPayload(input: {
  contestId: string;
  batchId: string;
}) {
  const readiness = await evaluateResultPublicationReadiness(input);
  const batch = await loadBatch(input.contestId, input.batchId);
  const meta = parsePublicationMeta(batch.metadata);
  return {
    kind: "PRIVATE_PREVIEW" as const,
    contestId: input.contestId,
    batchId: batch.id,
    batchStatus: batch.status,
    readiness,
    publicationHash: readiness.publicationHash,
    timezone: meta.publication?.timezone ?? SANTA_FE_PUBLICATION_TZ,
    rubricStatus: meta.rubricConfirmation?.status,
    awardsStatus: meta.awardsConfig?.status,
    finalists: meta.finalistSelections ?? [],
    winners: meta.winnerSelections ?? [],
    entries: batch.entries.map((e) => ({
      anonymousCode: e.anonymousCode,
      categoryId: e.categoryId,
      position: e.finalPosition ?? e.preliminaryPosition,
      awardType: e.awardType,
      resultStatus: e.resultStatus,
      // scores visibles solo en preview privado organizador
      aggregateScore: e.aggregateScore,
    })),
    publicScoresMode: meta.publication?.publicScoresMode ?? "HIDDEN",
    note: "Preview privado — no indexable — no equivale a resultados oficiales.",
  };
}

export async function publishResultBatch(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  expectedHash: string;
  confirmationPhrase: string;
  idempotencyKey: string;
  stagingTest?: boolean;
}) {
  const isStagingPhrase = input.confirmationPhrase.trim() === STAGING_TEST_PUBLICATION_PHRASE;
  const isOfficialPhrase = input.confirmationPhrase.trim() === SANTA_FE_PUBLISH_CONFIRM_PHRASE;
  if (!isStagingPhrase && !isOfficialPhrase) {
    throw new ResultError("CONFIRMATION_REQUIRED", "Frase de confirmación inválida.", 400);
  }
  if (isOfficialPhrase) {
    throw new ResultError(
      "PUBLICATION_BLOCKED",
      "Publicación oficial bloqueada en esta etapa. Solo STAGING_TEST_PUBLICATION en Preview.",
      409,
    );
  }
  if (process.env.VERCEL_ENV === "production" || process.env.FOTORANK_ALLOW_PROD_RESULTS_PUBLISH !== "1") {
    if (process.env.VERCEL_ENV === "production") {
      throw new ResultError("PUBLICATION_BLOCKED", "Prohibido publicar resultados en Production.", 403);
    }
  }

  const existing = await prisma.fotorankResultBatch.findFirst({
    where: { contestId: input.contestId, idempotencyKey: input.idempotencyKey },
  });
  if (existing?.status === "PUBLISHED") {
    return { ok: true as const, idempotent: true, batchId: existing.id };
  }

  const readiness = await evaluateResultPublicationReadiness({
    contestId: input.contestId,
    batchId: input.batchId,
  });
  if (readiness.status !== "READY") {
    throw new ResultError(
      "PUBLICATION_BLOCKED",
      `Readiness BLOCKED: ${readiness.reasonCodes.join(", ")}`,
      409,
    );
  }
  if (!readiness.publicationHash || readiness.publicationHash !== input.expectedHash) {
    throw new ResultError("PUBLICATION_HASH_MISMATCH", "Hash de publicación no coincide.", 409);
  }

  const batch = await loadBatch(input.contestId, input.batchId);
  if (batch.status !== "FINALIZED" && batch.status !== "PUBLISHED") {
    throw new ResultError("BATCH_NOT_GENERATED", "Batch no FINALIZED.", 409);
  }

  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  const now = new Date().toISOString();
  meta.publication = {
    ...meta.publication!,
    status: "LIVE",
    hash: readiness.publicationHash,
    publishedAt: now,
    publishedByUserId: input.actorUserId,
    stagingTest: true,
    timezone: SANTA_FE_PUBLICATION_TZ,
    scheduledAt: now,
  };

  await prisma.fotorankResultBatch.update({
    where: { id: batch.id },
    data: {
      status: "PUBLISHED",
      publicationApproved: true,
      publishedAt: new Date(),
      publishedByUserId: input.actorUserId,
      idempotencyKey: input.idempotencyKey,
      metadata: meta as object,
    },
  });
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: "publish staging test",
    before,
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_PUBLISHED_STAGING_TEST",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { hash: readiness.publicationHash, stagingTest: true },
  });
  await enqueueResultNotificationIntent({
    contestId: input.contestId,
    kind: "RESULTS_PUBLISHED",
    metadata: { batchId: batch.id, stagingTest: true },
  }).catch(() => undefined);

  return { ok: true as const, idempotent: false, batchId: batch.id, hash: readiness.publicationHash };
}

export async function revokeResultPublication(input: {
  contestId: string;
  batchId: string;
  actorUserId: number;
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new ResultError("REASON_REQUIRED", "Motivo de revocación obligatorio.", 400);
  }
  const batch = await loadBatch(input.contestId, input.batchId);
  const before = parsePublicationMeta(batch.metadata);
  const meta = parsePublicationMeta(batch.metadata);
  meta.publication = {
    ...meta.publication!,
    status: "REVOKED",
    revokedAt: new Date().toISOString(),
    revokedByUserId: input.actorUserId,
    revokeReason: input.reason.slice(0, 1000),
  };
  await prisma.fotorankResultBatch.update({
    where: { id: batch.id },
    data: {
      status: "FINALIZED",
      publicationApproved: false,
      metadata: meta as object,
    },
  });
  await saveMeta(batch.id, meta, {
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    reason: `revoke: ${input.reason}`,
    before,
  });
  await writeAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "RESULT_PUBLICATION_REVOKED",
    entityType: "FotorankResultBatch",
    entityId: batch.id,
    payload: { reason: input.reason.slice(0, 200) },
  });
  return meta;
}

export async function listResultPublicationHistory(input: {
  contestId: string;
  batchId: string;
}) {
  return prisma.fotorankResultRevision.findMany({
    where: { resultBatchId: input.batchId, resultBatch: { contestId: input.contestId } },
    orderBy: { revisionNumber: "desc" },
    take: 50,
    select: {
      id: true,
      revisionNumber: true,
      reason: true,
      actorUserId: true,
      createdAt: true,
    },
  });
}

export type { FinalistSelectionStatus };
