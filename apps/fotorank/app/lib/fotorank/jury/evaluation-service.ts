import { randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJudgeContestAccess } from "./jury-access";
import {
  computeWeightedScore,
  JURY_SCORING_ENGINE_VERSION,
  type CriterionScoreInput,
} from "./scoring-engine";
import { hasAcceptedJuryTerms } from "./jury-terms";

function newId() {
  return `je${randomBytes(12).toString("hex")}`;
}

async function writeAudit(input: {
  organizationId: string;
  contestId: string;
  actorJudgeId?: string | null;
  actorUserId?: number | null;
  eventType: string;
  entityType: string;
  entityId: string;
  payload?: unknown;
}) {
  await prisma.fotorankJudgeAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      contestId: input.contestId,
      actorType: input.actorJudgeId ? "JUDGE" : "ADMIN",
      actorJudgeId: input.actorJudgeId ?? null,
      actorUserId: input.actorUserId ?? null,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      payloadJson: (input.payload as object) ?? undefined,
    },
  });
}

async function loadOpenSession(contestId: string) {
  return prisma.fotorankJuryScoringSession.findFirst({
    where: {
      contestId,
      status: "OPEN",
      scoringEnabled: true,
    },
    include: {
      rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
      admissionBatch: { select: { id: true, status: true } },
    },
    orderBy: { openedAt: "desc" },
  });
}

/**
 * ETAPA 16B — path de desempate: si la sesión ya está CLOSED pero el jurado tiene una
 * evaluación NOT_STARTED/IN_PROGRESS preasignada (extra judge), permitir completar esa eval.
 */
async function loadSessionForEvaluation(input: {
  contestId: string;
  judgeAccountId: string;
  snapshotId: string;
}) {
  const open = await loadOpenSession(input.contestId);
  if (open) return open;

  const pending = await prisma.fotorankJuryEvaluation.findFirst({
    where: {
      contestId: input.contestId,
      jurorId: input.judgeAccountId,
      juryEntrySnapshotId: input.snapshotId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      scoringSessionId: { not: null },
    },
    select: { scoringSessionId: true },
  });
  if (!pending?.scoringSessionId) return null;

  return prisma.fotorankJuryScoringSession.findFirst({
    where: {
      id: pending.scoringSessionId,
      contestId: input.contestId,
      status: { in: ["CLOSED", "LOCKED"] },
    },
    include: {
      rubric: { include: { criteria: { orderBy: { sortOrder: "asc" } } } },
      admissionBatch: { select: { id: true, status: true } },
    },
  });
}

/**
 * ETAPA 16A — Validación de escala de sesión (independiente de min/max por criterio de la
 * rúbrica). Clickatón: enteros 1–10 (scoreIntegerOnly=true). Otros concursos pueden habilitar
 * decimales configurando scoreIntegerOnly=false en FotorankJuryScoringSession.
 */
function validateSessionScoreScale(
  session: { scoreIntegerOnly: boolean; scoreScaleMin: number; scoreScaleMax: number },
  scores: CriterionScoreInput[],
) {
  for (const s of scores) {
    if (!Number.isFinite(s.score)) {
      throw new JuryError("INVALID_SCORE", `Score inválido en criterio ${s.key}.`, 400);
    }
    if (session.scoreIntegerOnly && !Number.isInteger(s.score)) {
      throw new JuryError(
        "INVALID_SCORE",
        `El criterio ${s.key} requiere un puntaje entero (esta sesión no admite decimales).`,
        400,
      );
    }
    if (s.score < session.scoreScaleMin || s.score > session.scoreScaleMax) {
      throw new JuryError(
        "OUT_OF_RANGE",
        `El criterio ${s.key} debe estar entre ${session.scoreScaleMin} y ${session.scoreScaleMax}.`,
        400,
      );
    }
  }
}

/**
 * Autosave / submit de evaluación sobre snapshot FROZEN.
 * Totales siempre calculados en backend.
 */
export async function upsertJuryEvaluation(input: {
  judgeAccountId: string;
  contestId: string;
  snapshotId: string;
  scores: CriterionScoreInput[];
  privateComment?: string | null;
  participantFeedback?: string | null;
  submit?: boolean;
  expectedVersion?: number;
  idempotencyKey?: string | null;
}) {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });

  if (input.idempotencyKey) {
    const byKey = await prisma.fotorankJuryEvaluation.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { criterionScores: true },
    });
    if (byKey) {
      return { evaluation: byKey, idempotent: true as const };
    }
  }

  const session = await loadSessionForEvaluation({
    contestId: input.contestId,
    judgeAccountId: input.judgeAccountId,
    snapshotId: input.snapshotId,
  });
  if (!session) {
    throw new JuryError("SESSION_CLOSED", "No hay sesión de jurado OPEN habilitada.", 403);
  }
  if (session.admissionBatch.status !== "FROZEN") {
    throw new JuryError("BATCH_NOT_FROZEN", "El lote de admisión no está congelado.", 403);
  }

  if (access.contest.slug === "santa-fe-en-foco" && input.submit) {
    const okTerms = await hasAcceptedJuryTerms({
      judgeAccountId: input.judgeAccountId,
      contestId: input.contestId,
    });
    if (!okTerms) {
      throw new JuryError(
        "TERMS_REQUIRED",
        "Debés aceptar los términos de jurado antes de enviar.",
        403,
      );
    }
  }

  const isTiebreakPath = session.status === "CLOSED" || session.status === "LOCKED";
  const now = new Date();
  if (!isTiebreakPath) {
    if (session.opensAt && session.opensAt > now) {
      throw new JuryError("WINDOW_CLOSED", "La ventana de evaluación aún no abrió.", 403);
    }
    if (session.closesAt && session.closesAt < now) {
      throw new JuryError("WINDOW_CLOSED", "La ventana de evaluación está cerrada.", 403);
    }
  }

  const snapshot = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: {
      id: input.snapshotId,
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
    },
  });
  if (!snapshot) {
    throw new JuryError("SNAPSHOT_NOT_FOUND", "Snapshot de obra no encontrado en el lote.", 404);
  }
  if (!access.categoryIds.includes(snapshot.categoryId)) {
    throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a esta categoría.", 403);
  }

  const assignment = access.assignments.find((a) => a.categoryId === snapshot.categoryId);
  if (!assignment) {
    throw new JuryError("NOT_ASSIGNED", "Sin asignación para esta categoría.", 403);
  }

  const conflict = await prisma.fotorankJudgeEntryConflict.findFirst({
    where: {
      entryId: snapshot.entryId,
      judgeAccountId: input.judgeAccountId,
      status: "ACTIVE",
    },
  });
  if (conflict && input.submit) {
    throw new JuryError("CONFLICT_BLOCKS_SUBMIT", "Hay un conflicto activo; no podés enviar.", 409);
  }

  const criteria = session.rubric.criteria.map((c) => ({
    key: c.key,
    name: c.name,
    weight: c.weight,
    minScore: c.minScore,
    maxScore: c.maxScore,
    step: c.step,
    required: c.required,
  }));

  validateSessionScoreScale(session, input.scores);

  const computed = computeWeightedScore({
    criteria,
    scores: input.scores,
    requireAllRequired: Boolean(input.submit),
  });
  if (!computed.ok && input.submit) {
    throw new JuryError(computed.code as import("./errors").JuryErrorCode, computed.error, 400);
  }

  const existing = await prisma.fotorankJuryEvaluation.findUnique({
    where: {
      assignmentId_juryEntrySnapshotId: {
        assignmentId: assignment.id,
        juryEntrySnapshotId: snapshot.id,
      },
    },
  });

  if (existing?.status === "SUBMITTED" || existing?.status === "LOCKED") {
    throw new JuryError("EVALUATION_LOCKED", "La evaluación ya fue enviada y está bloqueada.", 409);
  }
  if (existing?.status === "VOIDED") {
    throw new JuryError("EVALUATION_VOIDED", "La evaluación fue invalidada.", 409);
  }
  if (
    existing &&
    input.expectedVersion != null &&
    existing.expectedVersion !== input.expectedVersion
  ) {
    throw new JuryError(
      "VERSION_CONFLICT",
      "Hay una versión más nueva guardada. Recargá y reintentá.",
      409,
    );
  }

  const nextVersion = (existing?.expectedVersion ?? 0) + 1;
  const status = input.submit ? "SUBMITTED" : "IN_PROGRESS";
  const totalScore = computed.ok ? computed.totalScore : existing?.totalScore ?? null;
  const normalizedScore = computed.ok ? computed.normalizedScore : existing?.normalizedScore ?? null;

  const evaluation = existing
    ? await prisma.fotorankJuryEvaluation.update({
        where: { id: existing.id },
        data: {
          status,
          totalScore,
          normalizedScore,
          privateComment: input.privateComment?.slice(0, 2000) ?? existing.privateComment,
          participantFeedback:
            input.participantFeedback?.slice(0, 2000) ?? existing.participantFeedback,
          lastSavedAt: now,
          submittedAt: input.submit ? now : existing.submittedAt,
          expectedVersion: nextVersion,
          idempotencyKey: input.idempotencyKey ?? existing.idempotencyKey,
          engineVersion: JURY_SCORING_ENGINE_VERSION,
          scoringSessionId: session.id,
          criteriaSnapshot: criteria,
        },
      })
    : await prisma.fotorankJuryEvaluation.create({
        data: {
          id: newId(),
          contestId: input.contestId,
          admissionBatchId: session.admissionBatchId,
          scoringSessionId: session.id,
          juryEntrySnapshotId: snapshot.id,
          assignmentId: assignment.id,
          jurorId: input.judgeAccountId,
          rubricId: session.rubricId,
          rubricVersion: session.rubric.version,
          status,
          totalScore,
          normalizedScore,
          privateComment: input.privateComment?.slice(0, 2000) ?? null,
          participantFeedback: input.participantFeedback?.slice(0, 2000) ?? null,
          startedAt: now,
          lastSavedAt: now,
          submittedAt: input.submit ? now : null,
          expectedVersion: nextVersion,
          idempotencyKey: input.idempotencyKey ?? null,
          engineVersion: JURY_SCORING_ENGINE_VERSION,
          criteriaSnapshot: criteria,
        },
      });

  if (computed.ok) {
    await prisma.fotorankJuryCriterionScore.deleteMany({
      where: { evaluationId: evaluation.id },
    });
    const criterionByKey = new Map(session.rubric.criteria.map((c) => [c.key, c]));
    for (const line of computed.lines) {
      const crit = criterionByKey.get(line.key);
      if (!crit) continue;
      const comment = input.scores.find((s) => s.key === line.key)?.comment ?? null;
      await prisma.fotorankJuryCriterionScore.create({
        data: {
          id: newId(),
          evaluationId: evaluation.id,
          criterionId: crit.id,
          criterionKeySnapshot: line.key,
          criterionNameSnapshot: line.name,
          score: line.score,
          weightSnapshot: line.weight,
          weightedScore: line.weightedScore,
          comment: comment?.slice(0, 500) ?? null,
        },
      });
    }
  }

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await writeAudit({
    organizationId: contest.organizationId,
    contestId: input.contestId,
    actorJudgeId: input.judgeAccountId,
    eventType: input.submit ? "JURY_EVALUATION_SUBMITTED" : "JURY_EVALUATION_AUTOSAVE",
    entityType: "FotorankJuryEvaluation",
    entityId: evaluation.id,
    payload: {
      snapshotId: snapshot.id,
      anonymousCode: snapshot.anonymousCode,
      status,
      version: nextVersion,
      totalScore,
    },
  });

  const full = await prisma.fotorankJuryEvaluation.findUniqueOrThrow({
    where: { id: evaluation.id },
    include: { criterionScores: true },
  });
  return { evaluation: full, idempotent: false as const };
}

export async function voidJuryEvaluation(input: {
  contestId: string;
  evaluationId: string;
  actorUserId: number;
  reason: string;
}) {
  if (!input.reason.trim()) {
    throw new JuryError("REASON_REQUIRED", "Motivo obligatorio.", 400);
  }
  const evaluation = await prisma.fotorankJuryEvaluation.findFirst({
    where: { id: input.evaluationId, contestId: input.contestId },
  });
  if (!evaluation) throw new JuryError("NOT_FOUND", "Evaluación no encontrada.", 404);

  const updated = await prisma.fotorankJuryEvaluation.update({
    where: { id: evaluation.id },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidedByUserId: input.actorUserId,
      voidReason: input.reason.slice(0, 500),
    },
  });

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await writeAudit({
    organizationId: contest.organizationId,
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_EVALUATION_VOIDED",
    entityType: "FotorankJuryEvaluation",
    entityId: evaluation.id,
    payload: { reason: input.reason },
  });
  return updated;
}

/**
 * Posponer evaluación: el jurado quiere revisar la obra más tarde.
 * Conserva scores/comentario ya ingresados (a diferencia de abstención, que los invalida).
 * No cuenta como cobertura hasta que se envíe (SUBMITTED/LOCKED). Idempotente por versión.
 */
export async function postponeJuryEvaluation(input: {
  judgeAccountId: string;
  contestId: string;
  snapshotId: string;
  expectedVersion?: number;
}) {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });
  const session = await loadOpenSession(input.contestId);
  if (!session) {
    throw new JuryError("SESSION_CLOSED", "No hay sesión de jurado OPEN habilitada.", 403);
  }
  const snapshot = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: {
      id: input.snapshotId,
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
    },
  });
  if (!snapshot) {
    throw new JuryError("SNAPSHOT_NOT_FOUND", "Snapshot de obra no encontrado en el lote.", 404);
  }
  if (!access.categoryIds.includes(snapshot.categoryId)) {
    throw new JuryError("CATEGORY_NOT_ASSIGNED", "No estás asignado a esta categoría.", 403);
  }
  const assignment = access.assignments.find((a) => a.categoryId === snapshot.categoryId);
  if (!assignment) {
    throw new JuryError("NOT_ASSIGNED", "Sin asignación para esta categoría.", 403);
  }

  const existing = await prisma.fotorankJuryEvaluation.findUnique({
    where: {
      assignmentId_juryEntrySnapshotId: {
        assignmentId: assignment.id,
        juryEntrySnapshotId: snapshot.id,
      },
    },
  });
  if (existing?.status === "SUBMITTED" || existing?.status === "LOCKED") {
    throw new JuryError("EVALUATION_LOCKED", "La evaluación ya fue enviada; no se puede posponer.", 409);
  }
  if (
    existing &&
    input.expectedVersion != null &&
    existing.expectedVersion !== input.expectedVersion
  ) {
    throw new JuryError(
      "VERSION_CONFLICT",
      "Hay una versión más nueva guardada. Recargá y reintentá.",
      409,
    );
  }

  const now = new Date();
  const nextVersion = (existing?.expectedVersion ?? 0) + 1;
  const evaluation = existing
    ? await prisma.fotorankJuryEvaluation.update({
        where: { id: existing.id },
        data: {
          status: "POSTPONED",
          postponedAt: now,
          lastSavedAt: now,
          expectedVersion: nextVersion,
        },
      })
    : await prisma.fotorankJuryEvaluation.create({
        data: {
          id: newId(),
          contestId: input.contestId,
          admissionBatchId: session.admissionBatchId,
          scoringSessionId: session.id,
          juryEntrySnapshotId: snapshot.id,
          assignmentId: assignment.id,
          jurorId: input.judgeAccountId,
          rubricId: session.rubricId,
          rubricVersion: session.rubric.version,
          status: "POSTPONED",
          startedAt: now,
          postponedAt: now,
          lastSavedAt: now,
          expectedVersion: nextVersion,
          engineVersion: JURY_SCORING_ENGINE_VERSION,
        },
      });

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await writeAudit({
    organizationId: contest.organizationId,
    contestId: input.contestId,
    actorJudgeId: input.judgeAccountId,
    eventType: "JURY_EVALUATION_POSTPONED",
    entityType: "FotorankJuryEvaluation",
    entityId: evaluation.id,
    payload: { snapshotId: snapshot.id, anonymousCode: snapshot.anonymousCode, version: nextVersion },
  });
  return { evaluation, idempotent: false as const };
}

/**
 * ETAPA 16A — Reanuda una evaluación POSTPONED (vuelve a IN_PROGRESS).
 * Antes de CONFIRMAR EVALUACIÓN debe haber 0 postergadas (§7.5 master rules); este es el
 * complemento de `postponeJuryEvaluation` para que el jurado pueda retomarla desde la grilla.
 */
export async function resumePostponedEvaluation(input: {
  judgeAccountId: string;
  contestId: string;
  snapshotId: string;
}) {
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });
  const session = await loadOpenSession(input.contestId);
  if (!session) {
    throw new JuryError("SESSION_CLOSED", "No hay sesión de jurado OPEN habilitada.", 403);
  }
  const snapshot = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: {
      id: input.snapshotId,
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
    },
  });
  if (!snapshot) {
    throw new JuryError("SNAPSHOT_NOT_FOUND", "Snapshot de obra no encontrado en el lote.", 404);
  }
  const assignment = access.assignments.find((a) => a.categoryId === snapshot.categoryId);
  if (!assignment) {
    throw new JuryError("NOT_ASSIGNED", "Sin asignación para esta categoría.", 403);
  }

  const existing = await prisma.fotorankJuryEvaluation.findUnique({
    where: {
      assignmentId_juryEntrySnapshotId: {
        assignmentId: assignment.id,
        juryEntrySnapshotId: snapshot.id,
      },
    },
  });
  if (!existing || existing.status !== "POSTPONED") {
    throw new JuryError("NOT_FOUND", "No hay una evaluación postergada para reanudar.", 404);
  }

  const now = new Date();
  const evaluation = await prisma.fotorankJuryEvaluation.update({
    where: { id: existing.id },
    data: {
      status: "IN_PROGRESS",
      postponedAt: null,
      lastSavedAt: now,
      expectedVersion: existing.expectedVersion + 1,
    },
  });

  const contest = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await writeAudit({
    organizationId: contest.organizationId,
    contestId: input.contestId,
    actorJudgeId: input.judgeAccountId,
    eventType: "JURY_EVALUATION_POSTPONE_RESUMED",
    entityType: "FotorankJuryEvaluation",
    entityId: evaluation.id,
    payload: { snapshotId: snapshot.id, anonymousCode: snapshot.anonymousCode },
  });

  return { evaluation, idempotent: false as const };
}

/**
 * Abstención controlada del jurado: no cuenta como score (VOIDED + prefijo ABSTAIN).
 * Requiere razón. Idempotente si ya abstuvo.
 */
export async function abstainJuryEvaluation(input: {
  judgeAccountId: string;
  contestId: string;
  snapshotId: string;
  reason: string;
  reasonCode?:
    | "CONFLICT"
    | "TECHNICAL_COMPETENCE"
    | "DISPLAY_ISSUE"
    | "SENSITIVE_CONTENT"
    | "OTHER";
}) {
  if (!input.reason.trim()) {
    throw new JuryError("REASON_REQUIRED", "La abstención requiere motivo.", 400);
  }
  const access = await assertJudgeContestAccess({
    judgeAccountId: input.judgeAccountId,
    contestId: input.contestId,
  });
  const session = await loadOpenSession(input.contestId);
  if (!session) {
    throw new JuryError("SESSION_CLOSED", "No hay sesión OPEN.", 403);
  }
  const snapshot = await prisma.fotorankJuryEntrySnapshot.findFirst({
    where: {
      id: input.snapshotId,
      contestId: input.contestId,
      admissionBatchId: session.admissionBatchId,
    },
  });
  if (!snapshot) throw new JuryError("SNAPSHOT_NOT_FOUND", "Snapshot no encontrado.", 404);
  if (!access.categoryIds.includes(snapshot.categoryId)) {
    throw new JuryError("CATEGORY_NOT_ASSIGNED", "Categoría no asignada.", 403);
  }
  const assignment = access.assignments.find((a) => a.categoryId === snapshot.categoryId);
  if (!assignment) throw new JuryError("NOT_ASSIGNED", "Sin asignación.", 403);

  const existing = await prisma.fotorankJuryEvaluation.findUnique({
    where: {
      assignmentId_juryEntrySnapshotId: {
        assignmentId: assignment.id,
        juryEntrySnapshotId: snapshot.id,
      },
    },
  });
  if (existing?.status === "SUBMITTED" || existing?.status === "LOCKED") {
    throw new JuryError("EVALUATION_LOCKED", "Ya enviada; no se puede abstener.", 409);
  }
  const voidReason = `ABSTAIN:${input.reasonCode ?? "OTHER"}:${input.reason.trim()}`.slice(0, 500);
  if (existing?.status === "VOIDED" && existing.voidReason?.startsWith("ABSTAIN:")) {
    return { evaluation: existing, idempotent: true as const };
  }

  const evaluation = existing
    ? await prisma.fotorankJuryEvaluation.update({
        where: { id: existing.id },
        data: {
          status: "VOIDED",
          voidedAt: new Date(),
          voidReason,
          totalScore: null,
          normalizedScore: null,
        },
      })
    : await prisma.fotorankJuryEvaluation.create({
        data: {
          id: newId(),
          contestId: input.contestId,
          scoringSessionId: session.id,
          admissionBatchId: session.admissionBatchId,
          juryEntrySnapshotId: snapshot.id,
          assignmentId: assignment.id,
          jurorId: input.judgeAccountId,
          rubricId: session.rubricId,
          rubricVersion: session.rubric.version,
          status: "VOIDED",
          voidedAt: new Date(),
          voidReason,
          startedAt: new Date(),
          engineVersion: JURY_SCORING_ENGINE_VERSION,
        },
      });

  const contestRow = await prisma.fotorankContest.findUniqueOrThrow({
    where: { id: input.contestId },
    select: { organizationId: true },
  });
  await writeAudit({
    organizationId: contestRow.organizationId,
    contestId: input.contestId,
    actorJudgeId: input.judgeAccountId,
    eventType: "JURY_EVALUATION_ABSTAINED",
    entityType: "FotorankJuryEvaluation",
    entityId: evaluation.id,
    payload: {
      reasonCode: input.reasonCode ?? "OTHER",
      snapshotId: snapshot.id,
      anonymousCode: snapshot.anonymousCode,
    },
  });
  return { evaluation, idempotent: false as const };
}
