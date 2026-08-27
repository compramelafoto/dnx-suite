/**
 * Política de procesamiento del webhook de pago.
 *
 * Decisiones puras. La verificación criptográfica de la firma la hace
 * `verifyMercadoPagoWebhookSignature` de `@repo/payments/next`; acá se decide
 * qué hacer con un pago ya verificado.
 *
 * Regla dura: la carga de fotografías se habilita **únicamente** con un pago
 * aprobado cuyo importe coincide con el esperado. Ante cualquier discrepancia
 * se registra y se deja en revisión manual, nunca se confirma por las dudas.
 */

import { paidAmountMatches } from "./money";

/** Estados que informa Mercado Pago para un pago. */
export type ProviderPaymentStatus =
  | "approved"
  | "pending"
  | "in_process"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | (string & {});

export type WebhookOutcome =
  /** Pago aprobado y verificado: confirmar inscripción y habilitar carga. */
  | { action: "CONFIRM"; paidMinor: number }
  /** Aprobado pero el importe no coincide: NO confirmar. */
  | { action: "FLAG_MISMATCH"; expectedMinor: number; paidMinor: number; message: string }
  /** Todavía no resuelto: dejar pendiente. */
  | { action: "KEEP_PENDING"; message: string }
  /** Rechazado o cancelado. */
  | { action: "MARK_FAILED"; message: string }
  /** Devuelto o contracargo: revertir habilitación. */
  | { action: "REVERSE"; message: string }
  /** Ya procesado: no repetir efectos. */
  | { action: "DUPLICATE" }
  /** Entorno equivocado: nunca aplicar. */
  | { action: "REJECT"; message: string };

export type WebhookDecisionInput = {
  status: ProviderPaymentStatus;
  /** Importe informado por MP, en pesos. */
  paidAmountFromProvider: number | null;
  /** Importe esperado, en minor units, calculado por el servidor. */
  expectedMinor: number;
  /** `live_mode` informado por MP. */
  liveMode: boolean | null;
  /** Entorno del proceso. */
  environment: "sandbox" | "production";
  /** El evento ya fue aplicado antes. */
  alreadyProcessed: boolean;
};

export function decideWebhookOutcome(input: WebhookDecisionInput): WebhookOutcome {
  // 1. Idempotencia primero: un reintento de MP no debe repetir efectos.
  if (input.alreadyProcessed) {
    return { action: "DUPLICATE" };
  }

  // 2. Guarda de entorno: un pago de producción jamás se aplica en sandbox
  //    y un pago de prueba jamás confirma una inscripción real.
  if (input.liveMode === true && input.environment === "sandbox") {
    return {
      action: "REJECT",
      message: "LIVE_MODE_FORBIDDEN: pago de producción recibido en entorno sandbox.",
    };
  }
  if (input.liveMode === false && input.environment === "production") {
    return {
      action: "REJECT",
      message: "TEST_MODE_FORBIDDEN: pago de prueba recibido en producción.",
    };
  }

  switch (input.status) {
    case "approved": {
      if (input.paidAmountFromProvider == null) {
        return {
          action: "FLAG_MISMATCH",
          expectedMinor: input.expectedMinor,
          paidMinor: 0,
          message: "Pago aprobado sin importe informado: requiere revisión manual.",
        };
      }
      const match = paidAmountMatches({
        expectedMinor: input.expectedMinor,
        paidAmountFromProvider: input.paidAmountFromProvider,
      });
      if (!match.ok) {
        return {
          action: "FLAG_MISMATCH",
          expectedMinor: match.expectedMinor,
          paidMinor: match.paidMinor,
          message:
            `Importe pagado (${match.paidMinor}) distinto del esperado (${match.expectedMinor}). ` +
            "No se confirma la inscripción automáticamente.",
        };
      }
      return { action: "CONFIRM", paidMinor: match.expectedMinor };
    }

    case "pending":
    case "in_process":
      return { action: "KEEP_PENDING", message: `Pago en estado "${input.status}".` };

    case "rejected":
    case "cancelled":
      return { action: "MARK_FAILED", message: `Pago ${input.status}.` };

    case "refunded":
    case "charged_back":
      return {
        action: "REVERSE",
        message: `Pago ${input.status}: revertir habilitación de carga.`,
      };

    default:
      return {
        action: "KEEP_PENDING",
        message: `Estado no reconocido: "${input.status}". Se deja pendiente.`,
      };
  }
}

/** Clave de idempotencia estable por pago. */
export function buildPaymentEventKey(input: {
  providerPaymentId: string;
  status: string;
}): string {
  return `fotorank_mp_${input.providerPaymentId}_${input.status}`;
}
