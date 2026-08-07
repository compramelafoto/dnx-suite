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
  createContestRegistration,
  getMyContestRegistration,
  listMyRegistrations,
  cancelMyContestRegistration,
  countConfirmedRegistrations,
  assertOrganizerCanAccessContest,
  type CreateRegistrationInput,
  type RegistrationDTO,
} from "./registration-service";
export {
  registrationNeedsRulesReacceptance,
  getRulesReacceptanceStatus,
  acceptCurrentPublishedRules,
  assertRegistrationAcceptedCurrentRules,
  type RulesReacceptanceStatus,
} from "./rules-reacceptance";
