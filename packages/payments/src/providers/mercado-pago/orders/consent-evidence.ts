import type { SplitConsentStatus } from "../../../contracts/entities.js";
import {
  ConsentNotActiveError,
  PaymentProviderError,
} from "../../../errors/provider-errors.js";

/**
 * Evidence that a partner may appear in an MP Split 1:N Order.
 * Must come from persistence / remote consent API — never invent ACTIVE.
 */
export interface PartnerConsentEvidence {
  /** MP Split consent receiver_id (UUID). */
  receiverId: string;
  status: SplitConsentStatus;
  provider: "mercadopago";
  /** Optional expiry; when set and past `now`, treated as expired. */
  expiresAt?: string | Date | null;
  /**
   * Explicit test/sandbox fixture marker.
   * Production adapters must never set this; validators reject fixture ACTIVE
   * unless `allowTestFixtures` is true.
   */
  testFixture?: boolean;
  /** Opaque local consent row id when available. */
  consentRecordId?: string;
}

export class ConsentRequiredError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "CONSENT_REQUIRED", message, retryable: false });
    this.name = "ConsentRequiredError";
  }
}

export class ConsentExpiredError extends PaymentProviderError {
  constructor(message: string) {
    super({ code: "CONSENT_EXPIRED", message, retryable: false });
    this.name = "ConsentExpiredError";
  }
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Assert every partner recipient has ACTIVE, non-expired Mercado Pago consent
 * evidence matching the receiver UUID that will be sent in splits[].
 */
export function assertPartnerConsentsForSplitOrder(input: {
  partnerReceiverIds: Map<string, string>;
  partnerConsentsByRecipientId: Map<string, PartnerConsentEvidence>;
  now?: Date;
  allowTestFixtures?: boolean;
}): void {
  const now = input.now ?? new Date();

  for (const [recipientId, receiverId] of input.partnerReceiverIds) {
    const evidence = input.partnerConsentsByRecipientId.get(recipientId);
    if (!evidence) {
      throw new ConsentRequiredError(
        `CONSENT_REQUIRED: missing consent evidence for partner recipient ${recipientId}`,
      );
    }

    if (evidence.provider !== "mercadopago") {
      throw new ConsentNotActiveError(
        `CONSENT_NOT_ACTIVE: partner ${recipientId} consent provider must be mercadopago`,
      );
    }

    if (evidence.receiverId !== receiverId) {
      throw new ConsentNotActiveError(
        `CONSENT_NOT_ACTIVE: partner ${recipientId} consent receiver_id mismatch`,
      );
    }

    if (evidence.testFixture && !input.allowTestFixtures) {
      throw new ConsentNotActiveError(
        `CONSENT_NOT_ACTIVE: testFixture consent cannot be used outside allowTestFixtures`,
      );
    }

    if (evidence.status === "PENDING") {
      throw new ConsentRequiredError(
        `CONSENT_REQUIRED: partner ${recipientId} consent is PENDING`,
      );
    }

    if (evidence.status === "EXPIRED") {
      throw new ConsentExpiredError(
        `CONSENT_EXPIRED: partner ${recipientId} consent is EXPIRED`,
      );
    }

    if (evidence.status === "REJECTED" || evidence.status === "CANCELED") {
      throw new ConsentNotActiveError(
        `CONSENT_NOT_ACTIVE: partner ${recipientId} consent is ${evidence.status}`,
      );
    }

    if (evidence.status !== "ACTIVE") {
      throw new ConsentNotActiveError(
        `CONSENT_NOT_ACTIVE: partner ${recipientId} consent status ${String(evidence.status)}`,
      );
    }

    const expiresAt = toDate(evidence.expiresAt ?? null);
    if (expiresAt && expiresAt.getTime() <= now.getTime()) {
      throw new ConsentExpiredError(
        `CONSENT_EXPIRED: partner ${recipientId} consent expiresAt is in the past`,
      );
    }
  }
}

/** Explicit ACTIVE test fixture — only for unit/sandbox with allowTestFixtures. */
export function testActivePartnerConsent(
  receiverId: string,
  opts?: { expiresAt?: string | Date | null; consentRecordId?: string },
): PartnerConsentEvidence {
  return {
    receiverId,
    status: "ACTIVE",
    provider: "mercadopago",
    testFixture: true,
    ...(opts?.expiresAt !== undefined ? { expiresAt: opts.expiresAt } : {}),
    ...(opts?.consentRecordId ? { consentRecordId: opts.consentRecordId } : {}),
  };
}
