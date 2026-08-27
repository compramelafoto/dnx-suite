/**
 * Procesamiento del webhook de pago — capa con acceso a datos.
 *
 * Secuencia, en este orden y sin atajos:
 *   1. Verificar la firma HMAC de Mercado Pago.
 *   2. Consultar el pago server-to-server (nunca se confía en el cuerpo).
 *   3. Localizar la inscripción por `external_reference`.
 *   4. Decidir con `decideWebhookOutcome` (política pura, ya testeada).
 *   5. Aplicar el efecto de forma idempotente.
 *
 * Sólo un pago aprobado cuyo importe coincide exactamente confirma la
 * inscripción y habilita la carga de fotografías.
 */

import { prisma } from "@repo/db";
import { verifyMercadoPagoWebhookSignature } from "@repo/payments/mercado-pago/webhook-signature";

import { checkConfigReadiness } from "./config";
import { getPayment } from "./mp-client";
import { buildPaymentEventKey, decideWebhookOutcome } from "./webhook-policy";

export type WebhookResult = {
  ok: boolean;
  code: string;
  applied?: boolean;
  duplicate?: boolean;
  httpStatus: number;
};

export async function processPaymentWebhook(input: {
  headers: { signature: string | null; requestId: string | null };
  dataId: string | null;
  type: string | null;
  now?: Date;
}): Promise<WebhookResult> {
  const readiness = checkConfigReadiness();
  if (!readiness.ready) {
    // Sin configuración no se procesa nada, pero se responde 200 para que
    // Mercado Pago no reintente indefinidamente contra un endpoint inactivo.
    return { ok: true, code: "CHECKOUT_NOT_CONFIGURED", httpStatus: 200 };
  }
  const config = readiness.config;

  // Sólo notificaciones de pago.
  const type = (input.type ?? "").toLowerCase();
  if (type && !type.startsWith("payment")) {
    return { ok: true, code: "IGNORED_TYPE", httpStatus: 200 };
  }
  if (!input.dataId) {
    return { ok: false, code: "MISSING_DATA_ID", httpStatus: 400 };
  }

  // 1. Firma. Sin firma válida no se procesa: nunca se acepta un aviso sin verificar.
  const verified = verifyMercadoPagoWebhookSignature({
    signatureHeader: input.headers.signature ?? undefined,
    requestIdHeader: input.headers.requestId ?? undefined,
    dataId: input.dataId,
    secret: config.webhookSecret ?? undefined,
  });
  if (!verified.ok) {
    return { ok: false, code: `INVALID_SIGNATURE:${verified.reason}`, httpStatus: 401 };
  }

  // 2. Estado real del pago, consultado a la API.
  const payment = await getPayment({
    accessToken: config.accessToken!,
    paymentId: input.dataId,
  });

  // 3. Inscripción asociada.
  if (!payment.externalReference) {
    return { ok: false, code: "MISSING_EXTERNAL_REFERENCE", httpStatus: 422 };
  }
  const registration = await prisma.fotorankContestRegistration.findUnique({
    where: { id: payment.externalReference },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      registrationPriceSnapshot: true,
      paymentOrderId: true,
    },
  });
  if (!registration) {
    return { ok: false, code: "REGISTRATION_NOT_FOUND", httpStatus: 404 };
  }

  // 4. Decisión. Idempotencia: el mismo pago en el mismo estado no se reaplica.
  const eventKey = buildPaymentEventKey({
    providerPaymentId: payment.id,
    status: payment.status,
  });
  const alreadyProcessed = registration.paymentOrderId === eventKey;

  const outcome = decideWebhookOutcome({
    status: payment.status,
    paidAmountFromProvider: payment.transactionAmount,
    expectedMinor: registration.registrationPriceSnapshot,
    liveMode: payment.liveMode,
    environment: config.environment,
    alreadyProcessed,
  });

  const now = input.now ?? new Date();

  // 5. Efectos.
  switch (outcome.action) {
    case "DUPLICATE":
      return { ok: true, code: "DUPLICATE", duplicate: true, httpStatus: 200 };

    case "REJECT":
      return { ok: false, code: "ENVIRONMENT_MISMATCH", httpStatus: 401 };

    case "CONFIRM":
      await prisma.fotorankContestRegistration.update({
        where: { id: registration.id },
        data: {
          status: "CONFIRMED",
          paymentStatus: "PAID",
          confirmedAt: registration.status === "CONFIRMED" ? undefined : now,
          paymentOrderId: eventKey,
        },
      });
      return { ok: true, code: "CONFIRMED", applied: true, httpStatus: 200 };

    case "FLAG_MISMATCH":
      // No se confirma: queda pendiente y con rastro para revisión manual.
      await prisma.fotorankContestRegistration.update({
        where: { id: registration.id },
        data: { paymentStatus: "PENDING", paymentOrderId: eventKey },
      });
      return { ok: true, code: "AMOUNT_MISMATCH", applied: false, httpStatus: 200 };

    case "MARK_FAILED":
      await prisma.fotorankContestRegistration.update({
        where: { id: registration.id },
        data: { paymentStatus: "FAILED", paymentOrderId: eventKey },
      });
      return { ok: true, code: "PAYMENT_FAILED", applied: true, httpStatus: 200 };

    case "REVERSE":
      // Devolución o contracargo: se revierte la habilitación.
      await prisma.fotorankContestRegistration.update({
        where: { id: registration.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "REFUNDED",
          cancelledAt: now,
          paymentOrderId: eventKey,
        },
      });
      return { ok: true, code: "REVERSED", applied: true, httpStatus: 200 };

    case "KEEP_PENDING":
    default:
      return { ok: true, code: "PENDING", applied: false, httpStatus: 200 };
  }
}
