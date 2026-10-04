import "server-only";
import { createMercadoPagoCheckoutProLiveAdapter } from "@repo/payments/mercado-pago";
import { resolveWorkspaceCollector } from "@/lib/payments/connect/collector";
import { sanitizeError } from "@/lib/payments/connect/log";
import { creditStorePayment, type CreditStorePaymentResult } from "./credit-payment";
import { parseStoreExternalReference, storeExternalReference } from "./external-reference";

/**
 * Preguntarle a Mercado Pago por el pago de un pedido y, si está aprobado, acreditarlo. Lo usan
 * la página del pedido (a la vuelta del comprador, con el `payment_id` que trae la dirección) y
 * la conciliación del cron (buscando por la referencia externa).
 *
 * Nunca se confía en lo que trae la dirección: el pago se lee con el token de la institución, y
 * sólo cuenta si su referencia externa nombra a ESTE pedido.
 */

/** ¿Mercado Pago dice que el pago está aprobado? Módulo PURO. */
export function isApprovedMpPayment(pago: { status: string; rawSanitized: Record<string, unknown> }): boolean {
  const crudo = pago.rawSanitized.status;
  if (typeof crudo === "string") return crudo === "approved";
  return pago.status === "APPROVED";
}

/**
 * Lo que la acreditación necesita de un pago leído en Mercado Pago: id, monto, moneda y cuándo
 * se aprobó (`date_approved`; null si no viene o no se entiende). Módulo PURO.
 */
export function storePaymentFacts(pago: {
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  rawSanitized: Record<string, unknown>;
}): { providerPaymentId: string; amountMinor: number; currency: string; paidAt: Date | null } {
  const crudo = pago.rawSanitized.date_approved;
  const fecha = typeof crudo === "string" ? new Date(crudo) : null;
  return {
    providerPaymentId: pago.providerPaymentId,
    amountMinor: pago.amountMinor,
    currency: pago.currency,
    paidAt: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
  };
}

export type StorePaymentCheck =
  | { outcome: "credited"; result: CreditStorePaymentResult }
  /** Hay pago de este pedido, pero no aprobado (pendiente, rechazado…). */
  | { outcome: "not_approved" }
  /** Mercado Pago no tiene un pago de este pedido. */
  | { outcome: "no_payment" }
  /** La institución no tiene los cobros habilitados: no hay a quién preguntarle. */
  | { outcome: "no_collector" }
  /** Mercado Pago no respondió (o no reconoce el pago con el token de esta institución). */
  | { outcome: "unavailable" }
  /** El pago está APROBADO pero acreditarlo falló: la plata entró y el pedido no lo dice. */
  | { outcome: "credit_failed" };

export async function checkStoreOrderPayment(input: {
  workspaceId: string;
  orderId: string;
  /** Si viene, se lee ese pago; si no, se busca por la referencia externa del pedido. */
  providerPaymentId?: string | null;
}): Promise<StorePaymentCheck> {
  const collector = await resolveWorkspaceCollector(input.workspaceId);
  if (!collector.ok) return { outcome: "no_collector" };

  const adapter = createMercadoPagoCheckoutProLiveAdapter({ accessToken: collector.collector.accessToken });
  let pago;
  try {
    pago = input.providerPaymentId
      ? await adapter.getPayment(input.providerPaymentId)
      : await adapter.searchPaymentsByExternalReference(storeExternalReference(input.orderId));
  } catch (error) {
    // Un `payment_id` inventado, o de otra institución, también cae acá: no es un error nuestro.
    console.warn("[fotoffice][tienda] no se pudo consultar el pago en Mercado Pago", {
      storeOrderId: input.orderId,
      detalle: sanitizeError(error),
    });
    return { outcome: "unavailable" };
  }
  if (!pago) return { outcome: "no_payment" };
  if (parseStoreExternalReference(pago.externalReference) !== input.orderId) return { outcome: "no_payment" };
  if (!isApprovedMpPayment(pago)) return { outcome: "not_approved" };

  try {
    const result = await creditStorePayment({ orderId: input.orderId, ...storePaymentFacts(pago) });
    return { outcome: "credited", result };
  } catch (error) {
    console.error("[fotoffice][tienda] falló la acreditación de un pago aprobado", {
      storeOrderId: input.orderId,
      detalle: sanitizeError(error),
    });
    return { outcome: "credit_failed" };
  }
}
