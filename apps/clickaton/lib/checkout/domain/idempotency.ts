import { createHash } from "node:crypto";
import type { CreatePaymentOrderInput } from "./types";

/** Hash estable del payload comercial (sin URLs volátiles de query). */
export function hashCreateOrderPayload(input: CreatePaymentOrderInput): string {
  const stable = {
    sourceApp: input.sourceApp,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    amountMinor: input.amountMinor,
    currency: input.currency,
    description: input.description,
    payerEmail: input.payer?.email?.trim().toLowerCase() ?? null,
    successPath: stripQuery(input.successUrl),
    pendingPath: stripQuery(input.pendingUrl),
    failurePath: stripQuery(input.failureUrl),
    distributionVersionId:
      input.editionFinance?.snapshot.distributionVersionId ?? null,
    agreementId: input.editionFinance?.snapshot.agreementId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function stripQuery(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url.split("?")[0] ?? url;
  }
}

/**
 * Key estable por inscripción + intento de cobro.
 * No regenerar en cada clic: reutilizar paymentIdempotencyKey de la reserva.
 */
export function buildCheckoutIdempotencyKey(input: {
  registrationId: string;
  reservationIdempotencyKey: string;
  attempt: number;
}): string {
  return `clickaton:reg:${input.registrationId}:pay:${input.reservationIdempotencyKey}:a${input.attempt}`;
}
