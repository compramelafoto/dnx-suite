/**
 * J-P1-07 — Fuente única de verdad: cuándo un jurado puede evaluar.
 * Carga de asignación acotada al jurado + aplicación de estas reglas: `judgeEvaluationGate.ts`.
 */

/** Estados de asignación desde los que se permite evaluar (nuevos votos o edición según allowVoteEdit). */
export const ASSIGNMENT_STATUSES_ALLOWED_FOR_EVALUATION = new Set([
  "ASSIGNED",
  "ACCEPTED",
  "IN_PROGRESS",
  "EXTENDED",
]);

/**
 * Estados de concurso (DB) en los que la evaluación jurado tiene sentido.
 * - PUBLISHED / ACTIVE (legacy): operación normal.
 * - CLOSED: concurso cerrado al flujo público; la ventana temporal de la asignación sigue mandando.
 * Excluye: DRAFT, SETUP_IN_PROGRESS, READY_TO_PUBLISH, ARCHIVED.
 */
export const CONTEST_STATUSES_ALLOWING_JUDGE_EVALUATION = new Set([
  "PUBLISHED",
  "ACTIVE",
  "CLOSED",
]);

export type JudgeEvaluationBlockCode =
  | "WRONG_JUDGE"
  | "ACCOUNT_NOT_ACTIVE"
  | "ASSIGNMENT_INACTIVE"
  | "ASSIGNMENT_COMPLETED"
  | "ASSIGNMENT_REJECTED"
  | "CONTEST_NOT_ELIGIBLE"
  | "WINDOW_NOT_STARTED"
  | "WINDOW_ENDED";

export type JudgeEvaluationEligibility =
  | { allowed: true }
  | { allowed: false; code: JudgeEvaluationBlockCode; message: string };

export function getJudgeEvaluationEligibility(params: {
  now: Date;
  viewerJudgeAccountId: string;
  /** Estado de FotorankJudgeAccount; debe ser ACTIVE para evaluar. */
  viewerAccountStatus: string;
  assignment: {
    judgeAccountId: string;
    assignmentStatus: string;
    evaluationStartsAt: Date | null;
    evaluationEndsAt: Date | null;
    extendedEndsAt: Date | null;
  };
  /** `FotorankContest.status` en bruto desde DB. */
  contestStatus: string;
}): JudgeEvaluationEligibility {
  if (params.assignment.judgeAccountId !== params.viewerJudgeAccountId) {
    return { allowed: false, code: "WRONG_JUDGE", message: "No tenés permiso para evaluar esta asignación." };
  }

  if (params.viewerAccountStatus !== "ACTIVE") {
    return { allowed: false, code: "ACCOUNT_NOT_ACTIVE", message: "Tu cuenta no está activa para evaluar." };
  }

  const st = params.assignment.assignmentStatus;
  if (!ASSIGNMENT_STATUSES_ALLOWED_FOR_EVALUATION.has(st)) {
    if (st === "COMPLETED") {
      return { allowed: false, code: "ASSIGNMENT_COMPLETED", message: "La evaluación de esta asignación ya finalizó." };
    }
    if (st === "REJECTED" || st === "REPLACED_BY_BACKUP") {
      return { allowed: false, code: "ASSIGNMENT_REJECTED", message: "No podés evaluar con esta asignación." };
    }
    return { allowed: false, code: "ASSIGNMENT_INACTIVE", message: "Tu asignación aún no está activa para evaluar." };
  }

  if (!CONTEST_STATUSES_ALLOWING_JUDGE_EVALUATION.has(params.contestStatus)) {
    return {
      allowed: false,
      code: "CONTEST_NOT_ELIGIBLE",
      message:
        "El concurso no está en una fase que permita evaluación (debe estar publicado, activo o cerrado).",
    };
  }

  const { evaluationStartsAt, evaluationEndsAt, extendedEndsAt } = params.assignment;
  const end = extendedEndsAt ?? evaluationEndsAt;
  if (evaluationStartsAt && params.now < evaluationStartsAt) {
    return { allowed: false, code: "WINDOW_NOT_STARTED", message: "La ventana de evaluación aún no inició." };
  }
  if (end && params.now > end) {
    return { allowed: false, code: "WINDOW_ENDED", message: "La ventana de evaluación está cerrada." };
  }

  return { allowed: true };
}
