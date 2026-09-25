import "server-only";

/**
 * Manda el correo de presentación a un fotógrafo de otra plataforma de la casa.
 *
 * El contenido vive aparte, en `outreach-invite-content`, para poder
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

import {
  buildOutreachInviteContent,
  type OrigenOutreach,
} from "./outreach-invite-content";

export const OUTREACH_INVITE_TEMPLATE_KEY = "CLICKATON_OUTREACH_INVITE";

function baseUrl(): string {
  if (isClickatonProductionAudience()) return PRODUCTION_SITE_ORIGIN;
  return resolveClickatonPublicOrigin().replace(/\/$/, "");
}

export function outreachInviteIdempotencyKey(input: {
  email: string;
  campaignKey: string;
}): string {
  return `${input.email.toLowerCase()}:${OUTREACH_INVITE_TEMPLATE_KEY}:${input.campaignKey}`;
}

export type OutreachInviteEmailInput = {
  to: string;
  firstName: string | null;
  origen: OrigenOutreach;
  campaignKey: string;
};

export async function sendOutreachInviteEmail(
  input: OutreachInviteEmailInput,
): Promise<EmailDeliveryOutcome> {
  const { subject, text, html } = buildOutreachInviteContent({
    firstName: input.firstName,
    origen: input.origen,
    baseUrl: baseUrl(),
  });

  return enqueueAndSendIdempotentEmail({
    idempotencyKey: outreachInviteIdempotencyKey({
      email: input.to,
      campaignKey: input.campaignKey,
    }),
    to: resolveGiftRecipient(input.to),
    subject: isClickatonProductionAudience() ? subject : `[TEST] ${subject}`,
    text,
    html,
    templateKey: OUTREACH_INVITE_TEMPLATE_KEY,
    templateData: { origen: input.origen, campaignKey: input.campaignKey },
  });
}
