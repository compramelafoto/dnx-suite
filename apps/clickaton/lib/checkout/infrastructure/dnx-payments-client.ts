import type {
  CreatePaymentOrderInput,
  CreatePaymentOrderResult,
  NormalizedPaymentEvent,
  PaymentOrder,
} from "../domain/types";

/**
 * Cliente interno tipado hacia DNX Payments.
 * Clickatón no importa adaptadores concretos de Mercado Pago.
 */
export interface DnxPaymentsClient {
  createOrder(input: CreatePaymentOrderInput): Promise<CreatePaymentOrderResult>;
  getOrder(orderId: string): Promise<PaymentOrder | null>;
  refreshOrder(orderId: string): Promise<PaymentOrder | null>;
  /** Verifica autenticidad de webhook normalizado (firma HMAC DNX). */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): { ok: true; event: NormalizedPaymentEvent } | { ok: false; code: string };
  /** Aplica un evento ya verificado al store de órdenes (idempotente). */
  applyVerifiedEvent(event: NormalizedPaymentEvent): Promise<PaymentOrder | null>;
  /**
   * Opcional: Webhooks firmados Mercado Pago (x-signature) → S2S → DNX.
   * Presente en el cliente durable; ausente en fake in-memory.
   */
  ingestMercadoPagoSignedWebhook?(input: {
    headers: Record<string, string | undefined>;
    rawBody: string;
    queryDataId?: string | null;
    queryType?: string | null;
    queryTopic?: string | null;
  }): Promise<
    | {
        ok: true;
        event: NormalizedPaymentEvent;
        apply: {
          outcome: string;
          conflictCode?: string;
        };
      }
    | {
        ok: true;
        observed: true;
        outcome: "processed" | "duplicate";
        mismatchCount?: number;
        /** Present when Orders observe yields a normalized fulfillment event. */
        event?: NormalizedPaymentEvent;
      }
    | { ok: false; code: string }
  >;
}

export type FakeProviderScenario =
  | "created"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "expired"
  | "timeout"
  | "temporary_error"
  | "unknown_order"
  | "amount_mismatch"
  | "currency_mismatch";
