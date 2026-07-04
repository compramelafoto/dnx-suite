/**
 * Servicio de idempotencia y logging para webhooks de Mercado Pago.
 * Garantiza que cada paymentId se procese una sola vez.
 */

import { prisma } from "@/lib/prisma";

export interface WebhookProcessResult {
  alreadyProcessed: boolean;
  webhookEventId?: number;
}

/**
 * Verifica si el webhook para este paymentId ya fue procesado.
 * Si no existe, crea el registro y retorna { alreadyProcessed: false }.
 * Si ya existe, retorna { alreadyProcessed: true }.
 */
export async function ensureWebhookIdempotency(
  paymentId: string,
  params: {
    orderId?: number;
    orderType?: string;
    status?: string;
    externalRef?: string;
    payloadHash?: string;
    rawPayload?: object;
  }
): Promise<WebhookProcessResult> {
  const existing = await prisma.webhookEvent.findUnique({
    where: { paymentId },
    select: { id: true },
  });

  if (existing) {
    return { alreadyProcessed: true, webhookEventId: existing.id };
  }

  const created = await prisma.webhookEvent.create({
    data: {
      paymentId,
      orderId: params.orderId ?? undefined,
      orderType: params.orderType ?? undefined,
      status: params.status ?? undefined,
      externalRef: params.externalRef ?? undefined,
      payloadHash: params.payloadHash ?? undefined,
      rawPayload: params.rawPayload ?? undefined,
    },
    select: { id: true },
  });

  return { alreadyProcessed: false, webhookEventId: created.id };
}
