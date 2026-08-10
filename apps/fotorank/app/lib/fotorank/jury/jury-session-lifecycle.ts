/**
 * ETAPA 16B — Orquestación de apertura/cierre de sesión de jurado con checklist previo.
 * Envoltorio delgado sobre `scoring-session-service` (Etapa 14/16A): agrega el gate de
 * `evaluatePreJuryReadiness`, confirmación explícita y auditoría dedicada. No reimplementa
 * el motor de sesión existente.
 */
import { prisma } from "@repo/db";
import { JuryError } from "./errors";
import { assertJuryActivationAllowed } from "./commercial-contest-guard";
import { evaluatePreJuryReadiness } from "./pre-jury-readiness";
import { ensureDraftScoringSession, openScoringSession, closeScoringSession, getCoverageReport } from "./scoring-session-service";

async function writeLifecycleAudit(input: {
  contestId: string;
  actorUserId: number;
  eventType: string;
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
      entityType: "FotorankJuryScoringSession",
      entityId: input.entityId,
      payloadJson: (input.payload ?? {}) as object,
    },
  });
}

/**
 * Abre la sesión de jurado. Requiere `evaluatePreJuryReadiness` en READY_FOR_JURY.
 * `confirmationPhrase` es un gesto explícito de doble confirmación (UI); se audita, no se valida
 * contra un valor fijo (no hay "frase secreta" del producto en esta etapa).
 */
export async function openJurySession(input: {
  contestId: string;
  actorUserId: number;
  confirmationPhrase?: string | null;
}) {
  assertJuryActivationAllowed(input.contestId);

  const readiness = await evaluatePreJuryReadiness(input.contestId);
  if (readiness.status !== "READY_FOR_JURY") {
    throw new JuryError(
      "READINESS_BLOCKED",
      `No se puede abrir jurado: ${readiness.reasons.map((r) => r.code).join(", ")}.`,
      409,
    );
  }

  const admissionBatch = await prisma.fotorankAdmissionBatch.findFirstOrThrow({
    where: { contestId: input.contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
  });

  const session = await ensureDraftScoringSession({
    contestId: input.contestId,
    admissionBatchId: admissionBatch.id,
    actorUserId: input.actorUserId,
  });

  const opened = await openScoringSession({
    contestId: input.contestId,
    sessionId: session.id,
    actorUserId: input.actorUserId,
  });

  await writeLifecycleAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_LIFECYCLE_OPENED",
    entityId: opened.id,
    payload: {
      admissionBatchId: admissionBatch.id,
      confirmationPhraseProvided: Boolean(input.confirmationPhrase),
      readinessChecks: Object.keys(readiness.checks),
    },
  });

  return { session: opened, readiness };
}

/**
 * Cierra la sesión de jurado. BLOCKS si cobertura < 100%, hay conflictos activos sin resolver
 * o evaluaciones POSTPONED pendientes que rompen cobertura (§7.2/§7.6 master rules).
 */
export async function closeJurySession(input: { contestId: string; actorUserId: number }) {
  assertJuryActivationAllowed(input.contestId);

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "No hay sesión de jurado OPEN para cerrar.", 404);

  const coverage = await getCoverageReport(input.contestId, session.id);
  const postponedCount = await prisma.fotorankJuryEvaluation.count({
    where: { scoringSessionId: session.id, status: "POSTPONED" },
  });
  if (postponedCount > 0) {
    throw new JuryError(
      "COVERAGE_INCOMPLETE",
      `Hay ${postponedCount} evaluación(es) POSTPONED pendiente(s) de revisión. Resolvé antes de cerrar.`,
      409,
    );
  }

  const closed = await closeScoringSession({
    contestId: input.contestId,
    sessionId: session.id,
    actorUserId: input.actorUserId,
    force: false,
  });

  await writeLifecycleAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_LIFECYCLE_CLOSED",
    entityId: closed.id,
    payload: { coverage },
  });

  return { session: closed, coverage };
}

/**
 * Cierre forzado (Super Admin) con motivo obligatorio. NO calcula finalistas automáticamente
 * si la cobertura está incompleta — eso requiere una llamada explícita y separada a
 * `selectFinalistsPerPrompt` (finalists-engine), que a su vez valida cobertura por consigna.
 */
export async function forceCloseJurySession(input: {
  contestId: string;
  actorUserId: number;
  reason: string;
}) {
  assertJuryActivationAllowed(input.contestId);
  if (!input.reason || input.reason.trim().length === 0) {
    throw new JuryError("REASON_REQUIRED", "El cierre forzado requiere un motivo.", 400);
  }

  const session = await prisma.fotorankJuryScoringSession.findFirst({
    where: { contestId: input.contestId, status: "OPEN" },
    orderBy: { openedAt: "desc" },
  });
  if (!session) throw new JuryError("SESSION_NOT_FOUND", "No hay sesión de jurado OPEN para cerrar.", 404);

  const closed = await closeScoringSession({
    contestId: input.contestId,
    sessionId: session.id,
    actorUserId: input.actorUserId,
    force: true,
    reason: input.reason,
  });

  await writeLifecycleAudit({
    contestId: input.contestId,
    actorUserId: input.actorUserId,
    eventType: "JURY_LIFECYCLE_FORCE_CLOSED",
    entityId: closed.id,
    payload: { reason: input.reason, finalistsComputed: false },
  });

  return { session: closed };
}
