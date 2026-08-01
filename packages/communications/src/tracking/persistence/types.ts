import type { CommunicationTrackingEventType } from "../events";

/**
 * Estados durables del recibo webhook.
 * No confundir con WebhookProcessingResult.status del processor.
 */
export const COMMUNICATION_WEBHOOK_RECEIPT_STATUSES = [
  "received",
  "verified",
  "processed",
  "ignored",
  "duplicate",
  "failed",
] as const;

export type CommunicationWebhookReceiptStatus =
  (typeof COMMUNICATION_WEBHOOK_RECEIPT_STATUSES)[number];

/** Terminales: no deben re-ejecutar handler / verify effects. */
export const TERMINAL_WEBHOOK_RECEIPT_STATUSES: readonly CommunicationWebhookReceiptStatus[] =
  ["verified", "processed", "ignored", "duplicate"];

export type StoredCommunicationTrackingEvent = {
  id: string;
  provider: string;
  providerEventId: string;
  providerMessageId?: string;
  rawEventType: string;
  normalizedEventType?: CommunicationTrackingEventType;
  status: CommunicationWebhookReceiptStatus;
  occurredAt?: Date;
  receivedAt: Date;
  processedAt?: Date;
  recipientMasked?: string;
  recipientHash?: string;
  safeLinkHost?: string;
  safeLinkPath?: string;
  failureCategory?: string;
  failureReasonCode?: string;
  processingAttempts: number;
  lastErrorCode?: string;
  /** Siempre false en Imp06 — opens/clicks no alimentan producto. */
  productEffectsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type WebhookReceiptReservationInput = {
  provider: string;
  providerEventId: string;
  providerMessageId?: string;
  rawEventType: string;
  normalizedEventType?: CommunicationTrackingEventType;
  occurredAt?: Date;
  receivedAt: Date;
  recipientMasked?: string;
  recipientHash?: string;
  safeLinkHost?: string;
  safeLinkPath?: string;
  failureCategory?: string;
  failureReasonCode?: string;
  /** Intent inicial: received (soportado) o ignored (no soportado). */
  initialStatus?: "received" | "ignored";
};

export type WebhookReceiptReserveResult =
  | { kind: "reserved"; record: StoredCommunicationTrackingEvent }
  | { kind: "duplicate"; record: StoredCommunicationTrackingEvent }
  | { kind: "retry"; record: StoredCommunicationTrackingEvent };

export type WebhookReceiptProcessedInput = {
  id: string;
  status: "verified" | "processed" | "ignored";
  processedAt?: Date;
};

export type WebhookReceiptFailedInput = {
  id: string;
  errorCode: string;
  failedAt?: Date;
};
