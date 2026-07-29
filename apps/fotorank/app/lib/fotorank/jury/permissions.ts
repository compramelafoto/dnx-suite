/**
 * Capacidades de jurado / scoring (Etapa 14).
 * No se otorgan a todos los administradores automáticamente.
 * El organizador del concurso obtiene el set operativo básico;
 * scores individuales / export / void / reopen requieren grant explícito.
 */

export const JURY_CAPABILITIES = [
  "canManageContestJurors",
  "canInviteContestJurors",
  "canAssignContestJurors",
  "canManageJuryRubrics",
  "canViewJuryProgress",
  "canCloseJuryScoring",
  "canResolveJuryIdentity",
  "canReopenJuryScoring",
  "canViewAggregatedScores",
  "canViewIndividualJurorScores",
  "canExportJuryScores",
  "canVoidJuryEvaluation",
  "canReopenJuryEvaluation",
] as const;

export type JuryCapability = (typeof JURY_CAPABILITIES)[number];

/** Set operativo del organizador (sin ver scores individuales ni void/reopen). */
export const ORGANIZER_DEFAULT_JURY_CAPS: readonly JuryCapability[] = [
  "canManageContestJurors",
  "canInviteContestJurors",
  "canAssignContestJurors",
  "canManageJuryRubrics",
  "canViewJuryProgress",
  "canCloseJuryScoring",
] as const;

/** Caps sensibles — requieren grant explícito (metadata / membership). */
export const SENSITIVE_JURY_CAPS: readonly JuryCapability[] = [
  "canResolveJuryIdentity",
  "canReopenJuryScoring",
  "canViewAggregatedScores",
  "canViewIndividualJurorScores",
  "canExportJuryScores",
  "canVoidJuryEvaluation",
  "canReopenJuryEvaluation",
] as const;

export function hasJuryCapability(
  granted: readonly string[] | null | undefined,
  capability: JuryCapability,
  opts?: { isContestOrganizer?: boolean },
): boolean {
  if (granted?.includes(capability)) return true;
  if (opts?.isContestOrganizer && ORGANIZER_DEFAULT_JURY_CAPS.includes(capability)) {
    return true;
  }
  return false;
}

/** El jurado nunca tiene caps de organización. */
export const JUROR_ALLOWED_ACTIONS = [
  "viewOwnAssignments",
  "viewAssignedEntries",
  "autosaveEvaluation",
  "submitEvaluation",
  "viewOwnComments",
  "declareConflict",
  "finalizeOwnEvaluation",
] as const;
