import type { ClickatonRegistrationRecord } from "@/lib/registration/domain/types";
import type { PublicRegistrationRepository } from "@/lib/public-registration/domain/repository";

export type AttachPaymentRefsInput = {
  registrationId: string;
  paymentOrderId: string;
  paymentProvider: string;
  paymentExternalReference: string;
  paymentIdempotencyKey: string;
  paymentStatus: ClickatonRegistrationRecord["paymentStatus"];
};

export type ConfirmPaidInput = {
  registrationId: string;
  paymentOrderId: string;
  source: string;
  requestId: string;
  editionPrefix: string;
};

export type MarkPaymentStatusInput = {
  registrationId: string;
  paymentStatus: ClickatonRegistrationRecord["paymentStatus"];
  registrationStatus?: ClickatonRegistrationRecord["status"];
  source: string;
  reason: string;
  requestId: string;
  /** Importe acumulado reembolsado (minor units). */
  refundedAmountMinor?: number | null;
  /** Id de pago MP (soft ref). */
  providerPaymentId?: string | null;
  /** Último refund id MP conocido. */
  lastProviderRefundId?: string | null;
};

export type ReleaseForPaymentTerminalInput = {
  registrationId: string;
  paymentStatus: "CANCELLED" | "EXPIRED";
  source: string;
  requestId: string;
  now: Date;
};

/**
 * Puerto de efectos Clickatón sobre inscripción/holds.
 * Separado del cliente DNX Payments.
 */
export interface CheckoutRegistrationPort {
  getRegistration(id: string): Promise<ClickatonRegistrationRecord | null>;
  getEditionPrefix(editionId: string): Promise<string>;
  attachPaymentRefs(input: AttachPaymentRefsInput): Promise<ClickatonRegistrationRecord>;
  confirmPaid(input: ConfirmPaidInput): Promise<ClickatonRegistrationRecord>;
  markPaymentStatus(input: MarkPaymentStatusInput): Promise<ClickatonRegistrationRecord>;
  /**
   * Liberación por orden cancelada/expirada.
   * Misma mecánica de holds que 10D3F-B (ACTIVE→EXPIRED + reservedStock),
   * sin exigir que holdExpiresAt ya haya vencido.
   */
  releaseForPaymentTerminal(
    input: ReleaseForPaymentTerminalInput,
  ): Promise<ClickatonRegistrationRecord>;
  /** Reutiliza hardening 10D3F-B (liberación idempotente por vencimiento). */
  expireRegistration(input: {
    registrationId: string;
    now: Date;
  }): Promise<{ outcome: string }>;
  getHoldSnapshot(registrationId: string): Promise<{
    capacityHoldActive: boolean;
    stockHoldsActive: number;
  }>;
}

export type CheckoutRegistrationPortDeps = {
  publicRepo: PublicRegistrationRepository;
  /** Extensiones de mutación pago (memory/prisma). */
  mutations: CheckoutRegistrationMutations;
};

export type CheckoutRegistrationMutations = {
  attachPaymentRefs(input: AttachPaymentRefsInput): Promise<ClickatonRegistrationRecord>;
  confirmPaid(input: ConfirmPaidInput): Promise<ClickatonRegistrationRecord>;
  markPaymentStatus(input: MarkPaymentStatusInput): Promise<ClickatonRegistrationRecord>;
  releaseForPaymentTerminal(
    input: ReleaseForPaymentTerminalInput,
  ): Promise<ClickatonRegistrationRecord>;
  getEditionPrefix(editionId: string): Promise<string>;
};

export function createCheckoutRegistrationPort(
  deps: CheckoutRegistrationPortDeps,
): CheckoutRegistrationPort {
  const { publicRepo, mutations } = deps;
  return {
    getRegistration: (id) => publicRepo.getRegistration(id),
    getEditionPrefix: (editionId) => mutations.getEditionPrefix(editionId),
    attachPaymentRefs: (input) => mutations.attachPaymentRefs(input),
    confirmPaid: (input) => mutations.confirmPaid(input),
    markPaymentStatus: (input) => mutations.markPaymentStatus(input),
    releaseForPaymentTerminal: (input) => mutations.releaseForPaymentTerminal(input),
    expireRegistration: (input) =>
      publicRepo.expireRegistration({ ...input, dryRun: false }),
    getHoldSnapshot: (id) => publicRepo.getHoldSnapshot(id),
  };
}
