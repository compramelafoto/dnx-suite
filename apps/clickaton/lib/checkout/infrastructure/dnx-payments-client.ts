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
  /** Verifica autenticidad de webhook normalizado (firma HMAC). */
  verifyWebhook(
    headers: Record<string, string | undefined>,
    rawBody: string,
  ): { ok: true; event: NormalizedPaymentEvent } | { ok: false; code: string };
  /** Aplica un evento ya verificado al store de órdenes (idempotente). */
  applyVerifiedEvent(event: NormalizedPaymentEvent): Promise<PaymentOrder | null>;
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
