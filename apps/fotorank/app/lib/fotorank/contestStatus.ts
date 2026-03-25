/**
 * Estados del concurso y módulos.
 * Fuente de verdad para la UI del dashboard.
 */

import { CONTEST_STATUSES_ALLOWING_JUDGE_EVALUATION } from "./judgeEvaluationEligibility";

export const CONTEST_STATUS = {
  DRAFT: "DRAFT",
  SETUP_IN_PROGRESS: "SETUP_IN_PROGRESS",
  READY_TO_PUBLISH: "READY_TO_PUBLISH",
  PUBLISHED: "PUBLISHED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
  ACTIVE: "ACTIVE", // Legacy → tratar como PUBLISHED
} as const;

export const MODULE_STATUS = {
  NOT_STARTED: "NOT_STARTED",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETE: "COMPLETE",
} as const;

export const CONTEST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  SETUP_IN_PROGRESS: "En configuración",
  READY_TO_PUBLISH: "Listo para publicar",
  PUBLISHED: "Publicado",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
  ACTIVE: "Publicado", // Legacy
};

export const MODULE_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "No iniciado",
  IN_PROGRESS: "En progreso",
  COMPLETE: "Completo",
};

export type ContestStatus = (typeof CONTEST_STATUS)[keyof typeof CONTEST_STATUS];
export type ModuleStatus = (typeof MODULE_STATUS)[keyof typeof MODULE_STATUS];

export function formatContestStatus(status: string): string {
  return CONTEST_STATUS_LABELS[status] ?? status;
}

/** Alineado con `getJudgeEvaluationEligibility` (misma fuente: `judgeEvaluationEligibility`). */
export function contestStatusAllowsJudgeEvaluation(status: string): boolean {
  return CONTEST_STATUSES_ALLOWING_JUDGE_EVALUATION.has(status);
}
