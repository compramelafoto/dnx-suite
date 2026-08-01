import { prisma } from "@repo/db";
import {
  handleResendWebhookRequest,
  toNextResponse,
} from "@/lib/communications/resend-webhook/handle-request";
import { createPrismaCommunicationWebhookReceiptRepository } from "@/lib/communications/resend-webhook/prisma-receipt-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * TEMPORARY_WEBHOOK_HOST — Clickatón adapter HTTP para Resend webhooks.
 *
 * URL prevista:
 *   staging: https://clickaton-staging.vercel.app/api/webhooks/resend
 *   prod:    https://maratonfotografica.com/api/webhooks/resend
 *
 * Default: feature flag OFF → 404.
 * Modo validado: verify_only (sin efectos de negocio / analytics).
 *
 * Migración futura: mover a host canónico DNX Communications sin cambiar
 * el contrato externo (misma path relativa + secret + raw body).
 */
export async function POST(request: Request) {
  const receiptRepository = createPrismaCommunicationWebhookReceiptRepository(
    prisma as unknown as Parameters<
      typeof createPrismaCommunicationWebhookReceiptRepository
    >[0],
  );

  const result = await handleResendWebhookRequest({
    request,
    env: process.env,
    receiptRepository,
  });

  return toNextResponse(result);
}

export async function GET() {
  return toNextResponse({
    status: 405,
    body: { received: false, status: "method_not_allowed" },
    headers: {
      "Cache-Control": "no-store",
      Allow: "POST",
    },
  });
}
