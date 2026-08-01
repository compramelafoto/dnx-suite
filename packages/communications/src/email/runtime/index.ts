export {
  maskEmail,
  emailDomain,
} from "./mask";

export {
  parseAllowedRecipients,
  assertRecipientsAllowed,
  isRecipientAllowed,
  normalizeEmailAddress,
  isBasicEmailFormat,
  type RecipientAllowlistCheck,
} from "./allowlist";

export {
  parseControlledFromAddress,
  type ControlledFromAddress,
} from "./from-address";

export {
  loadResendEmailConfig,
  evaluateLiveSendGates,
  type ResendEmailConfig,
  type ResendEnvSource,
  type LoadResendEmailConfigResult,
} from "./config";

export {
  createSmokeIdempotencyKey,
  maskIdempotencyKey,
} from "./idempotency";

export {
  createResendEmailRuntime,
  createResendProviderFromEnvironment,
  type CreateResendEmailRuntimeOptions,
  type ResendEmailRuntime,
} from "./runtime";
