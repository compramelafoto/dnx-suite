import type {
  CommunicationWebhookReceiptRepository,
  CommunicationWebhookReceiptStatus,
  StoredCommunicationTrackingEvent,
  WebhookReceiptFailedInput,
  WebhookReceiptProcessedInput,
  WebhookReceiptReservationInput,
  WebhookReceiptReserveResult,
} from "@repo/communications/tracking/persistence";

type PrismaStatus =
  | "RECEIVED"
  | "VERIFIED"
  | "PROCESSED"
  | "IGNORED"
  | "DUPLICATE"
  | "FAILED";

type Row = {
  id: string;
  provider: string;
  providerEventId: string;
  providerMessageId: string | null;
  rawEventType: string;
  normalizedEventType: string | null;
  status: PrismaStatus;
  occurredAt: Date | null;
  receivedAt: Date;
  processedAt: Date | null;
  recipientMasked: string | null;
  recipientHash: string | null;
  safeLinkHost: string | null;
  safeLinkPath: string | null;
  failureCategory: string | null;
  failureReasonCode: string | null;
  processingAttempts: number;
  lastErrorCode: string | null;
  productEffectsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Superficie mínima del delegate Prisma — inyectable / testeable sin @prisma/client en dominio.
 */
export type DnxCommunicationWebhookEventDelegate = {
  findUnique(args: {
    where: {
      provider_providerEventId: { provider: string; providerEventId: string };
    };
  }): Promise<Row | null>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<Row>;
};

export type PrismaClientLike = {
  dnxCommunicationWebhookEvent: DnxCommunicationWebhookEventDelegate;
};

const STATUS_TO_DOMAIN: Record<PrismaStatus, CommunicationWebhookReceiptStatus> =
  {
    RECEIVED: "received",
    VERIFIED: "verified",
    PROCESSED: "processed",
    IGNORED: "ignored",
    DUPLICATE: "duplicate",
    FAILED: "failed",
  };

const STATUS_TO_PRISMA: Record<CommunicationWebhookReceiptStatus, PrismaStatus> =
  {
    received: "RECEIVED",
    verified: "VERIFIED",
    processed: "PROCESSED",
    ignored: "IGNORED",
    duplicate: "DUPLICATE",
    failed: "FAILED",
  };

function mapRow(row: Row): StoredCommunicationTrackingEvent {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.providerEventId,
    providerMessageId: row.providerMessageId ?? undefined,
    rawEventType: row.rawEventType,
    normalizedEventType: row.normalizedEventType as
      | StoredCommunicationTrackingEvent["normalizedEventType"]
      | undefined,
    status: STATUS_TO_DOMAIN[row.status],
    occurredAt: row.occurredAt ?? undefined,
    receivedAt: row.receivedAt,
    processedAt: row.processedAt ?? undefined,
    recipientMasked: row.recipientMasked ?? undefined,
    recipientHash: row.recipientHash ?? undefined,
    safeLinkHost: row.safeLinkHost ?? undefined,
    safeLinkPath: row.safeLinkPath ?? undefined,
    failureCategory: row.failureCategory ?? undefined,
    failureReasonCode: row.failureReasonCode ?? undefined,
    processingAttempts: row.processingAttempts,
    lastErrorCode: row.lastErrorCode ?? undefined,
    productEffectsEnabled: row.productEffectsEnabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  return code === "P2002";
}

/**
 * Adapter Prisma del recibo webhook Communications.
 * Vive en el host temporal (Clickatón) — no contamina el dominio del package.
 */
export function createPrismaCommunicationWebhookReceiptRepository(
  prisma: PrismaClientLike,
): CommunicationWebhookReceiptRepository {
  const delegate = prisma.dnxCommunicationWebhookEvent;

  return {
    async findByProviderEventId(input) {
      const row = await delegate.findUnique({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId: input.providerEventId,
          },
        },
      });
      return row ? mapRow(row) : null;
    },

    async reserve(
      input: WebhookReceiptReservationInput,
    ): Promise<WebhookReceiptReserveResult> {
      const existing = await delegate.findUnique({
        where: {
          provider_providerEventId: {
            provider: input.provider,
            providerEventId: input.providerEventId,
          },
        },
      });

      if (existing) {
        if (existing.status === "FAILED") {
          const updated = await delegate.update({
            where: { id: existing.id },
            data: {
              status: "RECEIVED",
              processingAttempts: existing.processingAttempts + 1,
              lastErrorCode: null,
              rawEventType: input.rawEventType,
              normalizedEventType: input.normalizedEventType ?? null,
              updatedAt: new Date(),
            },
          });
          return { kind: "retry", record: mapRow(updated) };
        }
        return { kind: "duplicate", record: mapRow(existing) };
      }

      const initialStatus: PrismaStatus =
        input.initialStatus === "ignored" ? "IGNORED" : "RECEIVED";

      try {
        const created = await delegate.create({
          data: {
            provider: input.provider,
            providerEventId: input.providerEventId,
            providerMessageId: input.providerMessageId ?? null,
            rawEventType: input.rawEventType,
            normalizedEventType: input.normalizedEventType ?? null,
            status: initialStatus,
            occurredAt: input.occurredAt ?? null,
            receivedAt: input.receivedAt,
            recipientMasked: input.recipientMasked ?? null,
            recipientHash: input.recipientHash ?? null,
            safeLinkHost: input.safeLinkHost ?? null,
            safeLinkPath: input.safeLinkPath ?? null,
            failureCategory: input.failureCategory ?? null,
            failureReasonCode: input.failureReasonCode ?? null,
            processingAttempts: 1,
            productEffectsEnabled: false,
          },
        });
        return { kind: "reserved", record: mapRow(created) };
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const raced = await delegate.findUnique({
          where: {
            provider_providerEventId: {
              provider: input.provider,
              providerEventId: input.providerEventId,
            },
          },
        });
        if (!raced) throw error;
        if (raced.status === "FAILED") {
          const updated = await delegate.update({
            where: { id: raced.id },
            data: {
              status: "RECEIVED",
              processingAttempts: raced.processingAttempts + 1,
              lastErrorCode: null,
              updatedAt: new Date(),
            },
          });
          return { kind: "retry", record: mapRow(updated) };
        }
        return { kind: "duplicate", record: mapRow(raced) };
      }
    },

    async markProcessed(input: WebhookReceiptProcessedInput): Promise<void> {
      await delegate.update({
        where: { id: input.id },
        data: {
          status: STATUS_TO_PRISMA[input.status],
          processedAt: input.processedAt ?? new Date(),
          lastErrorCode: null,
          updatedAt: new Date(),
        },
      });
    },

    async markFailed(input: WebhookReceiptFailedInput): Promise<void> {
      await delegate.update({
        where: { id: input.id },
        data: {
          status: "FAILED",
          lastErrorCode: input.errorCode.slice(0, 80),
          updatedAt: input.failedAt ?? new Date(),
        },
      });
    },
  };
}
