/**
 * Autorización y elegibilidad para evaluación jurado: una sola vía de carga + chequeo.
 * Usar en server actions, página de evaluación y cualquier mutación de voto.
 */

import { prisma } from "@repo/db";
import { getClickatonJuryPrisma } from "@repo/db/clickaton-jury-client";
import { getJudgeEvaluationEligibility } from "./judgeEvaluationEligibility";
import { platformForContest, type JuryPlatform } from "./jury/assignment-source";

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
  contest: { status: string; distributionChannel: string | null };
};

const ASSIGNMENT_SELECT = {
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
  contest: { select: { status: true, distributionChannel: true } },
} as const;

/**
 * Carga la asignación buscándola en las dos bases.
 *
 * El llamador sólo tiene un identificador: no puede saber de antemano si la
 * asignación es de un concurso propio o de una maratón de Clickatón. Por eso la
 * búsqueda es en cascada — primero la base propia, que es el caso más común —
 * y la plataforma viaja junto a la fila para que nadie tenga que deducirla de
 * nuevo más adelante.
 */
export async function loadJudgeAssignmentScoped(
  assignmentId: string,
  judgeAccountId: string,
): Promise<{ row: JudgeAssignmentEvaluationRow; platform: JuryPlatform } | null> {
  const own = await prisma.fotorankJudgeAssignment.findFirst({
    where: { id: assignmentId, judgeAccountId },
    select: ASSIGNMENT_SELECT,
  });
  if (own) {
    return {
      row: own,
      platform: platformForContest({
        distributionChannel: own.contest.distributionChannel,
      }),
    };
  }

  const clickatonPrisma = getClickatonJuryPrisma();
  if (!clickatonPrisma) return null;
  const external = await clickatonPrisma.fotorankJudgeAssignment.findFirst({
    where: { id: assignmentId, judgeAccountId },
    select: ASSIGNMENT_SELECT,
  });
  if (!external) return null;
  return { row: external, platform: "clickaton" };
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
export type JudgeEvaluationGateSuccess = {
  ok: true;
  assignment: JudgeAssignmentEvaluationRow;
  platform: JuryPlatform;
};

/**
 * Carga la asignación solo si pertenece al jurado y aplica reglas de elegibilidad (cuenta, estado, ventana, concurso).
 */
export async function gateJudgeEvaluationForJudge(
  assignmentId: string,
  viewer: { id: string; accountStatus: string },
  now: Date = new Date(),
): Promise<JudgeEvaluationGateFailure | JudgeEvaluationGateSuccess> {
  const loaded = await loadJudgeAssignmentScoped(assignmentId, viewer.id);
  if (!loaded) {
    return { ok: false, error: "Asignación no encontrada." };
  }
  const eligibility = eligibilityForLoadedAssignment(loaded.row, viewer, now);
  if (!eligibility.allowed) {
    return { ok: false, error: eligibility.message };
  }
  return { ok: true, assignment: loaded.row, platform: loaded.platform };
}
