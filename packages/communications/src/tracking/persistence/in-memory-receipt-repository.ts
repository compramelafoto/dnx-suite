import { randomUUID } from "node:crypto";
import type { CommunicationWebhookReceiptRepository } from "./contracts";
import {
  TERMINAL_WEBHOOK_RECEIPT_STATUSES,
  type StoredCommunicationTrackingEvent,
  type WebhookReceiptFailedInput,
  type WebhookReceiptProcessedInput,
  type WebhookReceiptReservationInput,
  type WebhookReceiptReserveResult,
} from "./types";

function keyOf(provider: string, providerEventId: string): string {
  return `${provider}::${providerEventId}`;
}

/**
 * Recibo in-memory para tests.
 * NO apto para producción / serverless multi-instancia.
 */
export class InMemoryWebhookReceiptRepository
  implements CommunicationWebhookReceiptRepository
{
  private readonly byKey = new Map<string, StoredCommunicationTrackingEvent>();
  private failNextReserve = false;

  failReserveOnce(): void {
    this.failNextReserve = true;
  }

  reset(): void {
    this.byKey.clear();
    this.failNextReserve = false;
  }

  size(): number {
    return this.byKey.size;
  }

  async findByProviderEventId(input: {
    provider: string;
    providerEventId: string;
  }): Promise<StoredCommunicationTrackingEvent | null> {
    return this.byKey.get(keyOf(input.provider, input.providerEventId)) ?? null;
  }

  async reserve(
    input: WebhookReceiptReservationInput,
  ): Promise<WebhookReceiptReserveResult> {
    if (this.failNextReserve) {
      this.failNextReserve = false;
      throw new Error("SIMULATED_DB_FAILURE");
    }

    const key = keyOf(input.provider, input.providerEventId);
    const existing = this.byKey.get(key);
    if (existing) {
      if (
        existing.status === "failed" &&
        !TERMINAL_WEBHOOK_RECEIPT_STATUSES.includes(existing.status)
      ) {
        // unreachable — failed is not terminal in our list; allow retry
      }
      if (existing.status === "failed") {
        const updated: StoredCommunicationTrackingEvent = {
          ...existing,
          status: "received",
          processingAttempts: existing.processingAttempts + 1,
          lastErrorCode: undefined,
          updatedAt: new Date(),
        };
        this.byKey.set(key, updated);
        return { kind: "retry", record: updated };
      }
      if (TERMINAL_WEBHOOK_RECEIPT_STATUSES.includes(existing.status)) {
        return { kind: "duplicate", record: existing };
      }
      return { kind: "duplicate", record: existing };
    }

    const now = new Date();
    const record: StoredCommunicationTrackingEvent = {
      id: randomUUID(),
      provider: input.provider,
      providerEventId: input.providerEventId,
      providerMessageId: input.providerMessageId,
      rawEventType: input.rawEventType,
      normalizedEventType: input.normalizedEventType,
      status: input.initialStatus === "ignored" ? "ignored" : "received",
      occurredAt: input.occurredAt,
      receivedAt: input.receivedAt,
      recipientMasked: input.recipientMasked,
      recipientHash: input.recipientHash,
      safeLinkHost: input.safeLinkHost,
      safeLinkPath: input.safeLinkPath,
      failureCategory: input.failureCategory,
      failureReasonCode: input.failureReasonCode,
      processingAttempts: 1,
      productEffectsEnabled: false,
      createdAt: now,
      updatedAt: now,
    };
    this.byKey.set(key, record);
    return { kind: "reserved", record };
  }

  async markProcessed(input: WebhookReceiptProcessedInput): Promise<void> {
    for (const [key, record] of this.byKey) {
      if (record.id === input.id) {
        this.byKey.set(key, {
          ...record,
          status: input.status,
          processedAt: input.processedAt ?? new Date(),
          updatedAt: new Date(),
          lastErrorCode: undefined,
        });
        return;
      }
    }
  }

  async markFailed(input: WebhookReceiptFailedInput): Promise<void> {
    for (const [key, record] of this.byKey) {
      if (record.id === input.id) {
        this.byKey.set(key, {
          ...record,
          status: "failed",
          lastErrorCode: input.errorCode.slice(0, 80),
          updatedAt: input.failedAt ?? new Date(),
        });
        return;
      }
    }
  }
}

export function createInMemoryWebhookReceiptRepository(): InMemoryWebhookReceiptRepository {
  return new InMemoryWebhookReceiptRepository();
}
