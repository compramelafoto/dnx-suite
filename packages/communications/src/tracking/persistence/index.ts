export type {
  CommunicationDeliveryPolicyHandler,
  CommunicationTrackingEventRepository,
  CommunicationWebhookReceiptRepository,
  RecipientHasher,
} from "./contracts";

export {
  COMMUNICATION_WEBHOOK_RECEIPT_STATUSES,
  TERMINAL_WEBHOOK_RECEIPT_STATUSES,
  type CommunicationWebhookReceiptStatus,
  type StoredCommunicationTrackingEvent,
  type WebhookReceiptFailedInput,
  type WebhookReceiptProcessedInput,
  type WebhookReceiptReservationInput,
  type WebhookReceiptReserveResult,
} from "./types";

export {
  createHmacRecipientHasher,
  tryCreateHmacRecipientHasher,
} from "./hmac";

export {
  buildIgnoredReservation,
  buildReceiptReservationFromEvent,
} from "./map-event";

export {
  createInMemoryWebhookReceiptRepository,
  InMemoryWebhookReceiptRepository,
} from "./in-memory-receipt-repository";
