export * from "./errors";
export * from "./serialize-entry-for-juror";
export * from "./jury-technical-summary";
export * from "./jury-order";
export * from "./jury-access";
export * from "./jury-service";
export * from "./scoring-engine";
export {
  upsertJuryEvaluation,
  voidJuryEvaluation,
  abstainJuryEvaluation,
  postponeJuryEvaluation,
  resumePostponedEvaluation,
} from "./evaluation-service";
export {
  ensureDraftRubric,
  activateRubric,
  ensureDraftScoringSession,
  openScoringSession,
  closeScoringSession,
  getCoverageReport,
  computeAndStorePreliminaryAggregates,
  exportJuryProgressCsv,
  exportBlindAggregatesCsv,
  exportAdminEvaluationsCsv,
} from "./scoring-session-service";
export * from "./permissions";
export * from "./capacity-calculator";
export { enqueueJuryNotificationIntent } from "./notification-intents";
export type { JuryNotificationKind } from "./notification-intents";
export {
  SANTA_FE_EN_FOCO_JURY_CRITERIA,
  SANTA_FE_MIN_EVALUATIONS_PER_ENTRY,
  SANTA_FE_JURY_TERMS_VERSION,
  SANTA_FE_PRIORITY_CRITERION_KEY,
} from "./santa-fe-en-foco-rubric";
export {
  CLICKATON_2026_JURY_CRITERIA,
  CLICKATON_2026_FINALISTS_PER_PROMPT,
  CLICKATON_2026_MAX_FINALISTS,
  CLICKATON_MIN_EVALUATIONS_PER_ENTRY,
  CLICKATON_MIN_VALID_ENTRIES,
  CLICKATON_RECOMMENDED_MAX_ENTRIES_PER_JUDGE,
} from "./clickaton-2026-rubric";
export { acceptJuryTerms, hasAcceptedJuryTerms } from "./jury-terms";
export {
  acceptConflictAndReassign,
  dismissJuryConflict,
  countValidEvaluationsForCoverage,
} from "./conflict-reassign-service";

// ETAPA 16A — elegibilidad competitiva, capacidad, distribución automática, actividad/ETA,
// confirmación de bloque, ranking provisorio y desempate con jurado adicional.
export {
  getOrCreateCompetitionJuryConfig,
  upsertCompetitionJuryConfig,
  isClickatonJuryContest,
} from "./competition-jury-config";
export type { CompetitionJuryConfigInput } from "./competition-jury-config";
export {
  freezeCompetitiveEligibility,
  listJuryEligibleParticipantIds,
} from "./competitive-eligibility-service";
export type { CompetitiveStatus } from "./competitive-eligibility-service";
export { distributeJuryEvaluations } from "./auto-distribution";
export type { DistributeJuryEvaluationsResult } from "./auto-distribution";
export { recordJuryActivityHeartbeat, computeJudgeEta } from "./activity-eta";
export type { JudgeEtaInput, JudgeEtaResult } from "./activity-eta";
export { confirmJudgeEvaluationBlock } from "./block-confirm";
export type { ConfirmJudgeEvaluationBlockResult } from "./block-confirm";
export { getOrganizerProvisionalRanking, PROVISIONAL_RESULT_BANNER } from "./provisional-ranking";
export type { OrganizerProvisionalRanking, ProvisionalRankingRow } from "./provisional-ranking";
export { requestExtraJudgeTiebreak } from "./tiebreak-extra-judge";
export type { TiebreakAssignmentOutcome } from "./tiebreak-extra-judge";

// ETAPA 16B — finalistas (§8 master rules), paquete de confirmación y preparación de voto
// público (§9–§10). NO activa jurado/resultados/voto público comercial por sí sola.
export { assertJuryActivationAllowed, COMMERCIAL_CONTEST_ID_BLOCKED } from "./commercial-contest-guard";
export { assertNoPiiInFinalistMetadata } from "./finalist-pii-guard";
export { evaluatePreJuryReadiness } from "./pre-jury-readiness";
export type {
  PreJuryReadinessResult,
  PreJuryReadinessReasonCode,
  PreJuryReadinessCheck,
} from "./pre-jury-readiness";
export { openJurySession, closeJurySession, forceCloseJurySession } from "./jury-session-lifecycle";
export { selectFinalistsPerPrompt } from "./finalists-engine";
export type { FinalistsSelectionResult, FinalistPromptResult } from "./finalists-engine";
export { buildFinalistPackage, confirmFinalistsForPublicVote, revokeFinalist } from "./finalist-package";
export { getPublicVoteConfig, upsertPublicVoteConfig } from "./public-vote-config";
export type { PublicVoteConfigInput } from "./public-vote-config";
export { evaluatePrePublicVoteReadiness } from "./pre-public-vote-readiness";
export type {
  PrePublicVoteReadinessResult,
  PrePublicVoteReasonCode,
} from "./pre-public-vote-readiness";
export {
  prepareFinalistPublicAssets,
  markFinalistAssetFailed,
  getDefaultSocialAssetPolicy,
} from "./public-asset-prep";
export type { SocialAssetPolicy } from "./public-asset-prep";
export { getFinalistsForReview } from "./finalists-review";
export type { FinalistsReviewResult } from "./finalists-review";
