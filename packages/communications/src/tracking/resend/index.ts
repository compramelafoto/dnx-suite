/**
 * Subpath: `@repo/communications/tracking/resend`
 *
 * Adapter Resend webhook → dominio de tracking.
 * El verifier real importa el SDK; no usar desde el entrypoint raíz.
 */

export {
  RESEND_EMAIL_WEBHOOK_TYPES,
  DEFAULT_WEBHOOK_MAX_BYTES,
  type ResendEmailWebhookType,
  type ResendWebhookEnvelope,
  type ResendWebhookData,
  type ResendWebhookClickData,
  type ResendWebhookBounceData,
} from "./types";

export {
  parseResendWebhookPayload,
  assertValidOccurredAt,
  type ParseResendWebhookResult,
} from "./parser";

export {
  normalizeResendWebhookEvent,
  RESEND_TO_DNX_EVENT_MAP,
  type NormalizeResendResult,
} from "./normalize";

export { normalizeClickedUrl } from "./click-url";

export {
  loadResendWebhookConfig,
  type ResendWebhookConfig,
  type LoadResendWebhookConfigResult,
} from "./config";

export {
  createResendWebhookProcessor,
  type CreateResendWebhookProcessorOptions,
  type ProcessResendWebhookInput,
  type ResendWebhookProcessor,
} from "./processor";

export {
  createResendSdkWebhookSignatureVerifier,
  type CreateResendSdkWebhookSignatureVerifierOptions,
  type ResendWebhookVerifyApi,
} from "./verifier";

export {
  loadResendWebhookFixture,
  fixtureHeaders,
  resolveFixtureName,
  FIXTURE_EVENT_FILES,
  type FixtureEventName,
} from "./__fixtures__/index";

export { createNoopDeliveryPolicyHandler } from "../delivery-policy";

export {
  STAGING_TECHNICAL_TRACKING_EVENTS,
  BEHAVIORAL_TRACKING_EVENTS,
  createStagingWebhookEnvironmentPolicy,
  admitTrackingEvent,
  type CommunicationWebhookEnvironmentPolicy,
} from "../environment-policy";
