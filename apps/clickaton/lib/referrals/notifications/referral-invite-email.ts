import "server-only";

/**
 * Envía a cada participante su link de invitación.
 *
 * Es una plantilla reutilizable: sirve para el anuncio inicial y para
 * recordarlo cada tanto. La `campaignKey` distingue cada envío, de modo que la
 * cola idempotente no bloquee el segundo por parecerse al primero.
 *
 * El contenido vive en `referral-invite-content`, aparte, para poder
 * previsualizarlo y probarlo sin tocar el proveedor de correo.
 */
import {
  enqueueAndSendIdempotentEmail,
  type EmailDeliveryOutcome,
} from "@/lib/registration/notifications/email-delivery";
import { resolveGiftRecipient } from "@/lib/gift-vouchers/notifications/gift-email";
import {
  isClickatonProductionAudience,
  resolveClickatonPublicOrigin,
} from "@/lib/site/public-origin";
import { PRODUCTION_SITE_ORIGIN } from "@/lib/registration/ui/post-payment-public-copy";

import { buildReferralInviteContent } from "./referral-invite-content";

export const REFERRAL_INVITE_TEMPLATE_KEY = "CLICKATON_REFERRAL_INVITE";

function baseUrl(): string {
  if (isClickatonProductionAudience()) return PRODUCTION_SITE_ORIGIN;
  return resolveClickatonPublicOrigin().replace(/\/$/, "");
}

/** Una clave por persona y por campaña: el reenvío de otro mes no se bloquea. */
export function referralInviteIdempotencyKey(input: {
  userId: number;
  campaignKey: string;
}): string {
  return `${input.userId}:${REFERRAL_INVITE_TEMPLATE_KEY}:${input.campaignKey}`;
}

export type ReferralInviteEmailInput = {
  userId: number;
  to: string;
  firstName: string | null;
  /** El código propio, ya creado. */
  code: string;
  /** Amigos que ya se sumaron por su link. */
  colegas: number;
  /** Identifica el envío: `lanzamiento-2026-09`, `recordatorio-2026-11`, … */
  campaignKey: string;
};

export async function sendReferralInviteEmail(
  input: ReferralInviteEmailInput,
): Promise<EmailDeliveryOutcome> {
  const { subject, text, html } = buildReferralInviteContent({
    firstName: input.firstName,
    code: input.code,
    colegas: input.colegas,
    baseUrl: baseUrl(),
  });

  return enqueueAndSendIdempotentEmail({
    idempotencyKey: referralInviteIdempotencyKey({
      userId: input.userId,
      campaignKey: input.campaignKey,
    }),
    // Mismo resguardo que el resto: desde staging no se le escribe a nadie real.
    to: resolveGiftRecipient(input.to),
    // En entornos que no son producción el asunto va marcado.
    subject: isClickatonProductionAudience() ? subject : `[TEST] ${subject}`,
    text,
    html,
    templateKey: REFERRAL_INVITE_TEMPLATE_KEY,
    templateData: {
      userId: input.userId,
      code: input.code,
      campaignKey: input.campaignKey,
    },
  });
}
