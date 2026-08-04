export { RegistrationError, type RegistrationErrorCode } from "./errors";
export {
  resolveFinancePolicy,
  assertValidBps,
  assertNonNegativePrice,
  type ResolvedFinancePolicy,
  type ResolveFinanceInput,
} from "./finance";
export {
  hashRulesContent,
  normalizeRulesContent,
  contentContainsPlaceholder,
  RULES_PLACEHOLDER_MARKER,
} from "./rules-hash";
export { buildRegistrationNumber } from "./registration-number";
export { normalizeInstagramHandle, validateInstagramHandle } from "./instagram";
export { assertRegistrationWindowOpen } from "./windows";
export {
  getCurrentPublishedRules,
  publishRulesVersion,
  assertRulesVersionMutable,
  listRulesVersionsForContest,
  createRulesDraft,
  updateRulesDraft,
  publishExistingRulesDraft,
  archiveRulesVersion,
  type PublishedRulesVersion,
  type RulesVersionListItem,
} from "./rules-service";
export {
  gatePlaceholderContent,
  isFotorankProductionEnvironment,
  contentHasCriticalPlaceholder,
  detectPlaceholders,
} from "./production-gate";
export {
  SANTA_FE_LEGAL_STATUS,
  SANTA_FE_TERMS_VERSION,
  SANTA_FE_PRIVACY_VERSION,
  SANTA_FE_CONSENT_VERSION,
  SANTA_FE_LEGAL_PATHS,
} from "./santa-fe-legal-versions";
export {
  createContestRegistration,
  getMyContestRegistration,
  listMyRegistrations,
  cancelMyContestRegistration,
  countConfirmedRegistrations,
  assertOrganizerCanAccessContest,
  type CreateRegistrationInput,
  type RegistrationDTO,
} from "./registration-service";
