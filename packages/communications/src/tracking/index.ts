export {
  TRACKING_EVENT_TYPES,
  type CommunicationTrackingStore,
  type RecordTrackingInput,
  type TrackingEvent,
  type TrackingEventType,
} from "./types";

export {
  createInMemoryTrackingStore,
  InMemoryTrackingStore,
} from "./in-memory-store";

export {
  COMMUNICATION_TRACKING_EVENT_TYPES,
  isCommunicationTrackingEventType,
  type CommunicationTrackingEventType,
} from "./events";

export type {
  CommunicationTrackingEvent,
  CommunicationTrackingEventHandler,
  CommunicationsWebhookMode,
  MaskedOrHashedRecipient,
  TrackingEventDeduplicator,
  TrackingFailureReason,
  TrackingHandlerResult,
  TrackingLinkData,
  WebhookProcessingResult,
  WebhookProcessingStatus,
  WebhookSignatureVerifier,
  WebhookVerificationResult,
} from "./contracts";

export {
  createInMemoryTrackingEventHandler,
  InMemoryTrackingEventHandler,
  type InMemoryTrackingHandlerOptions,
} from "./handler";

export {
  createInMemoryTrackingEventDeduplicator,
  InMemoryTrackingEventDeduplicator,
} from "./deduplicator";

export { createFakeWebhookSignatureVerifier } from "./signature";

export {
  maskProviderId,
  hashEmail,
  toMaskedRecipient,
  sanitizeTrackingMetadata,
  getHeader,
} from "./sanitize";

export { createNoopDeliveryPolicyHandler } from "./delivery-policy";

export {
  STAGING_TECHNICAL_TRACKING_EVENTS,
  BEHAVIORAL_TRACKING_EVENTS,
  isBehavioralTrackingEvent,
  parseAllowedTrackingEvents,
  parseDeclaredEnvironment,
  createStagingWebhookEnvironmentPolicy,
  resolveWebhookEnvironmentPolicy,
  admitTrackingEvent,
  type CommunicationWebhookEnvironmentPolicy,
  type CommunicationsDeclaredEnvironment,
  type EventAdmissionDecision,
} from "./environment-policy";

export {
  createNoopWebhookRateLimiter,
  createInMemoryWebhookRateLimiter,
  type CommunicationWebhookRateLimiter,
  type WebhookRateLimitConfig,
  type WebhookRateLimitResult,
} from "./rate-limit";

export {
  createNoopWebhookAlertSink,
  createTestWebhookAlertSink,
  createThresholdAlertTracker,
  type CommunicationWebhookAlert,
  type CommunicationWebhookAlertSink,
  type CommunicationWebhookAlertType,
  type WebhookAlertConfig,
  type TestWebhookAlertSink,
} from "./alerts";

export {
  createInMemoryWebhookReceiptRepository,
  InMemoryWebhookReceiptRepository,
  createHmacRecipientHasher,
  tryCreateHmacRecipientHasher,
  buildReceiptReservationFromEvent,
  buildIgnoredReservation,
  COMMUNICATION_WEBHOOK_RECEIPT_STATUSES,
  TERMINAL_WEBHOOK_RECEIPT_STATUSES,
  type CommunicationWebhookReceiptRepository,
  type CommunicationTrackingEventRepository,
  type CommunicationDeliveryPolicyHandler,
  type RecipientHasher,
  type StoredCommunicationTrackingEvent,
  type CommunicationWebhookReceiptStatus,
  type WebhookReceiptReserveResult,
} from "./persistence/index";
