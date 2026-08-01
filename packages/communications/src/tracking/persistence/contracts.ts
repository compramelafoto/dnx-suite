import type { CommunicationTrackingEvent } from "../contracts";
import type {
  StoredCommunicationTrackingEvent,
  WebhookReceiptFailedInput,
  WebhookReceiptProcessedInput,
  WebhookReceiptReservationInput,
  WebhookReceiptReserveResult,
} from "./types";

/**
 * Repositorio de eventos de tracking normalizados (puerto de dominio).
 * No acoplado a Prisma.
 */
export type CommunicationTrackingEventRepository = {
  findByProviderEventId(input: {
    provider: string;
    providerEventId: string;
  }): Promise<StoredCommunicationTrackingEvent | null>;

  create(
    event: CommunicationTrackingEvent,
    extras?: {
      status?: StoredCommunicationTrackingEvent["status"];
      recipientHash?: string;
      productEffectsEnabled?: boolean;
    },
  ): Promise<StoredCommunicationTrackingEvent>;
};

/**
 * Recibo atómico de webhooks — preferir sobre find→create.
 * Unique (provider, providerEventId) en la implementación durable.
 */
export type CommunicationWebhookReceiptRepository = {
  reserve(
    input: WebhookReceiptReservationInput,
  ): Promise<WebhookReceiptReserveResult>;

  markProcessed(input: WebhookReceiptProcessedInput): Promise<void>;

  markFailed(input: WebhookReceiptFailedInput): Promise<void>;

  findByProviderEventId(input: {
    provider: string;
    providerEventId: string;
  }): Promise<StoredCommunicationTrackingEvent | null>;
};

/**
 * Extensión futura: exclusiones por bounce/complaint.
 * Imp06: stub — no bloquea destinatarios.
 */
export type CommunicationDeliveryPolicyHandler = {
  onBounced?(event: CommunicationTrackingEvent): Promise<void>;
  onComplained?(event: CommunicationTrackingEvent): Promise<void>;
  onFailed?(event: CommunicationTrackingEvent): Promise<void>;
  onSuppressed?(event: CommunicationTrackingEvent): Promise<void>;
};

export type RecipientHasher = {
  hash(email: string): string;
};
