/**
 * Adaptador de email preparado.
 * No simula envíos exitosos: la app debe cablear Resend / EmailQueue.
 */

import type { NotificationDeliveryPlan } from "../contracts";

export type EmailDeliveryRequest = {
  toUserId: number;
  subject: string;
  textBody: string;
  htmlBody?: string;
  ctaUrl: string;
};

export type EmailDeliveryResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; errorCode: string; message: string };

export interface EmailNotificationAdapter {
  /** Debe encolar o enviar de verdad. Nunca devolver ok sin infra. */
  deliver(request: EmailDeliveryRequest): Promise<EmailDeliveryResult>;
}

/**
 * Stub seguro: siempre falla con CHANNEL_NOT_WIRED.
 * Evita afirmar éxito externo sin infraestructura.
 */
export class UnwiredEmailAdapter implements EmailNotificationAdapter {
  async deliver(request: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    void request;
    return {
      ok: false,
      errorCode: "CHANNEL_NOT_IMPLEMENTED",
      message:
        "Adaptador de email no cableado. Usar EmailQueue/Resend de la app; no simular éxito.",
    };
  }
}

export function toEmailRequest(plan: NotificationDeliveryPlan): EmailDeliveryRequest {
  const toUserId = Number(plan.recipient.userId);
  if (!Number.isFinite(toUserId)) {
    throw new Error("Destinatario email sin userId numérico.");
  }
  return {
    toUserId,
    subject: plan.title,
    textBody: `${plan.body}\n\n${plan.ctaLabel}: ${plan.ctaUrl}`,
    ctaUrl: plan.ctaUrl,
  };
}
