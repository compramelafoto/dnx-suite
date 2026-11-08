import {
  ConsentNotActiveError,
  PaymentProviderAuthError,
  PaymentProviderValidationError,
  ProductionWriteBlockedError,
  RecipientNotEligibleError,
} from "@repo/payments";
import { referenciaPedido } from "./decidir";
import type { MarcaPiloto } from "./snapshot";

/** Número del próximo intento de cobro de un pedido. */
export function siguienteIntento(marca: MarcaPiloto | null): number {
  return (marca?.intento ?? 0) + 1;
}

/**
 * Clave de idempotencia de un intento. Es la misma para un mismo intento: si el pedido a
 * Mercado Pago se repite (reintento de red), Mercado Pago devuelve la misma orden en vez de
 * cobrar otra vez.
 */
export function claveIntento(pedidoId: number, intento: number): string {
  return `${referenciaPedido(pedidoId)}-${intento}`;
}

/**
 * ¿El error al crear la orden garantiza que Mercado Pago no cobró?
 *
 * - "rechazo": Mercado Pago respondió que no (validación, tarjeta, permisos). El pedido se
 *   libera para probar con otra tarjeta.
 * - "incierto": se cortó la conexión, respondió con error de servidor, o falló la consulta
 *   posterior a crear la orden. Puede haber cobrado: el pedido queda trabado hasta verificar.
 *   Liberarlo acá es exactamente cómo se cobra dos veces.
 */
export function clasificarErrorCobro(err: unknown): "rechazo" | "incierto" {
  if (
    err instanceof PaymentProviderValidationError ||
    err instanceof PaymentProviderAuthError ||
    err instanceof ConsentNotActiveError ||
    err instanceof RecipientNotEligibleError ||
    err instanceof ProductionWriteBlockedError
  ) {
    return "rechazo";
  }
  return "incierto";
}
