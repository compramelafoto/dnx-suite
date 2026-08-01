export { EmailProvider } from "./email-provider";
export type { EmailAddress, EmailMessage, EmailSendResult } from "./types";
export {
  createResendClientAdapter,
  createResendProvider,
  ResendProvider,
  type ResendClientLike,
  type ResendProviderOptions,
  type ResendSendPayload,
  type ResendSendResponse,
} from "./providers/index";

/** Helpers de runtime sin SDK (allowlist, mask, config). */
export {
  maskEmail,
  emailDomain,
  parseAllowedRecipients,
  assertRecipientsAllowed,
  isRecipientAllowed,
  normalizeEmailAddress,
  isBasicEmailFormat,
  parseControlledFromAddress,
  loadResendEmailConfig,
  evaluateLiveSendGates,
  createSmokeIdempotencyKey,
  maskIdempotencyKey,
  type ControlledFromAddress,
  type ResendEmailConfig,
  type ResendEnvSource,
  type LoadResendEmailConfigResult,
  type RecipientAllowlistCheck,
} from "./runtime/public";
