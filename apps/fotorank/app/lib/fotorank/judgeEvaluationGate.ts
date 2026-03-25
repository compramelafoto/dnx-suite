/**
 * Autorización y elegibilidad para evaluación jurado: una sola vía de carga + chequeo.
 * Usar en server actions, página de evaluación y cualquier mutación de voto.
 */

import { prisma } from "@repo/db";
import { getJudgeEvaluationEligibility } from "./judgeEvaluationEligibility";

/** Fila mínima de asignación + concurso para gate y persistencia de voto. */
export type JudgeAssignmentEvaluationRow = {
  id: string;
  judgeAccountId: string;
  organizationId: string;
  contestId: string;
  categoryId: string;
  assignmentStatus: string;
  methodType: string;
  methodConfigJson: unknown;
  allowVoteEdit: boolean;
  evaluationStartsAt: Date | null;
  evaluationEndsAt: Date | null;
  extendedEndsAt: Date | null;
  contest: { status: string };
};

export async function loadJudgeAssignmentScoped(
  assignmentId: string,
  judgeAccountId: string,
): Promise<JudgeAssignmentEvaluationRow | null> {
  return prisma.fotorankJudgeAssignment.findFirst({
    where: { id: assignmentId, judgeAccountId },
    select: {
      id: true,
      judgeAccountId: true,
      organizationId: true,
      contestId: true,
      categoryId: true,
      assignmentStatus: true,
      methodType: true,
      methodConfigJson: true,
      allowVoteEdit: true,
      evaluationStartsAt: true,
      evaluationEndsAt: true,
      extendedEndsAt: true,
      contest: { select: { status: true } },
    },
  });
}

export function eligibilityForLoadedAssignment(
  assignment: JudgeAssignmentEvaluationRow,
  viewer: { id: string; accountStatus: string },
  now: Date,
) {
  return getJudgeEvaluationEligibility({
    now,
    viewerJudgeAccountId: viewer.id,
    viewerAccountStatus: viewer.accountStatus,
    assignment: {
      judgeAccountId: assignment.judgeAccountId,
      assignmentStatus: assignment.assignmentStatus,
      evaluationStartsAt: assignment.evaluationStartsAt,
      evaluationEndsAt: assignment.evaluationEndsAt,
      extendedEndsAt: assignment.extendedEndsAt,
    },
    contestStatus: assignment.contest.status,
  });
}

export type JudgeEvaluationGateFailure = { ok: false; error: string };
export type JudgeEvaluationGateSuccess = { ok: true; assignment: JudgeAssignmentEvaluationRow };

/**
 * Carga la asignación solo si pertenece al jurado y aplica reglas de elegibilidad (cuenta, estado, ventana, concurso).
 */
export async function gateJudgeEvaluationForJudge(
  assignmentId: string,
  viewer: { id: string; accountStatus: string },
  now: Date = new Date(),
): Promise<JudgeEvaluationGateFailure | JudgeEvaluationGateSuccess> {
  const assignment = await loadJudgeAssignmentScoped(assignmentId, viewer.id);
  if (!assignment) {
    return { ok: false, error: "Asignación no encontrada." };
  }
  const eligibility = eligibilityForLoadedAssignment(assignment, viewer, now);
  if (!eligibility.allowed) {
    return { ok: false, error: eligibility.message };
  }
  return { ok: true, assignment };
}
