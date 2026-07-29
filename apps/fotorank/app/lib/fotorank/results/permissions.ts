export const RESULT_CAPABILITIES = [
  "canViewPreliminaryResults",
  "canManageResultRules",
  "canGenerateResultBatch",
  "canReviewResultBatch",
  "canResolveResultTies",
  "canAssignResultAwards",
  "canExcludeResultEntry",
  "canFinalizeContestResults",
  "canResolveResultIdentity",
  "canExportBlindResults",
  "canExportAdminResults",
  "canApproveResultPublication",
] as const;

export type ResultCapability = (typeof RESULT_CAPABILITIES)[number];

export const ORGANIZER_DEFAULT_RESULT_CAPS: readonly ResultCapability[] = [
  "canViewPreliminaryResults",
  "canManageResultRules",
  "canGenerateResultBatch",
  "canReviewResultBatch",
  "canResolveResultTies",
  "canAssignResultAwards",
  "canExcludeResultEntry",
  "canExportBlindResults",
] as const;

export const SENSITIVE_RESULT_CAPS: readonly ResultCapability[] = [
  "canFinalizeContestResults",
  "canResolveResultIdentity",
  "canExportAdminResults",
  "canApproveResultPublication",
] as const;

export function hasResultCapability(
  granted: readonly string[] | null | undefined,
  capability: ResultCapability,
  opts?: { isContestOrganizer?: boolean },
): boolean {
  if (granted?.includes(capability)) return true;
  if (opts?.isContestOrganizer && ORGANIZER_DEFAULT_RESULT_CAPS.includes(capability)) {
    return true;
  }
  return false;
}
